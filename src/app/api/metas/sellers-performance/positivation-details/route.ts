import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { getActiveAllowedProductsFromList } from '@/lib/metas/product-allowlist'
import { readProductAllowlist } from '@/lib/metas/product-allowlist-store'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'
import { isValidSellerCode, sanitizeSellerCodes } from '@/lib/metas/seller-code-validation'

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
  const candidates = host.includes('sandbox.sankhya.com.br') ? [sandbox, production, localOrigin] : host.includes('sankhya.com.br') ? [production, sandbox, localOrigin] : [localOrigin, production, sandbox]
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

  throw new Error(`Falha ao consultar detalhes de positivaÃ§Ã£o no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function buildPositivationSql(
  startDate: string,
  endDateExclusive: string,
  sellerCode: string,
  productCodes: string[],
  companyScope: '1' | '2' | 'all',
  mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT',
) {
  const safeSellerCode = isValidSellerCode(sellerCode) ? sellerCode.trim() : ''
  const sellerFilter = safeSellerCode ? `AND CAB.CODVEND = ${safeSellerCode}\n  ` : ''
  const safeProductCodes = sanitizeSellerCodes(productCodes)
  const productFilter = safeProductCodes.length > 0
    ? `AND TO_CHAR(PRO.CODPROD) IN (${safeProductCodes.map((c) => `'${c}'`).join(', ')})\n  `
    : ''
  const companyFilter = companyScope !== 'all' ? `AND CAB.CODEMP = ${Number(companyScope)}\n  ` : ''
  const typeFilter = mode === 'STRICT'
    ? "AND CAB.CODTIPOPER = 1001\n  "
    : mode === 'FALLBACK_TIPMOV'
      ? "AND CAB.TIPMOV = 'V'\n  "
      : ''

  return `
SELECT
  TO_CHAR(PRO.CODPROD) AS CODPROD,
  SUM(NVL(ITE.QTDNEG, 0)) AS QTD_VENDIDA,
  SUM(NVL(ITE.QTDNEG, 0) * NVL(PRO.PESOBRUTO, 0)) AS PESO_KG,
  COUNT(DISTINCT TO_CHAR(CAB.CODPARC)) AS CLIENTES
FROM TGFCAB CAB
INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  ${typeFilter}${companyFilter}${sellerFilter}${productFilter}GROUP BY PRO.CODPROD
ORDER BY PRO.CODPROD`.trim()
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

  const sellerCodeRaw = String(req.nextUrl.searchParams.get('sellerCode') ?? '').trim()
  const sellerCode = normalizeCode(sellerCodeRaw)
  if (!sellerCode) {
    return NextResponse.json({ message: 'sellerCode e obrigatorio.' }, { status: 400 })
  }

  const scopeRaw = req.nextUrl.searchParams.get('companyScope')
  const companyScope: '1' | '2' | 'all' = scopeRaw === '2' ? '2' : scopeRaw === 'all' ? 'all' : '1'

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { baseUrl: true, configEncrypted: true },
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
    const supervisorSellerCode = isSupervisorScope ? String(authUser.sellerCode ?? '').trim() : ''
    const activeSellers = getActiveAllowedSellersFromList(sellerAllowlist)
    const scopedSellers = supervisorSellerCode
      ? activeSellers.filter((s) => String(s.supervisorCode ?? '').trim() === supervisorSellerCode)
      : activeSellers
    const allowedSellerCodes = canonicalizeCodeList(scopedSellers.map((s) => String(s.code ?? '').trim()).filter(Boolean))
    if (!allowedSellerCodes.includes(sellerCode)) {
      return NextResponse.json({ message: 'Vendedor fora do escopo permitido.' }, { status: 403 })
    }

    const activeProducts = getActiveAllowedProductsFromList(productAllowlist)
    const productCodes = canonicalizeCodeList(activeProducts.map((p) => String(p.code ?? '').trim()).filter(Boolean))
    if (productCodes.length === 0) {
      return NextResponse.json({
        year,
        month,
        sellerCode,
        summary: { totalTargetItems: 0, totalPositivatedItems: 0, totalPendingItems: 0, totalSoldWeightKg: 0, totalSoldQty: 0 },
        positivatedProducts: [],
        pendingProducts: [],
      })
    }

    let records: RawRecord[] = []
    for (const mode of ['STRICT', 'FALLBACK_TIPMOV', 'ANY_MOVEMENT'] as const) {
      try {
        records = await queryRows(baseUrl, headers, buildPositivationSql(startDate, endDateExclusive, sellerCode, productCodes, companyScope, mode), appKey)
        break
      } catch {}
    }

    const soldByProduct = new Map<string, { soldQty: number; soldWeightKg: number; distinctClients: number }>()
    for (const row of records) {
      const code = normalizeCode(String(row.CODPROD ?? '').trim())
      if (!code) continue
      soldByProduct.set(code, {
        soldQty: Math.max(parseNumber(row.QTD_VENDIDA), 0),
        soldWeightKg: Math.max(parseNumber(row.PESO_KG), 0),
        distinctClients: Math.max(Math.floor(parseNumber(row.CLIENTES)), 0),
      })
    }

    const catalog = activeProducts.map((product) => {
      const code = normalizeCode(String(product.code ?? '').trim())
      const sold = soldByProduct.get(code)
      return {
        code,
        description: String(product.description ?? '').trim(),
        brand: String(product.brand ?? '').trim(),
        unit: String(product.unit ?? '').trim(),
        soldQty: sold?.soldQty ?? 0,
        soldWeightKg: sold?.soldWeightKg ?? 0,
        distinctClients: sold?.distinctClients ?? 0,
        positivated: Boolean(sold && sold.soldQty > 0),
      }
    })

    const positivatedProducts = catalog
      .filter((item) => item.positivated)
      .sort((a, b) => b.soldWeightKg - a.soldWeightKg || a.description.localeCompare(b.description, 'pt-BR'))

    const pendingProducts = catalog
      .filter((item) => !item.positivated)
      .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'))

    return NextResponse.json({
      year,
      month,
      sellerCode,
      summary: {
        totalTargetItems: catalog.length,
        totalPositivatedItems: positivatedProducts.length,
        totalPendingItems: pendingProducts.length,
        totalSoldWeightKg: positivatedProducts.reduce((sum, item) => sum + item.soldWeightKg, 0),
        totalSoldQty: positivatedProducts.reduce((sum, item) => sum + item.soldQty, 0),
      },
      positivatedProducts,
      pendingProducts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar detalhes de positivaÃ§Ã£o no Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}

