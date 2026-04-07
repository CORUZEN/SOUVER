import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

type RawRecord = Record<string, unknown>

type SankhyaOrder = {
  sellerCode: string
  sellerName: string
  partnerCode: string
  orderNumber: string
  negotiatedAt: string
  totalValue: number
  grossWeight: number
  statusNota: string
  companyCode: string
}

/* ---------- helpers ---------- */

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return null
}

function makeSellerLogin(name: string, fallbackId: string) {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return normalized || fallbackId
}

/* ---------- Sankhya auth ---------- */

function getSankhyaAuthOrigins(baseUrl: string) {
  const url = new URL(baseUrl)
  const host = url.hostname.toLowerCase()
  const localOrigin = url.origin.replace(/\/+$/, '')
  const production = 'https://api.sankhya.com.br'
  const sandbox = 'https://api.sandbox.sankhya.com.br'
  const candidates = host.includes('sandbox.sankhya.com.br')
    ? [sandbox, production, localOrigin]
    : [production, sandbox, localOrigin]
  return [...new Set(candidates)]
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

/* ---------- Headers & endpoints ---------- */

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

/* ---------- Query execution ---------- */

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
  options?: { allowEmpty?: boolean }
): Promise<RawRecord[]> {
  const failures: string[] = []
  let hadSuccessfulExecution = false
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
        hadSuccessfulExecution = true
        const records: RawRecord[] = []
        collectRecords(data, records)
        if (records.length > 0) return records
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'erro de rede')
      }
    }
  }

  if (hadSuccessfulExecution && options?.allowEmpty) return []
  throw new Error(`Nao foi possivel consultar pedidos no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

/* ---------- Order parsing ---------- */

function toOrder(record: RawRecord): SankhyaOrder | null {
  const sellerName = String(
    record.VENDEDOR ?? record.APELIDO ?? record.NOMEVEND ?? ''
  ).trim() || 'Sem vendedor'
  const negotiatedAt = toIsoDate(record.DTNEG ?? record.DTMOV)
  if (!negotiatedAt) return null
  return {
    sellerCode: String(record.CODVEND ?? '').trim(),
    sellerName,
    partnerCode: String(record.CODPARC ?? '').trim(),
    orderNumber: String(record.NUNOTA ?? '').trim(),
    negotiatedAt,
    totalValue: parseNumber(record.VLRNOTA),
    grossWeight: parseNumber(record.PESOBRUTO),
    statusNota: String(record.STATUSNOTA ?? 'L').trim(),
    companyCode: String(record.CODEMP ?? '').trim(),
  }
}

/* ---------- SQL builders ---------- */

function parseYearMonth(req: NextRequest) {
  const now = new Date()
  const yearRaw = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = Number(req.nextUrl.searchParams.get('month'))
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(year, month, 1)
  const endDateExclusive = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
  const scopeRaw = req.nextUrl.searchParams.get('companyScope')
  const companyScope: '1' | '2' | 'all' =
    scopeRaw === '2' ? '2' : scopeRaw === 'all' ? 'all' : '1'
  return { year, month, startDate, endDateExclusive, companyScope }
}

/**
 * Build SQL that filters directly by seller codes, date range, and
 * operation type (CODTIPOPER = 1001 — "Pedido de Venda").
 * Keeps the result well under the 5000-row API limit and avoids
 * transferring thousands of irrelevant orders over the network.
 */
function buildOrdersSql(
  startDate: string,
  endDateExclusive: string,
  sellerCodes: string[],
  mode: 'STRICT' | 'FALLBACK_TIPMOV' | 'ANY_MOVEMENT' = 'STRICT',
  companyScope: '1' | '2' | 'all' = '1'
) {
  // Primary: filter by CODTIPOPER = 1001 (pedido de venda real)
  // Fallback 1: TIPMOV IN ('V','P') caso CODTIPOPER não exista na instalação
  // Fallback 2: sem filtro de tipo (último recurso)
  const typeFilter = mode === 'STRICT'
    ? "AND CAB.CODTIPOPER = 1001\n  "
    : mode === 'FALLBACK_TIPMOV'
      ? "AND CAB.TIPMOV IN ('V', 'P')\n  "
      : ''

  let sellerFilter = ''
  if (sellerCodes.length > 0) {
    const escaped = sellerCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')
    sellerFilter = `AND CAB.CODVEND IN (${escaped})\n  `
  }

  // companyScope controls which Sankhya company (CODEMP) to include:
  //   '1'   → Moagem Ouro Verde (empresa 1 apenas)
  //   '2'   → Moagem Ouro Verde Maceió (empresa 2 apenas)
  //   'all' → todas as empresas (sem filtro de CODEMP)
  const companyFilter = companyScope !== 'all'
    ? `AND CAB.CODEMP = ${Number(companyScope)}\n  `
    : ''

  return `
SELECT
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DTNEG,
  NVL(VEN.APELIDO, 'SEM VENDEDOR') AS VENDEDOR,
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  TO_CHAR(NVL(CAB.CODPARC, 0)) AS CODPARC,
  TO_CHAR(CAB.NUNOTA) AS NUNOTA,
  NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
  NVL(CAB.PESOBRUTO, 0) AS PESOBRUTO,
  NVL(CAB.STATUSNOTA, 'L') AS STATUSNOTA,
  TO_CHAR(CAB.CODEMP) AS CODEMP
FROM TGFCAB CAB
INNER JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  ${typeFilter}${companyFilter}${sellerFilter}ORDER BY CAB.CODVEND`.trim()
}

/* ---------- GET handler ---------- */

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const { year, month, startDate, endDateExclusive, companyScope } = parseYearMonth(req)

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, baseUrl: true, configEncrypted: true },
  })

  if (!integration?.baseUrl) {
    return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa foi encontrada.' }, { status: 412 })
  }

  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ message: 'URL da integracao Sankhya invalida.' }, { status: 412 })

  const config = parseStoredConfig(integration.configEncrypted)

  try {
    // --- Auth ---
    let bearerToken: string | null = null
    if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') {
      bearerToken = await authenticateOAuth(config, baseUrl)
    }
    if (!bearerToken) {
      bearerToken = await authenticateSession(config, baseUrl)
    }
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null

    // --- Allowlist ---
    const allowlist = await readSellerAllowlist()
    const allowedSellers = getActiveAllowedSellersFromList(allowlist)

    // Extract seller codes for SQL-level filtering
    const sellerCodes = allowedSellers
      .map((s) => String(s.code ?? '').trim())
      .filter((c) => c.length > 0)

    // --- Query orders filtered by seller codes in SQL ---
    // Cascade: CODTIPOPER=1001 → TIPMOV fallback → any movement
    let orders: SankhyaOrder[] = []
    let queryMode: 'CODTIPOPER_1001' | 'TIPMOV_VP' | 'ANY_MOVEMENT' | 'NONE' = 'NONE'

    // 1) Primary: CODTIPOPER = 1001 (pedido de venda)
    const sqlStrict = buildOrdersSql(startDate, endDateExclusive, sellerCodes, 'STRICT', companyScope)
    try {
      const records = await queryRows(baseUrl, headers, sqlStrict, appKey, { allowEmpty: true })
      orders = records.map(toOrder).filter((o): o is SankhyaOrder => o !== null)
      queryMode = 'CODTIPOPER_1001'
    } catch {
      // CODTIPOPER may not exist — try TIPMOV fallback
    }

    // 2) Fallback: TIPMOV IN ('V','P') if CODTIPOPER failed
    if (queryMode === 'NONE') {
      const sqlTipmov = buildOrdersSql(startDate, endDateExclusive, sellerCodes, 'FALLBACK_TIPMOV', companyScope)
      try {
        const records = await queryRows(baseUrl, headers, sqlTipmov, appKey, { allowEmpty: true })
        orders = records.map(toOrder).filter((o): o is SankhyaOrder => o !== null)
        queryMode = 'TIPMOV_VP'
      } catch { /* next fallback */ }
    }

    // 3) Last resort: no type filter
    if (queryMode === 'NONE') {
      const sqlAny = buildOrdersSql(startDate, endDateExclusive, sellerCodes, 'ANY_MOVEMENT', companyScope)
      try {
        const records = await queryRows(baseUrl, headers, sqlAny, appKey, { allowEmpty: true })
        orders = records.map(toOrder).filter((o): o is SankhyaOrder => o !== null)
        queryMode = 'ANY_MOVEMENT'
      } catch { /* keep empty */ }
    }

    // --- Group by seller ---
    const sellersMap = new Map<string, {
      id: string
      name: string
      login: string
      orders: Array<{ orderNumber: string; negotiatedAt: string; totalValue: number; grossWeight: number; clientCode: string }>
      totalValue: number
      totalGrossWeight: number
    }>()

    for (const order of orders) {
      const normalizedName = order.sellerName.trim() || 'Sem vendedor'
      const sellerKey = `${order.sellerCode || '0'}::${normalizedName.toUpperCase()}`
      const sellerId = order.sellerCode
        ? `sankhya-${order.sellerCode}`
        : `sankhya-${normalizedName.toLowerCase().replace(/\s+/g, '-')}`

      if (!sellersMap.has(sellerKey)) {
        sellersMap.set(sellerKey, {
          id: sellerId,
          name: normalizedName,
          login: makeSellerLogin(normalizedName, sellerId),
          orders: [],
          totalValue: 0,
          totalGrossWeight: 0,
        })
      }

      const seller = sellersMap.get(sellerKey)!
      seller.orders.push({
        orderNumber: order.orderNumber,
        negotiatedAt: order.negotiatedAt,
        totalValue: order.totalValue,
        grossWeight: order.grossWeight,
        clientCode: order.partnerCode,
      })
      seller.totalValue += order.totalValue
      seller.totalGrossWeight += order.grossWeight
    }

    // Ensure all active sellers are present (even with 0 orders)
    for (const allowed of allowedSellers) {
      const normalizedName = allowed.name.trim() || 'Sem vendedor'
      const sellerKey = `${allowed.code || '0'}::${normalizedName.toUpperCase()}`
      if (sellersMap.has(sellerKey)) continue
      const sellerId = allowed.code
        ? `sankhya-${allowed.code}`
        : `sankhya-${normalizedName.toLowerCase().replace(/\s+/g, '-')}`
      sellersMap.set(sellerKey, {
        id: sellerId,
        name: normalizedName,
        login: makeSellerLogin(normalizedName, sellerId),
        orders: [],
        totalValue: 0,
        totalGrossWeight: 0,
      })
    }

    const sellers = [...sellersMap.values()]
      .map((seller) => ({ ...seller, totalOrders: seller.orders.length }))
      .sort((a, b) => b.totalValue - a.totalValue)

    return NextResponse.json({
      source: 'sankhya',
      year,
      month,
      range: { startDate, endDateExclusive },
      integration: { id: integration.id, name: integration.name },
      policy: {
        allowlistEnabled: allowedSellers.length > 0,
        allowlistCount: allowedSellers.length,
      },
      diagnostics: {
        selectedMonthOrders: orders.length,
        queryMode,
        companyScope,
        byStatus: orders.reduce<Record<string, number>>((acc, o) => {
          acc[o.statusNota] = (acc[o.statusNota] ?? 0) + 1
          return acc
        }, {}),
        byCompany: orders.reduce<Record<string, number>>((acc, o) => {
          const key = o.companyCode || 'desconhecida'
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {}),
      },
      sellers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar pedidos no Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
