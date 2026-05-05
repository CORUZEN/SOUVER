import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { authenticateSankhyaCached } from '@/lib/integrations/sankhya-auth'

type RawRecord = Record<string, unknown>

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

export type OrderItem = {
  productCode: string
  productName: string
  group: string
  unit: string
  quantity: number
  volume: number
  weightKg: number
}

export type OrderType = 'VENDA' | 'BONIFICACAO' | 'TROCA' | 'OUTROS'

export type DailyOrder = {
  orderNumber: string
  sellerCode: string
  sellerName: string
  partnerCode: string
  clientName: string
  city: string
  uf: string
  orderType: OrderType
  orderTypeRaw: string
  tipMov: string
  codTipOper: string
  dtNeg: string
  aprovado: string
  pendente: string
  statusNota: string
  items: OrderItem[]
}

export type ProductSummary = {
  productCode: string
  productName: string
  group: string
  unit: string
  totalQuantity: number
  totalWeightKg: number
  stockQty: number
}

export type FaturamentoResponse = {
  source: 'sankhya'
  date: string
  totalOrders: number
  totalClients: number
  orders: DailyOrder[]
  products: ProductSummary[]
  diagnostics: {
    orderRows: number
    stockRows: number
    sellersUsed: number[]
    endpointUsed?: string
    queryError?: string | null
    queryMode?: 'no_date' | 'pending' | 'status_p' | 'all' | 'failed' | string
    dateFrom?: string
    dateTo?: string
    sqlPreview?: string
  }
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

/* ─────────────────────────────────────────────
   Auth & headers  (mirrors sellers-performance)
───────────────────────────────────────────── */

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
    } catch {
      /* next origin */
    }
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
      typeof respBody.jsessionid === 'string' ? respBody.jsessionid
      : typeof respBody.JSESSIONID === 'string' ? respBody.JSESSIONID
      : typeof respBody.callID === 'string' ? respBody.callID
      : typeof respBody.bearerToken === 'string' ? respBody.bearerToken
      : null
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

function getSqlEndpoints(baseUrl: string, appKey?: string | null, hasBearer = false, sessionId?: string | null) {
  const appKeyParam = appKey ? `&appkey=${encodeURIComponent(appKey)}` : ''
  const sessionParam = sessionId ? `&jsessionid=${encodeURIComponent(sessionId)}` : ''
  const query = `serviceName=DbExplorerSP.executeQuery&outputType=json${appKeyParam}`
  if (hasBearer) {
    return [
      `https://api.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`,
      `${baseUrl}/mge/service.sbr?${query}${sessionParam}`,
    ]
  }
  return [`${baseUrl}/mge/service.sbr?${query}${sessionParam}`]
}

function extractServiceError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as RawRecord
  const status = String(obj.status ?? '').trim()
  const statusMessage = String(obj.statusMessage ?? '').trim()
  if (!status && !statusMessage) return null
  // Status '0' is success, but if statusMessage contains an exception, it's an error
  if (status === '0' && statusMessage && !statusMessage.toLowerCase().includes('sucesso') && !statusMessage.toLowerCase().includes('success')) {
    return statusMessage
  }
  if (status === '1' || status.toUpperCase() === 'SUCCESS') return null
  return statusMessage || `Falha no servico Sankhya (status ${status || 'desconhecido'}).`
}

