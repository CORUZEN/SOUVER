import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'
import { withRequestCache } from '@/lib/server/request-cache'
import { withConcurrencyLimit } from '@/lib/server/concurrency-limit'
import { observeRouteDuration, recordRouteRequest, recordRouteStatus } from '@/lib/server/telemetry'

type RawRecord = Record<string, unknown>

/**
 * Fetches targets configured in Sankhya's "Vidya Force - ConfiguraÃ§Ã£o de Performance"
 * custom screen for a given month/year.
 *
 * Tables:
 *   AD_TVDYCFGPFM   â€” main config per seller per month
 *   AD_TVDYVEN      â€” sellers linked to each config
 *   AD_TVDYDRTIPT   â€” financial (money) targets per config
 *   AD_TVDYPFMTOP   â€” weight (kg) targets per brand per config (primary)
 *   AD_TVDYPFMPRO   â€” weight (kg) targets per brand per config (secondary/fallback)
 *
 * Response shape:
 * {
 *   sellers: Array<{
 *     sellerCode: string
 *     sellerName: string
 *     financialTarget: number
 *     weightTargets: Array<{ brand: string; targetKg: number }>
 *   }>
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
  throw new Error(`Falha ao consultar metas do Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

/**
 * Discovers the FK/PK column pair to use in JOINs.
 *
 * Sankhya convention for custom screen tables (AD_*):
 *   - Parent PK : AD_TVDYCFGPFMID  (auto-sequence, system-generated)
 *   - Child FKs : AD_TVDYCFGPFMID  (same name in child tables)
 *
 * We query ALL_TAB_COLUMNS for BOTH parent and child tables so we can
 * correctly build the JOIN even if the names differ.
 */
async function discoverFkColumns(
  baseUrl: string,
  headers: Record<string, string>,
  appKey?: string | null,
): Promise<{ childFk: string; parentPk: string }> {
  // NUCFGPFM is the confirmed FK/PK from Sankhya schema inspection
  const DEFAULT = { childFk: 'NUCFGPFM', parentPk: 'NUCFGPFM' }
  try {
    const sql = `
SELECT TABLE_NAME, COLUMN_NAME
FROM ALL_TAB_COLUMNS
WHERE TABLE_NAME IN ('AD_TVDYCFGPFM', 'AD_TVDYDRTIPT', 'AD_TVDYPFMTOP', 'AD_TVDYPFMPRO', 'AD_TVDYVEN')
  AND (COLUMN_NAME LIKE 'AD_TVDYCFGPFM%' OR COLUMN_NAME LIKE 'NUCFG%' OR COLUMN_NAME = 'NROCONFIGURACAO')
ORDER BY TABLE_NAME, COLUMN_ID`.trim()

    const rows = await queryRows(baseUrl, headers, sql, appKey)
    if (rows.length === 0) return DEFAULT

    const colsByTable: Record<string, string[]> = {}
    for (const row of rows) {
      const tbl = String(row.TABLE_NAME ?? '').trim()
      const col = String(row.COLUMN_NAME ?? '').trim()
      if (!tbl || !col) continue
      if (!colsByTable[tbl]) colsByTable[tbl] = []
      colsByTable[tbl].push(col)
    }

    // Find FK in child tables â€” prefer NUCFG*, then AD_TVDYCFGPFM*, then NROCONFIGURACAO
    const childTables = ['AD_TVDYDRTIPT', 'AD_TVDYPFMPRO', 'AD_TVDYVEN', 'AD_TVDYPFMTOP']
    let childFk = ''
    for (const tbl of childTables) {
      const cols = colsByTable[tbl] ?? []
      const found = cols.find((c) => c.startsWith('NUCFG'))
        ?? cols.find((c) => c.startsWith('AD_TVDYCFGPFM'))
      if (found) { childFk = found; break }
    }
    if (!childFk) {
      for (const tbl of childTables) {
        if ((colsByTable[tbl] ?? []).includes('NROCONFIGURACAO')) { childFk = 'NROCONFIGURACAO'; break }
      }
    }
    if (!childFk) childFk = DEFAULT.childFk

    // Find matching PK in parent table
    const parentCols = colsByTable['AD_TVDYCFGPFM'] ?? []
    let parentPk = ''
    if (parentCols.includes(childFk)) {
      parentPk = childFk
    } else {
      parentPk = parentCols.find((c) => c.startsWith('NUCFG'))
        ?? parentCols.find((c) => c.startsWith('AD_TVDYCFGPFM'))
        ?? (parentCols.includes('NROCONFIGURACAO') ? 'NROCONFIGURACAO' : childFk)
    }
    if (!parentPk) parentPk = childFk

    return { childFk, parentPk }
  } catch { /* ALL_TAB_COLUMNS failed â€” use defaults */ }
  return DEFAULT
}

