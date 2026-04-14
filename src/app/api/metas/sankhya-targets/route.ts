import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type RawRecord = Record<string, unknown>

/**
 * Fetches targets configured in Sankhya's "Vidya Force - Configuração de Performance"
 * custom screen for a given month/year.
 *
 * Tables:
 *   AD_TVDYCFGPFM   — main config per seller per month
 *   AD_TVDYVEN      — sellers linked to each config
 *   AD_TVDYDRTIPT   — financial (money) targets per config
 *   AD_TVDYPFMPRO   — weight (kg) targets per brand per config
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
    : [production, sandbox, localOrigin]
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
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
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
  const DEFAULT = { childFk: 'AD_TVDYCFGPFMID', parentPk: 'AD_TVDYCFGPFMID' }
  try {
    const sql = `
SELECT TABLE_NAME, COLUMN_NAME
FROM ALL_TAB_COLUMNS
WHERE TABLE_NAME IN ('AD_TVDYCFGPFM', 'AD_TVDYDRTIPT', 'AD_TVDYPFMPRO', 'AD_TVDYVEN')
  AND (COLUMN_NAME LIKE 'AD_TVDYCFGPFM%' OR COLUMN_NAME = 'NROCONFIGURACAO')
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

    // Find FK in child tables (prefer AD_TVDYCFGPFM* over NROCONFIGURACAO)
    const childTables = ['AD_TVDYDRTIPT', 'AD_TVDYPFMPRO', 'AD_TVDYVEN']
    let childFk = ''
    for (const tbl of childTables) {
      const found = (colsByTable[tbl] ?? []).find((c) => c.startsWith('AD_TVDYCFGPFM'))
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
    } else if (parentCols.includes('NROCONFIGURACAO')) {
      parentPk = 'NROCONFIGURACAO'
    } else {
      parentPk = parentCols.find((c) => c.startsWith('AD_TVDYCFGPFM')) ?? childFk
    }
    if (!parentPk) parentPk = childFk

    return { childFk, parentPk }
  } catch { /* ALL_TAB_COLUMNS failed — use defaults */ }
  return DEFAULT
}

/** Build multiple SQL variants for each join strategy as a fallback cascade. */
function buildSqlVariants(
  type: 'financial' | 'weight',
  startDate: string,
  endDate: string,
  childFk: string,
  parentPk: string,
): string[] {
  const makeFinancial = (cFk: string, pPk: string) => `
SELECT
  TO_CHAR(VEN.CODVEND) AS CODVEND,
  NVL(TRIM(VEN.APELIDO), TO_CHAR(VEN.CODVEND)) AS VENDEDOR,
  SUM(NVL(DIR.META, 0)) AS META_FINANCEIRA
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.${cFk} = CFG.${pPk}
INNER JOIN AD_TVDYDRTIPT DIR ON DIR.${cFk} = CFG.${pPk}
WHERE CFG.DTINICIAL >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CFG.DTINICIAL < TO_DATE('${endDate}', 'YYYY-MM-DD')
  AND UPPER(TRIM(NVL(DIR.TIPO, 'PERFORMANCE'))) = 'PERFORMANCE'
  AND VEN.CODVEND > 0
GROUP BY VEN.CODVEND, VEN.APELIDO
ORDER BY VEN.CODVEND`.trim()

  const makeWeight = (cFk: string, pPk: string) => `
SELECT
  TO_CHAR(VEN.CODVEND) AS CODVEND,
  NVL(TRIM(VEN.APELIDO), TO_CHAR(VEN.CODVEND)) AS VENDEDOR,
  UPPER(NVL(TRIM(PRO.MARCA), 'SEM MARCA')) AS MARCA,
  SUM(NVL(PRO.VALOR, 0)) AS META_KG
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.${cFk} = CFG.${pPk}
INNER JOIN AD_TVDYPFMPRO PRO ON PRO.${cFk} = CFG.${pPk}
WHERE CFG.DTINICIAL >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CFG.DTINICIAL < TO_DATE('${endDate}', 'YYYY-MM-DD')
  AND UPPER(TRIM(NVL(PRO.TIPO, 'PESO'))) = 'PESO'
  AND VEN.CODVEND > 0
  AND TRIM(PRO.MARCA) IS NOT NULL
GROUP BY VEN.CODVEND, VEN.APELIDO, PRO.MARCA
ORDER BY VEN.CODVEND, PRO.MARCA`.trim()

  const make = type === 'financial' ? makeFinancial : makeWeight
  // Ordered join strategy cascade:
  // 1) Discovered columns (most specific)
  // 2) childFk → NROCONFIGURACAO  (FK in child, business key in parent)
  // 3) AD_TVDYCFGPFMID → AD_TVDYCFGPFMID  (Sankhya standard)
  // 4) NROCONFIGURACAO → NROCONFIGURACAO  (both use business sequence)
  const pairs: [string, string][] = [
    [childFk, parentPk],
    [childFk, 'NROCONFIGURACAO'],
    ['AD_TVDYCFGPFMID', 'AD_TVDYCFGPFMID'],
    ['NROCONFIGURACAO', 'NROCONFIGURACAO'],
  ]
  const seen = new Set<string>()
  const variants: string[] = []
  for (const [cFk, pPk] of pairs) {
    const key = `${cFk}|${pPk}`
    if (seen.has(key)) continue
    seen.add(key)
    variants.push(make(cFk, pPk))
  }
  return variants
}

/** Try SQL variants in cascade, returning first that yields rows. */
async function queryWithFallback(
  baseUrl: string,
  headers: Record<string, string>,
  sqlVariants: string[],
  appKey?: string | null,
): Promise<{ rows: RawRecord[]; sqlIndex: number }> {
  for (let i = 0; i < sqlVariants.length; i++) {
    try {
      const rows = await queryRows(baseUrl, headers, sqlVariants[i], appKey)
      if (rows.length > 0) return { rows, sqlIndex: i }
    } catch { /* try next */ }
  }
  return { rows: [], sqlIndex: -1 }
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
  const nextMonth = new Date(year, month, 1)
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, baseUrl: true, configEncrypted: true },
  })
  if (!integration?.baseUrl) {
    return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa.' }, { status: 412 })
  }
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ message: 'URL Sankhya invalida.' }, { status: 412 })
  const config = parseStoredConfig(integration.configEncrypted)

  try {
    let bearerToken: string | null = null
    if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') {
      bearerToken = await authenticateOAuth(config, baseUrl)
    }
    if (!bearerToken) bearerToken = await authenticateSession(config, baseUrl)
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null

    // Discover FK/PK column names (queries ALL_TAB_COLUMNS, falls back to Sankhya defaults)
    const { childFk, parentPk } = await discoverFkColumns(baseUrl, headers, appKey)

    // Build cascades of SQL variants and run both in parallel
    const financialVariants = buildSqlVariants('financial', startDate, endDate, childFk, parentPk)
    const weightVariants = buildSqlVariants('weight', startDate, endDate, childFk, parentPk)

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

    const sellers = Array.from(sellerMap.values())
      .sort((a, b) => Number(a.sellerCode) - Number(b.sellerCode))

    return NextResponse.json({
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
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar metas de configuracao do Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