function collectRecords(obj: unknown, bucket: RawRecord[]): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as RawRecord
        if (('fieldsMetadata' in rec || 'fields' in rec) && 'rows' in rec) {
          const fieldsRaw = Array.isArray(rec.fieldsMetadata)
            ? rec.fieldsMetadata
            : Array.isArray(rec.fields)
              ? rec.fields
              : []
          const fields: string[] = fieldsRaw.map((f: unknown) => {
            if (typeof f === 'string') return f
            if (f && typeof f === 'object') {
              const fo = f as RawRecord
              return String(fo.name ?? fo.fieldName ?? fo.FIELD_NAME ?? '')
            }
            return ''
          })
          const rowsRaw = Array.isArray(rec.rows) ? rec.rows : []
          for (const row of rowsRaw) {
            if (Array.isArray(row)) {
              const mapped: RawRecord = {}
              for (let i = 0; i < row.length; i++) mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
              bucket.push(mapped)
            } else if (row && typeof row === 'object') {
              bucket.push(row as RawRecord)
            }
          }
        } else {
          bucket.push(rec)
        }
      } else {
        collectRecords(item, bucket)
      }
    }
    return
  }
  const objRec = obj as RawRecord
  if (('fieldsMetadata' in objRec || 'fields' in objRec) && 'rows' in objRec) {
    const fieldsRaw = Array.isArray(objRec.fieldsMetadata)
      ? objRec.fieldsMetadata
      : Array.isArray(objRec.fields)
        ? objRec.fields
        : []
    const fields: string[] = fieldsRaw.map((f: unknown) => {
      if (typeof f === 'string') return f
      if (f && typeof f === 'object') {
        const fo = f as RawRecord
        return String(fo.name ?? fo.fieldName ?? fo.FIELD_NAME ?? '')
      }
      return ''
    })
    const rowsRaw = Array.isArray(objRec.rows) ? objRec.rows : []
    for (const row of rowsRaw) {
      if (!Array.isArray(row)) continue
      const mapped: RawRecord = {}
      for (let i = 0; i < row.length; i += 1) mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
      bucket.push(mapped)
    }
  }
  for (const value of Object.values(objRec)) collectRecords(value, bucket)
}

async function queryRows(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  appKey?: string | null,
  options?: { allowEmpty?: boolean }
): Promise<RawRecord[]> {
  const failures: string[] = []
  let hadSuccess = false
  const payloadVariants = [
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
    { requestBody: { sql } },
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { statement: sql } },
  ]
  const bearerToken = headers.Authorization?.replace(/^Bearer\s+/i, '') ?? null
  for (const endpoint of getSqlEndpoints(baseUrl, appKey, /^Bearer\s+/i.test(headers.Authorization ?? ''), bearerToken)) {
    for (const payload of payloadVariants) {
      try {
        const fetchHeaders = { ...headers }
        // For local endpoint, pass sessionId as cookie
        if (endpoint.includes('ouroverde.nuvemdatacom.com.br') && bearerToken) {
          fetchHeaders.Cookie = `JSESSIONID=${bearerToken}`
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) { failures.push(`HTTP ${response.status}`); continue }
        const serviceError = extractServiceError(data)
        if (serviceError) { failures.push(serviceError); continue }
        hadSuccess = true
        const records: RawRecord[] = []
        collectRecords(data, records)
        if (records.length > 0) return records
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'rede')
      }
    }
  }
  if (hadSuccess && options?.allowEmpty) return []
  throw new Error(`Sankhya query falhou (${failures.join(' | ') || 'sem detalhes'})`)
}

/* ─────────────────────────────────────────────
   SQL builders
───────────────────────────────────────────── */

