import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { getActiveAllowedProductsFromList } from '@/lib/metas/product-allowlist'
import { readProductAllowlist } from '@/lib/metas/product-allowlist-store'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

type RawRecord = Record<string, unknown>

function normalizeCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d+$/.test(trimmed)) {
    const normalized = String(Number(trimmed))
    return normalized === 'NaN' ? trimmed : normalized
  }
  return trimmed
}

function canonicalizeCodeList(values: string[]) {
  const set = new Set<string>()
  for (const raw of values) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) continue
    set.add(trimmed)
    const normalized = normalizeCode(trimmed)
    if (normalized) set.add(normalized)
  }
  return [...set]
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const n = Number(value.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function extractBearerToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as RawRecord
  for (const key of ['access_token', 'bearerToken', 'token', 'jwt']) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  }
  return null
}

function getSankhyaAuthOrigins(baseUrl: string) {
  const url = new URL(baseUrl)
  const host = url.hostname.toLowerCase()
  const localOrigin = url.origin.replace(/\/+$/, '')
  const production = 'https://api.sankhya.com.br'
  const sandbox = 'https://api.sandbox.sankhya.com.br'
  const candidates = host.includes('sandbox.sankhya.com.br') ? [sandbox, production, localOrigin] : [production, sandbox, localOrigin]
  return [...new Set(candidates)]
}

async function authenticateOAuth(config: SankhyaConfig, baseUrl: string): Promise<string | null> {
  if (!config.token || !config.clientId || !config.clientSecret) return null
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret })
  for (const origin of getSankhyaAuthOrigins(baseUrl)) {
    try {
      const response = await fetch(`${origin}/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Token': config.token },
        body,
        signal: AbortSignal.timeout(12_000),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) continue
      const bearer = extractBearerToken(payload)
      if (bearer) return bearer
    } catch {}
  }
  return null
}

async function authenticateSession(config: SankhyaConfig, baseUrl: string): Promise<string | null> {
  if (!config.username || !config.password) return null
  const tokenHeader = config.appKey || config.token || ''
  try {
    const response = await fetch(`${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(tokenHeader ? { token: tokenHeader } : {}),
      },
      body: JSON.stringify({
        serviceName: 'MobileLoginSP.login',
        requestBody: {
          NOMUSU: { $: config.username },
          INTERNO: { $: config.password },
          KEEPCONNECTED: { $: 'S' },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) return null
    const respBody = data.responseBody ?? data
    const sessionToken =
      typeof respBody.jsessionid === 'string' ? respBody.jsessionid :
      typeof respBody.JSESSIONID === 'string' ? respBody.JSESSIONID :
      typeof respBody.callID === 'string' ? respBody.callID :
      typeof respBody.bearerToken === 'string' ? respBody.bearerToken :
      null
    return sessionToken || extractBearerToken(respBody)
  } catch {
    return null
  }
}

function buildHeaders(config: SankhyaConfig, bearerToken: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
    headers.token = bearerToken
  } else if (config.token) {
    headers.token = config.token
  }
  if (config.token) headers['X-Token'] = config.token
  const appKeyValue = config.appKey || config.token
  if (appKeyValue) {
    headers.appkey = appKeyValue
    headers.AppKey = appKeyValue
  }
  return headers
}

function getSqlEndpoints(baseUrl: string, appKey?: string | null, hasBearer = false) {
  const appKeyParam = appKey ? `&appkey=${encodeURIComponent(appKey)}` : ''
  const query = `serviceName=DbExplorerSP.executeQuery&outputType=json${appKeyParam}`
  if (hasBearer) {
    return [
      `https://api.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`,
      `${baseUrl}/mge/service.sbr?${query}`,
    ]
  }
  return [`${baseUrl}/mge/service.sbr?${query}`]
}

function extractServiceError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as RawRecord
  const status = String(obj.status ?? '').trim()
  const statusMessage = String(obj.statusMessage ?? '').trim()
  if (!status && !statusMessage) return null
  if (status === '1' || status.toUpperCase() === 'SUCCESS') return null
  return statusMessage || `Falha no servico Sankhya (status ${status || 'desconhecido'}).`
}

function collectRecords(payload: unknown, bucket: RawRecord[]) {
  if (!payload || typeof payload !== 'object') return
  const obj = payload as RawRecord
  const responseBody = obj.responseBody
  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as RawRecord
    const rowsRaw = body.rows
    const fieldsRaw = Array.isArray(body.fields) ? body.fields : Array.isArray(body.fieldsMetadata) ? body.fieldsMetadata : []

    if (Array.isArray(rowsRaw) && rowsRaw.length > 0) {
      const row0 = rowsRaw[0]
      if (row0 && typeof row0 === 'object' && !Array.isArray(row0)) {
        for (const row of rowsRaw) {
          if (row && typeof row === 'object' && !Array.isArray(row)) {
            const normalized: RawRecord = {}
            for (const [key, value] of Object.entries(row as RawRecord)) normalized[key.toUpperCase()] = value
            bucket.push(normalized)
          }
        }
      } else if (Array.isArray(row0)) {
        const fields = fieldsRaw.map((field, index) => {
          if (typeof field === 'string') return field.toUpperCase()
          if (field && typeof field === 'object') {
            const f = field as RawRecord
            return String(f.name ?? f.fieldName ?? f.FIELD_NAME ?? `COL_${index + 1}`).toUpperCase()
          }
          return `COL_${index + 1}`
        })
        for (const row of rowsRaw) {
          if (!Array.isArray(row)) continue
          const mapped: RawRecord = {}
          for (let i = 0; i < row.length; i += 1) mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
          bucket.push(mapped)
        }
      }
    }
  }
  for (const value of Object.values(obj)) collectRecords(value, bucket)
}

