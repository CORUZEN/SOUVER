import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { authenticateSankhyaCached } from '@/lib/integrations/sankhya-auth'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'
import { withRequestCache } from '@/lib/server/request-cache'
import { withConcurrencyLimit } from '@/lib/server/concurrency-limit'
import { sanitizeSellerCodes, buildSafeSellerInClause } from '@/lib/metas/seller-code-validation'

type RawRecord = Record<string, unknown>
type StageEndExclusive = { w1: string; w2: string; w3: string; closing: string }

/**
 * Returns aggregated gross weight (kg) by seller × product brand for a given month.
 *
 * Response shape:
 * {
 *   rows: Array<{
 *     sellerCode: string
 *     sellerName: string
 *     brand: string
 *     totalKgW1: number
 *     totalKgW2: number
 *     totalKgW3: number
 *     totalKgClosing: number
 *     totalKg: number
 *   }>
 *   brands: string[]
 *   year: number
 *   month: number
 * }
 */

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const n = Number(value.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
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
  const candidates = host.includes('sandbox.sankhya.com.br')
    ? [sandbox, production, localOrigin]
    : host.includes('sankhya.com.br')
      ? [production, sandbox, localOrigin]
      : [localOrigin, production, sandbox]
  return [...new Set(candidates)]
}

async function authenticateOAuth(config: SankhyaConfig, baseUrl: string): Promise<string | null> {
  if (!config.token || !config.clientId || !config.clientSecret) return null
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })
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
    } catch { /* next origin */ }
  }
  return null
}

async function authenticateSession(config: SankhyaConfig, baseUrl: string): Promise<string | null> {
  if (!config.username || !config.password) return null
  const tokenHeader = config.appKey || config.token || ''
  try {
    const response = await fetch(
      `${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`,
      {
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
      }
    )
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
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
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
    const fieldsRaw = Array.isArray(body.fields) ? body.fields
      : Array.isArray(body.fieldsMetadata) ? body.fieldsMetadata
      : []

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

async function queryRows(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  appKey?: string | null,
): Promise<RawRecord[]> {
  const failures: string[] = []
  const payloadVariants = [
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
    { requestBody: { sql } },
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { statement: sql } },
  ]

  for (const endpoint of getSqlEndpoints(baseUrl, appKey, /^Bearer\s+/i.test(headers.Authorization ?? ''))) {
    for (const payload of payloadVariants) {
      try {
        const response = await withConcurrencyLimit('sankhya:sql-query', 6, async () => fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        }))
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
  throw new Error(`Falha ao consultar peso por marca no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function buildBrandWeightSql(
  startDate: string,
  endDateExclusive: string,
  sellerCodes: string[],
  companyScope: '1' | '2' | 'all',
  stageEndExclusive: StageEndExclusive,
) {
  const safeSellerCodes = sanitizeSellerCodes(sellerCodes)
  const sellerFilter = buildSafeSellerInClause(safeSellerCodes, 'CAB.CODVEND')
  const companyFilter = companyScope !== 'all'
    ? `AND CAB.CODEMP = ${Number(companyScope)}\n  `
    : ''

  return `
SELECT
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  NVL(VEN.APELIDO, TO_CHAR(CAB.CODVEND)) AS VENDEDOR,
  NVL(TRIM(PRO.MARCA), 'SEM MARCA') AS MARCA,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w1}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W1_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w2}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W2_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w3}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W3_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.closing}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_CLOSING_KG,
  SUM(NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) AS PESO_TOTAL_KG
FROM TGFCAB CAB
INNER JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  AND CAB.CODTIPOPER = 1001
  ${companyFilter}${sellerFilter}GROUP BY CAB.CODVEND, VEN.APELIDO, PRO.MARCA
ORDER BY CAB.CODVEND, PRO.MARCA`.trim()
}

function buildBrandWeightSqlFallback(
  startDate: string,
  endDateExclusive: string,
  sellerCodes: string[],
  companyScope: '1' | '2' | 'all',
  stageEndExclusive: StageEndExclusive,
) {
  const safeSellerCodes = sanitizeSellerCodes(sellerCodes)
  const sellerFilter = buildSafeSellerInClause(safeSellerCodes, 'CAB.CODVEND')
  const companyFilter = companyScope !== 'all'
    ? `AND CAB.CODEMP = ${Number(companyScope)}\n  `
    : ''
  return `
SELECT
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  NVL(VEN.APELIDO, TO_CHAR(CAB.CODVEND)) AS VENDEDOR,
  NVL(TRIM(PRO.MARCA), 'SEM MARCA') AS MARCA,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w1}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W1_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w2}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W2_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.w3}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_W3_KG,
  SUM(CASE WHEN CAB.DTNEG < TO_DATE('${stageEndExclusive.closing}', 'YYYY-MM-DD') THEN (NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) ELSE 0 END) AS PESO_CLOSING_KG,
  SUM(NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) AS PESO_TOTAL_KG