function buildOpenOrdersSql(dateFrom: string, dateTo: string, sellerCodes: number[]): string {
  const codList = sellerCodes.join(', ')
  const sellerFilter = sellerCodes.length > 0 ? `AND CAB.CODVEND IN (${codList})` : ''

  return `
SELECT
  TO_CHAR(CAB.NUNOTA)                        AS NUNOTA,
  TO_CHAR(CAB.CODVEND)                       AS CODVEND,
  UPPER(TRIM(NVL(VEN.APELIDO, 'SEM VENDEDOR'))) AS VENDEDOR,
  TO_CHAR(CAB.CODPARC)                       AS CODPARC,
  UPPER(TRIM(PAR.NOMEPARC))                  AS CLIENTE,
  UPPER(TRIM(NVL(CID.NOMECID, 'SEM CIDADE'))) AS CIDADE,
  UPPER(TRIM(NVL(UF.UF, '')))                AS UF,
  TRIM(TO_CHAR(CAB.CODTIPOPER, 'FM9999999999')) AS CODTIPOPER,
  UPPER(TRIM(CAB.TIPMOV))                    AS TIPMOV,
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD')           AS DTNEG,
  TO_CHAR(I.CODPROD)                         AS CODPROD,
  UPPER(TRIM(P.DESCRPROD))                   AS PRODUTO,
  UPPER(TRIM(NVL(P.MARCA, '')))              AS GRUPO,
  UPPER(TRIM(TO_CHAR(P.CODVOL)))             AS UNIDADE,
  NVL(P.MEDAUX, 1)                           AS MEDAUX,
  SUM(I.QTDNEG)                              AS QUANTIDADE,
  SUM(NVL(I.QTDVOL, 0))                      AS VOLUME,
  SUM(NVL(I.PESO, NVL(P.PESOBRUTO, 0) * I.QTDNEG)) AS PESO_KG,
  NVL(TOP.BONIFICACAO, 'N')                  AS BONIFICACAO,
  NVL(CAB.APROVADO, 'N')                     AS APROVADO,
  NVL(CAB.PENDENTE, 'N')                     AS PENDENTE,
  NVL(CAB.STATUSNOTA, 'L')                   AS STATUSNOTA
FROM TGFCAB CAB
INNER JOIN TGFITE I   ON I.NUNOTA   = CAB.NUNOTA
INNER JOIN TGFPRO P   ON P.CODPROD  = I.CODPROD
INNER JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
INNER JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
LEFT  JOIN TSICID CID ON CID.CODCID = PAR.CODCID
LEFT  JOIN TSIUFS UF  ON UF.CODUF   = CID.UF
LEFT  JOIN TGFTOP TOP ON TOP.CODTIPOPER = CAB.CODTIPOPER
  AND TOP.DHALTER = (SELECT MAX(DHALTER) FROM TGFTOP WHERE CODTIPOPER = CAB.CODTIPOPER)
WHERE CAB.CODVEND > 0
  AND CAB.CODTIPOPER IN (1001, 1051, 1053)
  AND NVL(CAB.PENDENTE, 'N') = 'S'
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.DTNEG >= TO_DATE('${dateFrom}', 'YYYY-MM-DD')
  AND CAB.DTNEG <= TO_DATE('${dateTo}', 'YYYY-MM-DD')
  ${sellerFilter}
GROUP BY CAB.NUNOTA, CAB.CODVEND, VEN.APELIDO, CAB.CODPARC, PAR.NOMEPARC,
         CID.NOMECID, UF.UF, CAB.CODTIPOPER, CAB.TIPMOV, CAB.DTNEG,
         I.CODPROD, P.DESCRPROD, P.MARCA, P.CODVOL, P.MEDAUX, TOP.BONIFICACAO,
         CAB.APROVADO, CAB.PENDENTE, CAB.STATUSNOTA
ORDER BY CAB.DTNEG DESC, VEN.APELIDO, CID.NOMECID, CAB.NUNOTA, I.CODPROD
`.trim()
}

function buildStockSql(productCodes: string[]): string {
  const codList = productCodes.map(Number).filter(Boolean).join(', ')
  const productFilter = codList ? `AND E.CODPROD IN (${codList})` : ''
  return `
SELECT
  TO_CHAR(E.CODPROD) AS CODPROD,
  SUM(NVL(E.ESTOQUE, 0)) AS ESTOQUE_ATUAL
FROM TGFEST E
WHERE E.CODEMP = 1
  AND E.CODLOCAL IN (1004000, 2003000, 3003000, 4003000)
  ${productFilter}
GROUP BY E.CODPROD
`.trim()
}

/* ─────────────────────────────────────────────
   Row parsers
───────────────────────────────────────────── */

type RawItemRow = {
  nunota: string
  sellerCode: string
  sellerName: string
  partnerCode: string
  clientName: string
  city: string
  uf: string
  codTipOper: string
  dhTipOper: string
  tipMov: string
  dtNeg: string
  aprovado: string
  pendente: string
  statusNota: string
  productCode: string
  productName: string
  group: string
  unit: string
  prdUnit: string
  medaux: number
  convervol: number
  fattotal: number
  quantity: number
  volume: number
  weightKg: number
}

