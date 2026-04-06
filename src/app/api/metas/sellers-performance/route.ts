import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { getActiveAllowedSellersFromList, matchesAllowedSeller } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

type SankhyaRawRecord = Record<string, unknown>

type SankhyaOrder = {
  sellerCode: string
  sellerName: string
  partnerCode: string
  orderNumber: string
  negotiatedAt: string
  totalValue: number
  grossWeight: number
}

function hasLegacyCredentials(config: SankhyaConfig) {
  return Boolean(config.username && config.password)
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

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeObjectKeys(record: SankhyaRawRecord) {
  const normalized: SankhyaRawRecord = {}
  for (const [key, value] of Object.entries(record)) normalized[key.toUpperCase()] = value
  return normalized
}

function extractServiceErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as SankhyaRawRecord
  const status = String(obj.status ?? '').trim()
  const statusMessage = String(obj.statusMessage ?? '').trim()
  if (!status && !statusMessage) return null
  if (status === '1' || status.toUpperCase() === 'SUCCESS') return null
  return statusMessage || `Falha no servico Sankhya (status ${status || 'desconhecido'}).`
}

function isUnauthorizedMessage(message: string) {
  return /n.o autorizado/i.test(message)
}

function collectRecords(payload: unknown, bucket: SankhyaRawRecord[]) {
  if (!payload || typeof payload !== 'object') return
  const obj = payload as SankhyaRawRecord

  const responseBody = (obj.responseBody ?? null) as SankhyaRawRecord | null
  const rows = responseBody?.rows
  const fieldsRaw = responseBody?.fields

  if (Array.isArray(rows) && rows.length > 0) {
    const row0 = rows[0]

    if (row0 && typeof row0 === 'object' && !Array.isArray(row0)) {
      for (const row of rows) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          bucket.push(normalizeObjectKeys(row as SankhyaRawRecord))
        }
      }
    } else if (Array.isArray(row0)) {
      const fields =
        Array.isArray(fieldsRaw) && fieldsRaw.length > 0
          ? fieldsRaw.map((field) => {
              if (typeof field === 'string') return field
              if (field && typeof field === 'object') {
                const f = field as SankhyaRawRecord
                return String(f.name ?? f.fieldName ?? f.FIELD_NAME ?? '')
              }
              return ''
            })
          : []

      for (const row of rows) {
        if (!Array.isArray(row)) continue
        const mapped: SankhyaRawRecord = {}
        if (fields.length > 0) {
          for (let i = 0; i < row.length; i += 1) {
            const key = String(fields[i] ?? `COL_${i + 1}`).toUpperCase()
            mapped[key] = row[i]
          }
        } else {
          for (let i = 0; i < row.length; i += 1) mapped[`COL_${i + 1}`] = row[i]
        }
        bucket.push(mapped)
      }
    }
  }

  for (const value of Object.values(obj)) collectRecords(value, bucket)
}

function toOrder(recordInput: SankhyaRawRecord): SankhyaOrder | null {
  const record = normalizeObjectKeys(recordInput)
  const sellerName =
    String(
      record.VENDEDOR ??
        record.APELIDO ??
        record.NOMEVEND ??
        record.NOME_VENDEDOR ??
        record.VENDEDOR_NOME ??
        ''
    ).trim() || 'Sem vendedor'

  const negotiatedAt = toIsoDate(
    record.DTNEG ?? record.DATA_NEGOCIACAO ?? record.DATANEGOCIACAO ?? record.DTMOV ?? record.DTMOVIMENTO
  )
  if (!negotiatedAt) return null

  const totalValue = parseNumber(record.VLRNOTA ?? record.VALOR_NOTA ?? record.VLR_TOTAL ?? record.VALORTOTAL)
  const grossWeight = parseNumber(record.PESOBRUTO ?? record.PESO_BRUTO ?? record.PESO)
  const sellerCode = String(record.CODVEND ?? record.VENDEDOR_CODIGO ?? record.CODIGO_VENDEDOR ?? '').trim()
  const partnerCode = String(record.CODPARC ?? record.PARCEIRO_CODIGO ?? '').trim()
  const orderNumber = String(record.NUNOTA ?? record.NUMNOTA ?? record.NUMERO_PEDIDO ?? record.PEDIDO ?? '').trim()

  return {
    sellerCode,
    sellerName,
    partnerCode,
    orderNumber,
    negotiatedAt,
    totalValue,
    grossWeight,
  }
}