FROM TGFCAB CAB
INNER JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  AND CAB.TIPMOV IN ('V', 'P')
  ${companyFilter}${sellerFilter}GROUP BY CAB.CODVEND, VEN.APELIDO, PRO.MARCA
ORDER BY CAB.CODVEND, PRO.MARCA`.trim()
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

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
  const stageEndExclusive: StageEndExclusive = {
    w1: nextDayIso(isIsoDate(w1End) ? w1End : null, endDateExclusive),
    w2: nextDayIso(isIsoDate(w2End) ? w2End : null, endDateExclusive),
    w3: nextDayIso(isIsoDate(w3End) ? w3End : null, endDateExclusive),
    closing: nextDayIso(isIsoDate(closingEnd) ? closingEnd : null, endDateExclusive),
  }
  const scopeRaw = req.nextUrl.searchParams.get('companyScope')
  const companyScope: '1' | '2' | 'all' = scopeRaw === '2' ? '2' : scopeRaw === 'all' ? 'all' : '1'

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, baseUrl: true, configEncrypted: true },
  })
  if (!integration?.baseUrl) {
    return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa.' }, { status: 412 })
  }
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) {
    return NextResponse.json({ message: 'URL Sankhya invalida.' }, { status: 412 })
  }
  const config = parseStoredConfig(integration.configEncrypted)
  const roleCode = authUser.role?.code?.toUpperCase() ?? 'UNKNOWN'
  const normalizedUserSellerCode = String(authUser.sellerCode ?? '').trim()
  const scopeToken = roleCode === 'SALES_SUPERVISOR'
    ? `SUP:${normalizedUserSellerCode}`
    : roleCode === 'SELLER'
      ? `SELLER:${normalizedUserSellerCode}`
      : roleCode
  const cacheKey = `metas:brand-weight:v2:${year}-${month}:${companyScope}:${scopeToken}:${stageEndExclusive.w1}:${stageEndExclusive.w2}:${stageEndExclusive.w3}:${stageEndExclusive.closing}`

  try {
    const payload = await withRequestCache(cacheKey, 180_000, async () => {
      const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)
      const headers = buildHeaders(config, bearerToken)
      const appKey = config.appKey ?? config.token ?? null

      const allowlist = await readSellerAllowlist()
      const isSupervisorScope = roleCode === 'SALES_SUPERVISOR'
      const isSellerScope = roleCode === 'SELLER'
      const supervisorSellerCode = isSupervisorScope ? normalizedUserSellerCode : null
      const sellerSelfCode = isSellerScope ? normalizedUserSellerCode : null
      const allActiveSellers = getActiveAllowedSellersFromList(allowlist)
      const allowedSellers = sellerSelfCode
        ? allActiveSellers.filter((s) => String(s.code ?? '').trim() === sellerSelfCode)
        : supervisorSellerCode
        ? allActiveSellers.filter((s) => String(s.supervisorCode ?? '').trim() === supervisorSellerCode)
        : allActiveSellers
      if (isSellerScope && (!sellerSelfCode || allowedSellers.length === 0)) {
        throw new Error('Usuário vendedor sem vínculo válido na lista de vendedores liberados.')
      }
      const sellerCodes = allowedSellers.map((s) => String(s.code ?? '').trim()).filter((c) => c.length > 0)

      let records: RawRecord[] = []
      try {
        records = await queryRows(baseUrl, headers, buildBrandWeightSql(startDate, endDateExclusive, sellerCodes, companyScope, stageEndExclusive), appKey)
      } catch {
        records = await queryRows(baseUrl, headers, buildBrandWeightSqlFallback(startDate, endDateExclusive, sellerCodes, companyScope, stageEndExclusive), appKey)
      }

      const rows = records.map((r) => ({
        sellerCode: String(r.CODVEND ?? '').trim(),
        sellerName: String(r.VENDEDOR ?? '').trim(),
        brand: String(r.MARCA ?? 'SEM MARCA').trim().toUpperCase(),
        totalKgW1: parseNumber(r.PESO_W1_KG),
        totalKgW2: parseNumber(r.PESO_W2_KG),
        totalKgW3: parseNumber(r.PESO_W3_KG),
        totalKgClosing: parseNumber(r.PESO_CLOSING_KG),
        totalKg: parseNumber(r.PESO_TOTAL_KG),
      }))

      const brands = [...new Set(rows.map((r) => r.brand))].sort()
      return { rows, brands, year, month }
    })
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar peso por marca.'
    return NextResponse.json({ message }, { status: 502 })
  }
}

