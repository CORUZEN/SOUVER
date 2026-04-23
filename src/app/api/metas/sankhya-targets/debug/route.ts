/**
 * GET /api/metas/sankhya-targets/debug?year=YYYY&month=M
 *
 * Returns raw rows from every Sankhya table involved in "ConfiguraÃ§Ã£o de Performance"
 * so developers can identify which table / column structure is active in this instance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type RawRecord = Record<string, unknown>

// â”€â”€â”€ Auth helpers (duplicated from parent route to keep files independent) â”€â”€â”€â”€

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
  } catch { return null }
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
  if (appKeyValue) { headers.appkey = appKeyValue; headers.AppKey = appKeyValue }
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
  return statusMessage || `Falha no serviÃ§o Sankhya (status ${status || 'desconhecido'}).`
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
        for (const row of rowsRaw as unknown[][]) {
          if (!Array.isArray(row)) continue
          const mapped: RawRecord = {}
          for (let i = 0; i < row.length; i++) mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
          bucket.push(mapped)
        }
      }
    }
  }
  for (const value of Object.values(obj)) collectRecords(value, bucket)
}

async function runQuery(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  appKey?: string | null,
): Promise<{ rows: RawRecord[]; error: string | null }> {
  const hasBearer = /^Bearer\s+/i.test(headers.Authorization ?? '')
  const payloads = [
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
    { requestBody: { sql } },
  ]
  for (const endpoint of getSqlEndpoints(baseUrl, appKey, hasBearer)) {
    for (const payload of payloads) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20_000),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) continue
        const serviceError = extractServiceError(data)
        if (serviceError) return { rows: [], error: serviceError }
        const records: RawRecord[] = []
        collectRecords(data, records)
        return { rows: records, error: null }
      } catch (err) {
        return { rows: [], error: err instanceof Error ? err.message : 'erro de rede' }
      }
    }
  }
  return { rows: [], error: 'Nenhum endpoint retornou sucesso.' }
}

// â”€â”€â”€ Diagnostic queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TableResult {
  table: string
  description: string
  sql: string
  rows: RawRecord[]
  rowCount: number
  error: string | null
  columns: string[]
}

async function queryTable(
  baseUrl: string,
  headers: Record<string, string>,
  appKey: string | null,
  table: string,
  description: string,
  whereSuffix = '',
): Promise<TableResult> {
  const sql = `SELECT * FROM ${table}${whereSuffix} AND ROWNUM <= 20`.replace('AND ROWNUM', whereSuffix ? 'AND ROWNUM' : 'WHERE ROWNUM')
  const { rows, error } = await runQuery(baseUrl, headers, sql, appKey)
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return { table, description, sql, rows, rowCount: rows.length, error, columns }
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
    return NextResponse.json({ message: 'Nenhuma integraÃ§Ã£o Sankhya ativa.' }, { status: 412 })
  }
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ message: 'URL Sankhya invÃ¡lida.' }, { status: 412 })
  const config = parseStoredConfig(integration.configEncrypted)

  try {
    let bearerToken: string | null = null
    if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') bearerToken = await authenticateOAuth(config, baseUrl)
    if (!bearerToken) bearerToken = await authenticateSession(config, baseUrl)
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null

    // Columns discovery
    const colsSql = `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME IN ('AD_TVDYCFGPFM','AD_TVDYVEN','AD_TVDYDRTIPT','AD_TVDYPFMTOP','AD_TVDYPFMPRO') ORDER BY TABLE_NAME, COLUMN_ID`
    const { rows: colRows, error: colError } = await runQuery(baseUrl, headers, colsSql, appKey)

    // Group columns by table
    const columnsByTable: Record<string, Array<{ name: string; type: string }>> = {}
    for (const row of colRows) {
      const tbl = String(row.TABLE_NAME ?? '').trim()
      const col = String(row.COLUMN_NAME ?? '').trim()
      const typ = String(row.DATA_TYPE ?? '').trim()
      if (!tbl || !col) continue
      if (!columnsByTable[tbl]) columnsByTable[tbl] = []
      columnsByTable[tbl].push({ name: col, type: typ })
    }

    // Raw rows from each table (up to 20, filtered by period for child tables)
    const dateWhere = ` WHERE ROWNUM <= 20`
    const dateWhereParent = ` WHERE ROWNUM <= 20`

    // Run all 5 table queries in parallel
    const [cfgResult, venResult, drtResult, topResult, proResult] = await Promise.all([
      runQuery(baseUrl, headers, `SELECT * FROM AD_TVDYCFGPFM WHERE ROWNUM <= 20`, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'AD_TVDYCFGPFM', description: 'Config principal por vendedor/mÃªs â€” PK: NUCFGPFM', columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
      runQuery(baseUrl, headers, `SELECT * FROM AD_TVDYVEN WHERE ROWNUM <= 20`, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'AD_TVDYVEN', description: 'Vendedores â€” CODVEN (cÃ³digo), NUCFGPFM (FK)', columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
      runQuery(baseUrl, headers, `SELECT * FROM AD_TVDYDRTIPT WHERE ROWNUM <= 20`, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'AD_TVDYDRTIPT', description: 'Metas financeiras â€” META, TIPO (NUMBER), NUCFGPFM (FK)', columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
      runQuery(baseUrl, headers, `SELECT * FROM AD_TVDYPFMTOP WHERE ROWNUM <= 20`, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'AD_TVDYPFMTOP', description: 'Tipo de operaÃ§Ã£o â€” CODTIPOPER, TIPO (VARCHAR2), NUCFGPFM (FK)', columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
      runQuery(baseUrl, headers, `SELECT * FROM AD_TVDYPFMPRO WHERE ROWNUM <= 20`, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'AD_TVDYPFMPRO', description: 'Metas de peso por marca â€” MARCA, VALOR, NUCFGPFM (FK) â† tabela correta', columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
    ])

    // Joined queries using confirmed correct schema (NUCFGPFM + CODVEN)
    const joinedFinancialSql = `
SELECT CFG.NUCFGPFM, CFG.TITULO, CFG.DTINI, CFG.DTFIM, VEN.CODVEN, DIR.META, DIR.TIPO
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.NUCFGPFM = CFG.NUCFGPFM
INNER JOIN AD_TVDYDRTIPT DIR ON DIR.NUCFGPFM = CFG.NUCFGPFM
WHERE ROWNUM <= 20`.trim()

    const joinedWeightSql = `
SELECT CFG.NUCFGPFM, CFG.TITULO, CFG.DTINI, VEN.CODVEN, PRO.MARCA, PRO.VALOR, PRO.TIPO
FROM AD_TVDYCFGPFM CFG
INNER JOIN AD_TVDYVEN VEN ON VEN.NUCFGPFM = CFG.NUCFGPFM
INNER JOIN AD_TVDYPFMPRO PRO ON PRO.NUCFGPFM = CFG.NUCFGPFM
WHERE ROWNUM <= 20`.trim()

    const [joinedFinResult, joinedWgtResult] = await Promise.all([
      runQuery(baseUrl, headers, joinedFinancialSql, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'JOIN financeiro (CFG+VEN+DRTIPT)', description: `JOIN via NUCFGPFM â€” perÃ­odo ${startDate} a ${endDate}`, columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
      runQuery(baseUrl, headers, joinedWeightSql, appKey).then(r => ({
        ...r, rowCount: r.rows.length, table: 'JOIN peso (CFG+VEN+PFMPRO)', description: `JOIN via NUCFGPFM com AD_TVDYPFMPRO â€” perÃ­odo ${startDate} a ${endDate}`, columns: r.rows[0] ? Object.keys(r.rows[0]) : []
      })),
    ])

    return NextResponse.json({
      period: { year, month, startDate, endDate },
      authMethod: bearerToken ? 'oauth2/session' : 'none',
      columnsByTable,
      columnsError: colError,
      tables: [cfgResult, venResult, drtResult, topResult, proResult, joinedFinResult, joinedWgtResult],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no diagnÃ³stico Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}