async function queryRows(baseUrl: string, headers: Record<string, string>, sql: string, appKey?: string | null): Promise<RawRecord[]> {
  const failures: string[] = []
  const payloadVariants = [
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
    { requestBody: { sql } },
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { statement: sql } },
  ]

  for (const endpoint of getSqlEndpoints(baseUrl, appKey, /^Bearer\s+/i.test(headers.Authorization ?? ''))) {
    for (const payload of payloadVariants) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25_000),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) { failures.push(`HTTP ${response.status}`); continue }
        const serviceError = extractServiceError(data)
        if (serviceError) { failures.push(serviceError); continue }
        const records: RawRecord[] = []
        collectRecords(data, records)
        return records
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'erro de rede')
      }
    }
  }

  throw new Error(`Falha ao consultar distribuicao de itens no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function isIsoDate(value: string | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function nextDayIso(iso: string | null, fallbackIso: string) {
  if (!iso) return fallbackIso
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return fallbackIso
  parsed.setDate(parsed.getDate() + 1)
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildSql(
  startDate: string,
  endDateExclusive: string,
  sellerCodes: string[],
  productCodes: string[],
  companyScope: '1' | '2' | 'all',
  stageEndExclusive: { w1: string; w2: string; w3: string; closing: string },
  mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT',
) {
  const sellerFilter = sellerCodes.length > 0 ? `AND CAB.CODVEND IN (${sellerCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')})\n  ` : ''
  const productFilter = productCodes.length > 0 ? `AND TO_CHAR(PRO.CODPROD) IN (${productCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')})\n  ` : ''
  const companyFilter = companyScope !== 'all' ? `AND CAB.CODEMP = ${Number(companyScope)}\n  ` : ''
  const typeFilter = mode === 'STRICT'
    ? "AND CAB.CODTIPOPER = 1001\n  "
    : mode === 'FALLBACK_TIPMOV'
      ? "AND CAB.TIPMOV = 'V'\n  "
      : ''

  return `
SELECT
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  TO_CHAR(CAB.CODPARC) AS CODPARC,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w1}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS PRODUTOS_W1,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w2}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS PRODUTOS_W2,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w3}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS PRODUTOS_W3,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.closing}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS PRODUTOS_CLOSING,
  COUNT(DISTINCT TO_CHAR(PRO.CODPROD)) AS PRODUTOS_MES
FROM TGFCAB CAB
INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  AND NVL(CAB.CODPARC, 0) > 0
  ${typeFilter}${companyFilter}${sellerFilter}${productFilter}GROUP BY CAB.CODVEND, CAB.CODPARC
ORDER BY CAB.CODVEND, CAB.CODPARC`.trim()
}

function buildSellerItemsSql(
  startDate: string,
  endDateExclusive: string,
  sellerCodes: string[],
  productCodes: string[],
  companyScope: '1' | '2' | 'all',
  stageEndExclusive: { w1: string; w2: string; w3: string; closing: string },
  mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT',
) {
  const sellerFilter = sellerCodes.length > 0 ? `AND CAB.CODVEND IN (${sellerCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')})\n  ` : ''
  const productFilter = productCodes.length > 0 ? `AND TO_CHAR(PRO.CODPROD) IN (${productCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')})\n  ` : ''
  const companyFilter = companyScope !== 'all' ? `AND CAB.CODEMP = ${Number(companyScope)}\n  ` : ''
  const typeFilter = mode === 'STRICT'
    ? "AND CAB.CODTIPOPER = 1001\n  "
    : mode === 'FALLBACK_TIPMOV'
      ? "AND CAB.TIPMOV = 'V'\n  "
      : ''

  return `
SELECT
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w1}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS ITENS_W1,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w2}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS ITENS_W2,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w3}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS ITENS_W3,
  COUNT(DISTINCT CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.closing}', 'YYYY-MM-DD') THEN TO_CHAR(PRO.CODPROD) END) AS ITENS_CLOSING,
  COUNT(DISTINCT TO_CHAR(PRO.CODPROD)) AS ITENS_MES
FROM TGFCAB CAB
INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  AND NVL(CAB.CODPARC, 0) > 0
  ${typeFilter}${companyFilter}${sellerFilter}${productFilter}GROUP BY CAB.CODVEND
ORDER BY CAB.CODVEND`.trim()
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const now = new Date()
  const yearRaw = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = Number(req.nextUrl.searchParams.get('month'))
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(year, month, 1)
  const endDateExclusive = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`

  const w1End = req.nextUrl.searchParams.get('w1End')
  const w2End = req.nextUrl.searchParams.get('w2End')
  const w3End = req.nextUrl.searchParams.get('w3End')
  const closingEnd = req.nextUrl.searchParams.get('closingEnd')

  const stageEndExclusive = {
    w1: nextDayIso(isIsoDate(w1End) ? w1End : null, startDate),
    w2: nextDayIso(isIsoDate(w2End) ? w2End : null, startDate),
    w3: nextDayIso(isIsoDate(w3End) ? w3End : null, startDate),
    closing: nextDayIso(isIsoDate(closingEnd) ? closingEnd : null, startDate),
  }

  const scopeRaw = req.nextUrl.searchParams.get('companyScope')
  const companyScope: '1' | '2' | 'all' = scopeRaw === '2' ? '2' : scopeRaw === 'all' ? 'all' : '1'

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, baseUrl: true, configEncrypted: true },
  })

  if (!integration?.baseUrl) return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa.' }, { status: 412 })
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ message: 'URL Sankhya invalida.' }, { status: 412 })
  const config = parseStoredConfig(integration.configEncrypted)

  try {
    let bearerToken: string | null = null
    if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') bearerToken = await authenticateOAuth(config, baseUrl)
    if (!bearerToken) bearerToken = await authenticateSession(config, baseUrl)

    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null

    const [sellerAllowlist, productAllowlist] = await Promise.all([
      readSellerAllowlist(),
      readProductAllowlist(),
    ])
    const isSupervisorScope = authUser.role?.code === 'SALES_SUPERVISOR'
    const supervisorSellerCode = isSupervisorScope ? (authUser.sellerCode ?? null) : null
    const activeSellers = getActiveAllowedSellersFromList(sellerAllowlist)
    const scopedSellers = supervisorSellerCode
      ? activeSellers.filter((s) => String(s.supervisorCode ?? '').trim() === supervisorSellerCode)
      : activeSellers
    const sellerCodes = canonicalizeCodeList(scopedSellers
      .map((s) => String(s.code ?? '').trim())
      .filter((c) => c.length > 0))
    const productCodes = canonicalizeCodeList(getActiveAllowedProductsFromList(productAllowlist)
      .map((p) => String(p.code ?? '').trim())
      .filter((c) => c.length > 0))

    if (productCodes.length === 0) {
      return NextResponse.json({ rows: [], sellerItems: [], year, month })
    }

    const attempts: Array<{ mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT'; rows: number; sellerItemsRows: number; error?: string }> = []
    const tryMode = async (mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT') => {
      try {
        const rows = await queryRows(
          baseUrl,
          headers,
          buildSql(startDate, endDateExclusive, sellerCodes, productCodes, companyScope, stageEndExclusive, mode),
          appKey,
        )
        let sellerItemsRows: RawRecord[] = []
        try {
          sellerItemsRows = await queryRows(
            baseUrl,
            headers,
            buildSellerItemsSql(startDate, endDateExclusive, sellerCodes, productCodes, companyScope, stageEndExclusive, mode),
            appKey,
          )
        } catch {
          sellerItemsRows = []
        }
        attempts.push({ mode, rows: rows.length, sellerItemsRows: sellerItemsRows.length })
        return { rows, sellerItemsRows }
      } catch (error) {
        attempts.push({
          mode,
          rows: 0,
          sellerItemsRows: 0,
          error: error instanceof Error ? error.message : 'erro desconhecido',
        })
        return null
      }
    }

    let records: RawRecord[] = []
    let sellerItemsRecords: RawRecord[] = []
    for (const mode of ['STRICT', 'FALLBACK_TIPMOV', 'ANY_MOVEMENT'] as const) {
      const result = await tryMode(mode)
      if (result && result.rows.length > 0) {
        records = result.rows
        sellerItemsRecords = result.sellerItemsRows
        break
      }
      if (result && result.rows.length === 0) {
        // Keep trying next mode when query succeeded but returned no rows.
      }
    }

    const rows = records.map((r) => ({
      sellerCode: normalizeCode(String(r.CODVEND ?? '').trim()),
      clientCode: normalizeCode(String(r.CODPARC ?? '').trim()),
      productsW1: Math.max(Math.floor(parseNumber(r.PRODUTOS_W1)), 0),
      productsW2: Math.max(Math.floor(parseNumber(r.PRODUTOS_W2)), 0),
      productsW3: Math.max(Math.floor(parseNumber(r.PRODUTOS_W3)), 0),
      productsClosing: Math.max(Math.floor(parseNumber(r.PRODUTOS_CLOSING)), 0),
      productsMonth: Math.max(Math.floor(parseNumber(r.PRODUTOS_MES)), 0),
    }))
    const sellerItems = sellerItemsRecords.map((r) => ({
      sellerCode: normalizeCode(String(r.CODVEND ?? '').trim()),
      itemsW1: Math.max(Math.floor(parseNumber(r.ITENS_W1)), 0),
      itemsW2: Math.max(Math.floor(parseNumber(r.ITENS_W2)), 0),
      itemsW3: Math.max(Math.floor(parseNumber(r.ITENS_W3)), 0),
      itemsClosing: Math.max(Math.floor(parseNumber(r.ITENS_CLOSING)), 0),
      itemsMonth: Math.max(Math.floor(parseNumber(r.ITENS_MES)), 0),
    }))

    const uniqueSellers = new Set(rows.map((r) => r.sellerCode).filter(Boolean)).size
    const uniqueClients = new Set(rows.map((r) => r.clientCode).filter(Boolean)).size
    const usedAttempt = attempts.find((x) => !x.error && x.rows > 0) ?? attempts.find((x) => !x.error)
    const queryModeUsed = usedAttempt?.mode ?? 'NONE'

    return NextResponse.json({
      rows,
      sellerItems,
      year,
      month,
      diagnostics: {
        queryModeUsed,
        attempts,
        totalRows: rows.length,
        uniqueSellers,
        uniqueClients,
        sellerCodesRequested: sellerCodes.length,
        productCodesRequested: productCodes.length,
        companyScope,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar distribuicao de itens no Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