function classifyOrderType(codTipOper: string): OrderType {
  const cto = String(codTipOper).trim()
  if (cto === '1001') return 'VENDA'
  if (cto === '1051') return 'BONIFICACAO'
  if (cto === '1053') return 'TROCA'
  return 'OUTROS'
}

// Extrai fator de embalagem do nome do produto: "20X500G" → 20, "12X1KG" → 12
function parsePackagingFactor(productName: string): number {
  const m = productName.match(/\b(\d+)[Xx]\d/)
  const n = m ? parseInt(m[1], 10) : 1
  return n > 1 ? n : 1
}

function parseItemRow(r: RawRecord): RawItemRow {
  return {
    nunota: String(r.NUNOTA ?? '').trim(),
    sellerCode: String(r.CODVEND ?? '').trim(),
    sellerName: String(r.VENDEDOR ?? r.APELIDO ?? '').trim() || 'SEM VENDEDOR',
    partnerCode: String(r.CODPARC ?? '').trim(),
    clientName: String(r.CLIENTE ?? r.NOMEPARC ?? '').trim() || 'SEM CLIENTE',
    city: String(r.CIDADE ?? '').trim() || 'SEM CIDADE',
    uf: String(r.UF ?? '').trim(),
    codTipOper: String(r.CODTIPOPER ?? '').trim(),
    dhTipOper: String(r.DHTIPOPER ?? '').trim(),
    tipMov: String(r.TIPMOV ?? '').trim(),
    dtNeg: String(r.DTNEG ?? '').trim(),
    aprovado: String(r.APROVADO ?? '').trim(),
    pendente: String(r.PENDENTE ?? '').trim(),
    statusNota: String(r.STATUSNOTA ?? '').trim(),
    productCode: String(r.CODPROD ?? '').trim(),
    productName: String(r.PRODUTO ?? r.DESCRPROD ?? '').trim(),
    group: String(r.GRUPO ?? r.MARCA ?? '').trim(),
    unit: String(r.UNIDADE ?? r.CODVOL ?? '').trim(),
    prdUnit: String(r.PRD_UNIDADE ?? r.CODVOL ?? '').trim(),
    medaux: Math.max(1, parseNumber(r.MEDAUX) || 1),
    convervol: Math.max(1, parseNumber(r.CONVERVOL) || 1),
    fattotal: Math.max(1, parseNumber(r.FATTOTAL) || 1),
    quantity: parseNumber(r.QUANTIDADE ?? r.QTDNEG),
    volume: parseNumber(r.VOLUME ?? r.QTDVOL),
    weightKg: parseNumber(r.PESO_KG ?? r.PESOBRUTO),
  }
}