function extractOrders(payload: unknown): SankhyaOrder[] {
  const records: SankhyaRawRecord[] = []
  collectRecords(payload, records)
  return records.map(toOrder).filter((entry): entry is SankhyaOrder => Boolean(entry))
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

function getSankhyaAuthOrigins(baseUrl: string) {
  const url = new URL(baseUrl)
  const host = url.hostname.toLowerCase()
  const localOrigin = url.origin.replace(/\/+$/, '')

  const production = 'https://api.sankhya.com.br'
  const sandbox = 'https://api.sandbox.sankhya.com.br'

  const candidates =
    host.includes('sandbox.sankhya.com.br')
      ? [sandbox, production, localOrigin]
      : host.includes('sankhya.com.br')
        ? [production, sandbox, localOrigin]
        : [production, sandbox, localOrigin]

  return [...new Set(candidates)]
}

function extractBearerToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as SankhyaRawRecord
  const candidates = [obj.access_token, obj.bearerToken, obj.token, obj.jwt]
  for (const token of candidates) {
    if (typeof token === 'string' && token.trim().length > 0) return token.trim()
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
    const authUrl = `${origin}/authenticate`
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': config.token,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) continue

    const bearer = extractBearerToken(payload)
    if (bearer) return bearer
  }

  return null
}

function extractJsessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as SankhyaRawRecord

  const directCandidates = [
    obj.jsessionid,
    (obj.responseBody as SankhyaRawRecord | undefined)?.jsessionid,
    (obj.responseBody as SankhyaRawRecord | undefined)?.JSESSIONID,
  ]

  for (const value of directCandidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (value && typeof value === 'object') {
      const boxed = value as SankhyaRawRecord
      if (typeof boxed.$ === 'string' && boxed.$.trim().length > 0) return boxed.$.trim()
    }
  }

  for (const value of Object.values(obj)) {
    const nested = extractJsessionId(value)
    if (nested) return nested
  }
  return null
}

async function loginLegacy(config: SankhyaConfig, baseUrl: string): Promise<string> {
  if (!config.username || !config.password) {
    throw new Error('Credenciais legadas incompletas (username/password).')
  }

  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`
  const payload = {
    serviceName: 'MobileLoginSP.login',
    requestBody: {
      NOMUSU: { $: config.username },
      INTERNO: { $: config.password },
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Falha no login legado (HTTP ${response.status}).`)

  const serviceError = extractServiceErrorMessage(data)
  if (serviceError) throw new Error(`Falha no login legado: ${serviceError}`)

  const jsessionid = extractJsessionId(data)
  if (!jsessionid) throw new Error('Login legado sem jsessionid retornado.')
  return jsessionid
}

async function logoutLegacy(baseUrl: string, jsessionid: string, appKey?: string | null) {
  const appKeyParam = appKey ? `&appkey=${encodeURIComponent(appKey)}` : ''
  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.logout&outputType=json&jsessionid=${encodeURIComponent(jsessionid)}${appKeyParam}`
  await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceName: 'MobileLoginSP.logout', requestBody: {} }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)
}

function buildSankhyaHeaders(config: SankhyaConfig, bearerToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
  }

  if (config.username && config.password) {
    const basic = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    if (!headers.Authorization) headers.Authorization = `Basic ${basic}`
  }

  if (config.appKey) {
    headers.appkey = config.appKey
    headers.AppKey = config.appKey
  }
  if (config.token) headers['X-Token'] = config.token
  if (config.token) headers.token = config.token
  return headers
}

function getSankhyaQueryEndpoints(
  baseUrl: string,
  opts?: { appKey?: string | null; jsessionid?: string | null; hasBearer?: boolean }
) {
  const appKeyParam = opts?.appKey ? `&appkey=${encodeURIComponent(opts.appKey)}` : ''
  const jsessionParam = opts?.jsessionid ? `&jsessionid=${encodeURIComponent(opts.jsessionid)}` : ''
  const query = `serviceName=DbExplorerSP.executeQuery&outputType=json${jsessionParam}${appKeyParam}`
  const endpoints = [`${baseUrl}/mge/service.sbr?${query}`]

  // Compatibilidade PALETIN/OAuth: tenta tambem gateway fixo Sankhya.
  if (opts?.hasBearer && !opts?.jsessionid) {
    endpoints.push(`https://api.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sankhya.com.br/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sandbox.sankhya.com.br/mge/service.sbr?${query}`)
  }

  return [...new Set(endpoints)]
}