/**
 * Build SQL variants in priority order.
 *
 * Confirmed schema (from Sankhya admin panel):
 *   AD_TVDYCFGPFM  : NUCFGPFM (PK), DTINI, DTFIM, TITULO
 *   AD_TVDYVEN     : CODVEN (seller code â€” NOT CODVEND), NUCFGPFM (FK), GRUPO
 *   AD_TVDYDRTIPT  : NUCFGPFM (FK), META, TIPO (NUMBER â€” 1=performance), DIRETRIZ, PESO, PERCACRESC
 *   AD_TVDYPFMPRO  : NUCFGPFM (FK), MARCA, VALOR (weight targets â€” correct table)
 *   AD_TVDYPFMTOP  : NUCFGPFM (FK), CODTIPOPER, TIPO (VARCHAR2 â€” NOT a brand-weight table)
 */
function buildSqlVariants(
  type: 'financial' | 'weight',
  year: number,
  month: number,
  startDate: string,
  endDate: string,
  childFk: string,
  parentPk: string,
): string[] {
  const mm = String(month).padStart(2, '0')
  const yyyymm = `${year}-${mm}`

  // Financial: CODVEN (not CODVEND), no APELIDO, TIPO is NUMBER (not string)
  const makeFinancial = (cFk: string, pPk: string, dateExpr: string, tipoFilter: string) => `
SELECT
  TO_CHAR(VEN.CODVEN) AS CODVEND,
  TRIM(NVL(CFG.TITULO, TO_CHAR(VEN.CODVEN))) AS VENDEDOR,
  SUM(NVL(DIR.META, 0)) AS META_FINANCEIRA
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.${cFk} = CFG.${pPk}
INNER JOIN AD_TVDYDRTIPT DIR ON DIR.${cFk} = CFG.${pPk}
WHERE ${dateExpr}${tipoFilter}  AND VEN.CODVEN > 0
GROUP BY VEN.CODVEN, CFG.TITULO
ORDER BY VEN.CODVEN`.trim()

  // Weight: AD_TVDYPFMPRO has MARCA+VALOR; TIPO is VARCHAR2 in this table
  const makeWeight = (weightTable: string, cFk: string, pPk: string, dateExpr: string, tipoFilter: string) => `
SELECT
  TO_CHAR(VEN.CODVEN) AS CODVEND,
  TRIM(NVL(CFG.TITULO, TO_CHAR(VEN.CODVEN))) AS VENDEDOR,
  UPPER(NVL(TRIM(PRO.MARCA), 'SEM MARCA')) AS MARCA,
  SUM(NVL(PRO.VALOR, 0)) AS META_KG
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.${cFk} = CFG.${pPk}
INNER JOIN ${weightTable} PRO ON PRO.${cFk} = CFG.${pPk}
WHERE ${dateExpr}${tipoFilter}  AND VEN.CODVEN > 0
  AND TRIM(PRO.MARCA) IS NOT NULL
GROUP BY VEN.CODVEN, CFG.TITULO, PRO.MARCA
ORDER BY VEN.CODVEN, PRO.MARCA`.trim()

  // Date strategies â€” DTINI confirmed correct; DTINICIAL kept as legacy fallback
  const dtA = `CFG.DTINI >= TO_DATE('${startDate}', 'YYYY-MM-DD')\n  AND CFG.DTINI < TO_DATE('${endDate}', 'YYYY-MM-DD')\n`
  const dtB = `EXTRACT(YEAR FROM CFG.DTINI) = ${year}\n  AND EXTRACT(MONTH FROM CFG.DTINI) = ${month}\n`
  const dtC = `TO_CHAR(CFG.DTINI, 'YYYY-MM') = '${yyyymm}'\n`
  const dtD = `CFG.DTINICIAL >= TO_DATE('${startDate}', 'YYYY-MM-DD')\n  AND CFG.DTINICIAL < TO_DATE('${endDate}', 'YYYY-MM-DD')\n`
  const dtE = `EXTRACT(YEAR FROM CFG.DTINICIAL) = ${year}\n  AND EXTRACT(MONTH FROM CFG.DTINICIAL) = ${month}\n`

  // TIPO filters â€” financial TIPO is NUMBER; weight TIPO is VARCHAR2
  const noTipo = ''
  const numericTipo1 = `  AND DIR.TIPO = 1\n`           // AD_TVDYDRTIPT.TIPO is NUMBER
  const weightTipoPeso = `  AND UPPER(TRIM(NVL(PRO.TIPO, 'PESO'))) = 'PESO'\n`  // AD_TVDYPFMPRO.TIPO is VARCHAR2

  // JOIN strategies â€” NUCFGPFM confirmed; keep others as fallback
  const joins: [string, string][] = [
    ['NUCFGPFM', 'NUCFGPFM'],            // confirmed correct
    [childFk, parentPk],                 // discovered via ALL_TAB_COLUMNS
    ['AD_TVDYCFGPFMID', 'AD_TVDYCFGPFMID'], // legacy assumption
    ['NROCONFIGURACAO', 'NROCONFIGURACAO'],  // business key fallback
  ]

  const seen = new Set<string>()
  const variants: string[] = []

  const addFin = (cFk: string, pPk: string, dt: string, tipo: string) => {
    const sql = makeFinancial(cFk, pPk, dt, tipo)
    if (!seen.has(sql)) { seen.add(sql); variants.push(sql) }
  }
  const addWgt = (tbl: string, cFk: string, pPk: string, dt: string, tipo: string) => {
    const sql = makeWeight(tbl, cFk, pPk, dt, tipo)
    if (!seen.has(sql)) { seen.add(sql); variants.push(sql) }
  }

  if (type === 'financial') {
    // P1: known-correct (NUCFGPFM + DTINI) Ã— no TIPO filter (TIPO may be any numeric value)
    for (const dt of [dtA, dtB, dtC]) addFin('NUCFGPFM', 'NUCFGPFM', dt, noTipo)
    // P2: same + explicit numeric TIPO=1 (from observed data)
    for (const dt of [dtA, dtB, dtC]) addFin('NUCFGPFM', 'NUCFGPFM', dt, numericTipo1)
    // P3: all join fallbacks Ã— DTINI Ã— no TIPO
    for (const [cFk, pPk] of joins) for (const dt of [dtA, dtB, dtC]) addFin(cFk, pPk, dt, noTipo)
    // P4: all join fallbacks Ã— legacy DTINICIAL Ã— no TIPO
    for (const [cFk, pPk] of joins) for (const dt of [dtD, dtE]) addFin(cFk, pPk, dt, noTipo)
  } else {
    // P1: AD_TVDYPFMPRO (confirmed has MARCA+VALOR) + NUCFGPFM + DTINI Ã— no TIPO
    for (const dt of [dtA, dtB, dtC]) addWgt('AD_TVDYPFMPRO', 'NUCFGPFM', 'NUCFGPFM', dt, noTipo)
    // P2: same + PESO varchar TIPO filter
    for (const dt of [dtA, dtB, dtC]) addWgt('AD_TVDYPFMPRO', 'NUCFGPFM', 'NUCFGPFM', dt, weightTipoPeso)
    // P3: all join fallbacks Ã— AD_TVDYPFMPRO Ã— DTINI Ã— no TIPO
    for (const [cFk, pPk] of joins) for (const dt of [dtA, dtB, dtC]) addWgt('AD_TVDYPFMPRO', cFk, pPk, dt, noTipo)
    // P4: legacy DTINICIAL Ã— fallbacks
    for (const [cFk, pPk] of joins) for (const dt of [dtD, dtE]) addWgt('AD_TVDYPFMPRO', cFk, pPk, dt, noTipo)
    // P5: AD_TVDYPFMTOP last resort (different structure â€” may not have MARCA/VALOR)
    for (const [cFk, pPk] of joins) for (const dt of [dtA, dtB, dtC]) addWgt('AD_TVDYPFMTOP', cFk, pPk, dt, noTipo)
  }

  return variants
}