/* ─────────────────────────────────────────────
   GET handler
───────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    const dateFromParam = searchParams.get('dateFrom') ?? dateParam
    const dateToParam = searchParams.get('dateTo') ?? dateParam
    const sellersParam = searchParams.get('sellers') ?? ''
    const sellerCodes: number[] = sellersParam
      ? sellersParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      : []

    // Validate dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateFromParam) || !dateRegex.test(dateToParam)) {
      return NextResponse.json({ error: 'Parâmetro dateFrom/dateTo inválido (YYYY-MM-DD)' }, { status: 400 })
    }

    // Load integration config
    const integration = await prisma.integration.findFirst({
      where: { provider: 'sankhya', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, baseUrl: true, configEncrypted: true },
    })

    if (!integration?.configEncrypted) {
      return NextResponse.json({ error: 'Integração Sankhya não configurada' }, { status: 503 })
    }

    const config = parseStoredConfig(integration.configEncrypted)
    if (!config) {
      return NextResponse.json({ error: 'Configuração Sankhya inválida' }, { status: 503 })
    }

    const baseUrl = normalizeBaseUrl(integration.baseUrl ?? '')

    if (!baseUrl) {
      return NextResponse.json({ error: 'URL base do Sankhya não configurada' }, { status: 503 })
    }

    // Authenticate (cached)
    const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)

    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey || config.token || null

    // Query open orders + items
    let rawRows: RawRecord[] = []
    let queryError: string | null = null
    try {
      const sql = buildOpenOrdersSql(dateFromParam, dateToParam, sellerCodes)
      rawRows = await queryRows(baseUrl, headers, sql, appKey, { allowEmpty: true })
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Query falhou'
    }

    // Parse rows into order map
    const orderMap = new Map<string, DailyOrder>()
    for (const r of rawRows) {
      const row = parseItemRow(r)
      if (!row.nunota || !row.productCode) continue

      if (!orderMap.has(row.nunota)) {
        const orderType = classifyOrderType(row.codTipOper)
        orderMap.set(row.nunota, {
          orderNumber: row.nunota,
          sellerCode: row.sellerCode,
          sellerName: row.sellerName,
          partnerCode: row.partnerCode,
          clientName: row.clientName,
          city: row.city,
          uf: row.uf,
          orderType,
          orderTypeRaw: `${row.tipMov}|${row.codTipOper}`,
          tipMov: row.tipMov,
          codTipOper: row.codTipOper,
          dtNeg: row.dtNeg,
          aprovado: row.aprovado,
          pendente: row.pendente,
          statusNota: row.statusNota,
          items: [],
        })
      }
      orderMap.get(row.nunota)!.items.push({
        productCode: row.productCode,
        productName: row.productName,
        group: row.group,
        // Conversão FD→UN apenas em Pedidos de Troca (1053)
        // Ex.: 0.35 FD × 20 (do nome "20X500G") = 7 UN
        ...(() => {
          const isTroca = row.codTipOper === '1053'
          const factor = isTroca
            ? (row.convervol > 1 ? row.convervol
              : row.fattotal > 1 ? row.fattotal
              : row.medaux > 1 ? row.medaux
              : parsePackagingFactor(row.productName))
            : 1
          return {
            unit: factor > 1 ? 'UN' : row.unit,
            quantity: factor > 1 ? Math.round(row.quantity * factor) : row.quantity,
          }
        })(),
        volume: row.volume,
        weightKg: row.weightKg,
      })
    }

    const orders = Array.from(orderMap.values())

    // Collect unique product codes
    const productCodes = [...new Set(rawRows.map((r) => String(r.CODPROD ?? '').trim()).filter(Boolean))]

    // Query stock
    let stockRows: RawRecord[] = []
    if (productCodes.length > 0) {
      try {
        stockRows = await queryRows(baseUrl, headers, buildStockSql(productCodes), appKey, { allowEmpty: true })
      } catch {
        stockRows = []
      }
    }

    const stockMap = new Map<string, number>()
    for (const r of stockRows) {
      const code = String(r.CODPROD ?? '').trim()
      const qty = parseNumber(r.ESTOQUE_ATUAL ?? r.ESTOQUE)
      if (code) stockMap.set(code, qty)
    }

    // Build product summary (no client exclusion — that happens client-side)
    const productTotals = new Map<string, ProductSummary>()
    for (const order of orders) {
      for (const item of order.items) {
        const existing = productTotals.get(item.productCode)
        if (existing) {
          existing.totalQuantity += item.quantity
          existing.totalWeightKg += item.weightKg
        } else {
          productTotals.set(item.productCode, {
            productCode: item.productCode,
            productName: item.productName,
            group: item.group,
            unit: item.unit,
            totalQuantity: item.quantity,
            totalWeightKg: item.weightKg,
            stockQty: stockMap.get(item.productCode) ?? 0,
          })
        }
      }
    }

    const products = Array.from(productTotals.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName)
    )

    const uniqueClients = new Set(orders.map((o) => o.partnerCode))
    const response: FaturamentoResponse = {
      source: 'sankhya',
      date: dateParam,
      totalOrders: orders.length,
      totalClients: uniqueClients.size,
      orders,
      products,
      diagnostics: {
        orderRows: rawRows.length,
        stockRows: stockRows.length,
        sellersUsed: sellerCodes,
        queryError,
        queryMode: 'direct',
        dateFrom: dateFromParam,
        dateTo: dateToParam,
        sqlPreview: buildOpenOrdersSql(dateFromParam, dateToParam, sellerCodes).slice(0, 500),
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[faturamento/route] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
