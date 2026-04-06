import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type SankhyaOrder = {
  sellerCode: string
  sellerName: string
  orderNumber: string
  negotiatedAt: string
  totalValue: number
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

function normalizeObjectKeys(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) normalized[key.toUpperCase()] = value
  return normalized
}

function collectObjectArrays(payload: unknown, bucket: Array<Record<string, unknown>[]>) {
  if (!payload) return
  if (Array.isArray(payload)) {
    if (payload.length > 0 && payload.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))) {
      bucket.push(payload as Array<Record<string, unknown>>)
    }
    for (const entry of payload) collectObjectArrays(entry, bucket)
    return
  }
  if (typeof payload !== 'object') return
  for (const value of Object.values(payload as Record<string, unknown>)) collectObjectArrays(value, bucket)
}

function toOrder(row: Record<string, unknown>): SankhyaOrder | null {
  const record = normalizeObjectKeys(row)
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
  const sellerCode = String(record.CODVEND ?? record.VENDEDOR_CODIGO ?? record.CODIGO_VENDEDOR ?? '').trim()
  const orderNumber = String(record.NUNOTA ?? record.NUMNOTA ?? record.NUMERO_PEDIDO ?? record.PEDIDO ?? '').trim()

  return {
    sellerCode,
    sellerName,
    orderNumber,
    negotiatedAt,
    totalValue,
  }
}

function extractOrders(payload: unknown): SankhyaOrder[] {
  const arrays: Array<Record<string, unknown>[]> = []
  collectObjectArrays(payload, arrays)
  const orders = arrays.flatMap((rows) => rows.map(toOrder).filter((entry): entry is SankhyaOrder => Boolean(entry)))
  return orders
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
  const obj = payload as Record<string, unknown>
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
  return headers
}

async function runSankhyaQuery(baseUrl: string, headers: Record<string, string>, sql: string) {
  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`
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

  for (const payload of payloads) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(18_000),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      failures.push(`HTTP ${response.status}`)
      continue
    }

    const orders = extractOrders(data)
    if (orders.length > 0) return orders

    failures.push('resposta sem linhas de pedidos')
  }

  throw new Error(`Não foi possível consultar pedidos no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
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

function makeSql(startDate: string, endDateExclusive: string) {
  return `
SELECT
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DTNEG,
  NVL(VEN.APELIDO, 'SEM VENDEDOR') AS VENDEDOR,
  TO_CHAR(NVL(CAB.CODVEND, 0)) AS CODVEND,
  TO_CHAR(CAB.NUNOTA) AS NUNOTA,
  NVL(CAB.VLRNOTA, 0) AS VLRNOTA
FROM TGFCAB CAB
LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
WHERE CAB.TIPMOV = 'P'
  AND CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
ORDER BY CAB.DTNEG DESC
`.trim()
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
        message: 'Nenhuma integração Sankhya ativa foi encontrada.',
      },
      { status: 412 }
    )
  }

  const config = parseStoredConfig(integration.configEncrypted)
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) {
    return NextResponse.json({ message: 'A integração Sankhya ativa está sem URL válida.' }, { status: 412 })
  }

  try {
    const authMode = config.authMode ?? 'OAUTH2'
    const bearerToken = authMode === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
    const headers = buildSankhyaHeaders(config, bearerToken)
    const sql = makeSql(startDate, endDateExclusive)
    const orders = await runSankhyaQuery(baseUrl, headers, sql)

    const sellersMap = new Map<
      string,
      {
        id: string
        name: string
        login: string
        orders: Array<{ orderNumber: string; negotiatedAt: string; totalValue: number }>
        totalValue: number
      }
    >()

    for (const order of orders) {
      const normalizedName = order.sellerName.trim() || 'Sem vendedor'
      const sellerKey = `${order.sellerCode || '0'}::${normalizedName.toUpperCase()}`
      const sellerId = order.sellerCode ? `sankhya-${order.sellerCode}` : `sankhya-${normalizedName.toLowerCase().replace(/\s+/g, '-')}`
      const sellerLogin = normalizedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')

      if (!sellersMap.has(sellerKey)) {
        sellersMap.set(sellerKey, {
          id: sellerId,
          name: normalizedName,
          login: sellerLogin || sellerId,
          orders: [],
          totalValue: 0,
        })
      }

      const seller = sellersMap.get(sellerKey)!
      seller.orders.push({
        orderNumber: order.orderNumber,
        negotiatedAt: order.negotiatedAt,
        totalValue: order.totalValue,
      })
      seller.totalValue += order.totalValue
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
      sellers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar pedidos no Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