/** Try SQL variants in cascade, returning first that yields rows. */
async function queryWithFallback(
  baseUrl: string,
  headers: Record<string, string>,
  sqlVariants: string[],
  appKey?: string | null,
): Promise<{ rows: RawRecord[]; sqlIndex: number; errors: string[] }> {
  const errors: string[] = []
  for (let i = 0; i < sqlVariants.length; i++) {
    try {
      const rows = await queryRows(baseUrl, headers, sqlVariants[i], appKey)
      if (rows.length > 0) return { rows, sqlIndex: i, errors }
      errors.push(`variant[${i}]: 0 rows`)
    } catch (err) {
      errors.push(`variant[${i}]: ${err instanceof Error ? err.message.slice(0, 80) : 'erro'}`)
    }
  }
  return { rows: [], sqlIndex: -1, errors }
}

export async function GET(req: NextRequest) {
  const routeId = 'api/metas/sankhya-targets'
  const startedAt = Date.now()
  let responseStatus = 200
  recordRouteRequest(routeId)
  const authUser = await getAuthUser(req)
  if (!authUser) {
    responseStatus = 401
    recordRouteStatus(routeId, responseStatus)
    observeRouteDuration(routeId, Date.now() - startedAt)
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const now = new Date()
  const yearRaw = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = Number(req.nextUrl.searchParams.get('month'))
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = new Date(year, month, 1)
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, baseUrl: true, configEncrypted: true },
  })
  if (!integration?.baseUrl) {
    responseStatus = 412
    recordRouteStatus(routeId, responseStatus)
    observeRouteDuration(routeId, Date.now() - startedAt)
    return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa.' }, { status: 412 })
  }
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) {
    responseStatus = 412
    recordRouteStatus(routeId, responseStatus)
    observeRouteDuration(routeId, Date.now() - startedAt)
    return NextResponse.json({ message: 'URL Sankhya invalida.' }, { status: 412 })
  }
  const config = parseStoredConfig(integration.configEncrypted)
  const roleCode = authUser.role?.code?.toUpperCase() ?? 'UNKNOWN'
  const scopeToken = roleCode === 'SALES_SUPERVISOR' ? `SUP:${authUser.sellerCode ?? ''}` : roleCode
  const cacheKey = `metas:sankhya-targets:v1:${year}-${month}:${scopeToken}`

  try {
    const payload = await withRequestCache(cacheKey, 600_000, async () => {
      let bearerToken: string | null = null
      if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') {
        bearerToken = await authenticateOAuth(config, baseUrl)
      }
      if (!bearerToken) bearerToken = await authenticateSession(config, baseUrl)
      const headers = buildHeaders(config, bearerToken)
      const appKey = config.appKey ?? config.token ?? null

      // Discover FK/PK column names (queries ALL_TAB_COLUMNS, falls back to Sankhya defaults)
      const { childFk, parentPk } = await discoverFkColumns(baseUrl, headers, appKey)

      // Fast probe: check if the period has ANY config rows before running expensive JOINs.
      // This avoids iterating through all SQL variants for months with no data.
      const probeSql = `SELECT COUNT(*) AS CNT FROM AD_TVDYCFGPFM WHERE DTINI >= TO_DATE('${startDate}', 'YYYY-MM-DD') AND DTINI < TO_DATE('${endDate}', 'YYYY-MM-DD')`
      let periodHasData = true
      try {
        const probeRows = await queryRows(baseUrl, headers, probeSql, appKey)
        const cnt = probeRows[0] ? parseNumber(probeRows[0].CNT ?? probeRows[0].cnt ?? 0) : 0
        if (cnt === 0) periodHasData = false
      } catch { /* probe failed â€” proceed with full query anyway */ }

      if (!periodHasData) {
        return { sellers: [], year, month, noDataForPeriod: true }
      }

      // Build cascades of SQL variants and run both in parallel
      const financialVariants = buildSqlVariants('financial', year, month, startDate, endDate, childFk, parentPk)
      const weightVariants = buildSqlVariants('weight', year, month, startDate, endDate, childFk, parentPk)

      const [financialResult, weightResult] = await Promise.all([
        queryWithFallback(baseUrl, headers, financialVariants, appKey),
        queryWithFallback(baseUrl, headers, weightVariants, appKey),
      ])

      const financialData = financialResult.rows
      const weightData = weightResult.rows

      // Build seller map keyed by sellerCode
      const sellerMap = new Map<string, {
        sellerCode: string
        sellerName: string
        financialTarget: number
        weightTargets: Array<{ brand: string; targetKg: number }>
      }>()

      for (const row of financialData) {
        const code = String(row.CODVEND ?? '').trim()
        if (!code || code === '0') continue
        const existing = sellerMap.get(code)
        if (existing) {
          existing.financialTarget += parseNumber(row.META_FINANCEIRA)
        } else {
          sellerMap.set(code, {
            sellerCode: code,
            sellerName: String(row.VENDEDOR ?? '').trim(),
            financialTarget: parseNumber(row.META_FINANCEIRA),
            weightTargets: [],
          })
        }
      }

      for (const row of weightData) {
        const code = String(row.CODVEND ?? '').trim()
        if (!code || code === '0') continue
        const brand = String(row.MARCA ?? '').trim()
        if (!brand) continue
        const targetKg = parseNumber(row.META_KG)
        let seller = sellerMap.get(code)
        if (!seller) {
          seller = {
            sellerCode: code,
            sellerName: String(row.VENDEDOR ?? '').trim(),
            financialTarget: 0,
            weightTargets: [],
          }
          sellerMap.set(code, seller)
        }
        const existingBrand = seller.weightTargets.find((w) => w.brand === brand)
        if (existingBrand) {
          existingBrand.targetKg += targetKg
        } else {
          seller.weightTargets.push({ brand, targetKg })
        }
      }

      const allSellers = Array.from(sellerMap.values())
        .sort((a, b) => Number(a.sellerCode) - Number(b.sellerCode))

      // Supervisor scope: filter to only sellers supervised by this user
      const isSupervisorScope = authUser.role?.code === 'SALES_SUPERVISOR'
      const supervisorSellerCode = isSupervisorScope ? (authUser.sellerCode ?? null) : null
      let sellers = allSellers
      if (supervisorSellerCode) {
        const allowlist = await readSellerAllowlist().catch(() => [])
        const supervisedCodes = new Set(
          allowlist
            .filter((s) => String(s.supervisorCode ?? '').trim() === supervisorSellerCode)
            .map((s) => String(s.code ?? '').trim())
            .filter((c) => c.length > 0)
        )
        if (supervisedCodes.size > 0) {
          sellers = allSellers.filter((s) => supervisedCodes.has(s.sellerCode))
        }
      }

      return {
        sellers,
        year,
        month,
        diagnostics: {
          childFk,
          parentPk,
          financialRows: financialData.length,
          weightRows: weightData.length,
          financialSqlIndex: financialResult.sqlIndex,
          weightSqlIndex: weightResult.sqlIndex,
          financialErrors: financialResult.errors.slice(-5),
          weightErrors: weightResult.errors.slice(-5),
          variantsTriedFinancial: financialVariants.length,
          variantsTriedWeight: weightVariants.length,
        },
      }
    })
    responseStatus = 200
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar metas de configuracao do Sankhya.'
    responseStatus = 502
    return NextResponse.json({ message }, { status: 502 })
  } finally {
    recordRouteStatus(routeId, responseStatus)
    observeRouteDuration(routeId, Date.now() - startedAt)
  }
}