async function runSankhyaQuery(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  opts?: { jsessionid?: string | null; appKey?: string | null }
) {
  const endpoints = getSankhyaQueryEndpoints(baseUrl, {
    appKey: opts?.appKey,
    jsessionid: opts?.jsessionid,
    hasBearer: /^Bearer\s+/i.test(headers.Authorization ?? ''),
  })
  const payloads: unknown[] = [
    {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql },
    },
    {
      requestBody: { sql },
    },
    {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { statement: sql },
    },
  ]

  const failures: string[] = []
  let hadAuthorizedResponse = false
  let unauthorizedFailures = 0

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(18_000),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        failures.push(`${endpoint}: HTTP ${response.status}`)
        continue
      }

      const serviceError = extractServiceErrorMessage(data)
      if (serviceError) {
        if (isUnauthorizedMessage(serviceError)) unauthorizedFailures += 1
        failures.push(`${endpoint}: ${serviceError}`)
        continue
      }

      hadAuthorizedResponse = true
      const orders = extractOrders(data)
      if (orders.length > 0) return orders
      failures.push(`${endpoint}: resposta sem linhas de pedidos`)
    }
  }

  if (hadAuthorizedResponse) {
    // Houve consulta autorizada, apenas sem dados no período/filtro.
    return []
  }

  const normalized = failures.join(' | ') || 'sem detalhes'
  if (unauthorizedFailures > 0 && unauthorizedFailures === failures.length) {
    throw new Error(
      'Sankhya recusou a consulta SQL (Nao autorizado). Verifique permissoes do integrador para DbExplorerSP.executeQuery.'
    )
  }

  throw new Error(`Nao foi possivel consultar pedidos no Sankhya (${normalized}).`)
}

function parseYearMonth(req: NextRequest) {
  const now = new Date()
  const yearRaw = req.nextUrl.searchParams.get('year')
  const monthRaw = req.nextUrl.searchParams.get('month')

  const parsedYear = Number(yearRaw)
  const parsedMonth = Number(monthRaw)

  const year = Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear()
  const month = Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(year, month, 1)
  const endDateExclusive = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`

  return { year, month, startDate, endDateExclusive }
}

function makeSql(
  startDate: string,
  endDateExclusive: string,
  mode: 'STRICT_SALES' | 'FALLBACK_ANY_MOVEMENT' = 'STRICT_SALES'
) {
  const filters = [
    mode === 'STRICT_SALES' ? "CAB.TIPMOV IN ('V', 'P', 'O')" : null,
    `CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')`,
    `CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')`,
    `NVL(CAB.STATUSNOTA, 'L') <> 'C'`,
    `NVL(CAB.CODVEND, 0) > 0`,
  ]
    .filter(Boolean)
    .join('\n  AND ')

  return `
SELECT
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DTNEG,
  NVL(VEN.APELIDO, 'SEM VENDEDOR') AS VENDEDOR,
  TO_CHAR(NVL(CAB.CODVEND, 0)) AS CODVEND,
  TO_CHAR(NVL(CAB.CODPARC, 0)) AS CODPARC,
  TO_CHAR(CAB.NUNOTA) AS NUNOTA,
  NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
  NVL(CAB.PESOBRUTO, 0) AS PESOBRUTO
FROM TGFCAB CAB
LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
WHERE ${filters}
ORDER BY CAB.DTNEG DESC
`.trim()
}

function shiftIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const { year, month, startDate, endDateExclusive } = parseYearMonth(req)
  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
  })

  if (!integration || !integration.baseUrl) {
    return NextResponse.json(
      {
        message: 'Nenhuma integracao Sankhya ativa foi encontrada.',
      },
      { status: 412 }
    )
  }

  const config = parseStoredConfig(integration.configEncrypted)
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) {
    return NextResponse.json({ message: 'A integracao Sankhya ativa esta sem URL valida.' }, { status: 412 })
  }

  try {
    const authMode = config.authMode ?? 'OAUTH2'
    const bearerToken = authMode === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
    const headers = buildSankhyaHeaders(config, bearerToken)
    const sql = makeSql(startDate, endDateExclusive, 'STRICT_SALES')
    let orders: SankhyaOrder[] = []

    try {
      orders = await runSankhyaQuery(baseUrl, headers, sql, { appKey: config.appKey ?? config.token ?? null })
    } catch (primaryError) {
      const message = primaryError instanceof Error ? primaryError.message : String(primaryError ?? '')
      if (!isUnauthorizedMessage(message) || !hasLegacyCredentials(config)) throw primaryError

      const appKey = config.appKey ?? config.token ?? null
      const jsessionid = await loginLegacy(config, baseUrl)
      try {
        orders = await runSankhyaQuery(
          baseUrl,
          { Accept: 'application/json', 'Content-Type': 'application/json' },
          sql,
          { jsessionid, appKey }
        )
      } finally {
        await logoutLegacy(baseUrl, jsessionid, appKey)
      }
    }

    // Fallback: se o ambiente usar TIPMOV fora do padrão comercial, tenta sem filtro de TIPMOV.
    if (orders.length === 0) {
      const fallbackSql = makeSql(startDate, endDateExclusive, 'FALLBACK_ANY_MOVEMENT')
      try {
        orders = await runSankhyaQuery(baseUrl, headers, fallbackSql, {
          appKey: config.appKey ?? config.token ?? null,
        })
      } catch {
        // mantém vazio para seguir diagnóstico normal sem quebrar resposta
      }
    }

    const allowlist = await readSellerAllowlist()
    const allowedSellers = getActiveAllowedSellersFromList(allowlist)
    const filteredOrders = orders.filter((order) =>
      matchesAllowedSeller(order.sellerCode, order.sellerName, order.partnerCode, allowlist)
    )

    let recentOrdersHint: {
      lookbackStartDate: string
      lookbackEndDateExclusive: string
      totalOrders: number
      lastOrderDate: string | null
    } | null = null

    if (filteredOrders.length === 0) {
      const lookbackStartDate = shiftIsoDate(startDate, -90)
      try {
        const lookbackSql = makeSql(lookbackStartDate, endDateExclusive)
        const lookbackOrders = await runSankhyaQuery(baseUrl, headers, lookbackSql, {
          appKey: config.appKey ?? config.token ?? null,
        })
        const filteredLookback = lookbackOrders.filter((order) =>
          matchesAllowedSeller(order.sellerCode, order.sellerName, order.partnerCode, allowlist)
        )
        const lastOrderDate =
          filteredLookback.length > 0
            ? filteredLookback
                .map((order) => order.negotiatedAt)
                .sort((a, b) => b.localeCompare(a))[0] ?? null
            : null

        recentOrdersHint = {
          lookbackStartDate,
          lookbackEndDateExclusive: endDateExclusive,
          totalOrders: filteredLookback.length,
          lastOrderDate,
        }
      } catch {
        recentOrdersHint = null
      }
    }

    const sellersMap = new Map<
      string,
      {
        id: string
        name: string
        login: string
        orders: Array<{ orderNumber: string; negotiatedAt: string; totalValue: number; grossWeight: number }>
        totalValue: number
        totalGrossWeight: number
      }
    >()

    for (const order of filteredOrders) {
      const normalizedName = order.sellerName.trim() || 'Sem vendedor'
      const sellerKey = `${order.sellerCode || '0'}::${normalizedName.toUpperCase()}`
      const sellerId = order.sellerCode
        ? `sankhya-${order.sellerCode}`
        : `sankhya-${normalizedName.toLowerCase().replace(/\s+/g, '-')}`
      const sellerLogin = makeSellerLogin(normalizedName, sellerId)

      if (!sellersMap.has(sellerKey)) {
        sellersMap.set(sellerKey, {
          id: sellerId,
          name: normalizedName,
          login: sellerLogin || sellerId,
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
      })
      seller.totalValue += order.totalValue
      seller.totalGrossWeight += order.grossWeight
    }

    // Garante presenca da lista corporativa mesmo quando o vendedor estiver sem pedidos no periodo.
    for (const allowedSeller of allowedSellers) {
      const normalizedName = allowedSeller.name.trim() || 'Sem vendedor'
      const sellerKey = `${allowedSeller.code || '0'}::${normalizedName.toUpperCase()}`
      if (sellersMap.has(sellerKey)) continue

      const sellerId = allowedSeller.code
        ? `sankhya-${allowedSeller.code}`
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
      .map((seller) => ({
        ...seller,
        totalOrders: seller.orders.length,
      }))
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
        selectedMonthOrders: filteredOrders.length,
        selectedMonthOrdersAllSellers: orders.length,
        recentOrdersHint,
      },
      sellers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar pedidos no Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
