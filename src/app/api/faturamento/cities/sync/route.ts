import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { writeCityList } from '@/lib/faturamento/city-store'
import type { City } from '@/lib/faturamento/city-types'

type RawRecord = Record<string, unknown>

/* ─────────────────────────────────────────────
   Auth helpers (same pattern as all other routes)
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
    } catch { /* next */ }
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

function extractServiceError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as RawRecord
  const status = String(obj.status ?? obj.statusMessage ?? '').toLowerCase()
  if (status.includes('error') || status.includes('erro') || status === '1') {
    const msg = obj.statusMessage ?? obj.message ?? obj.error
    return typeof msg === 'string' ? msg : 'Erro de serviço Sankhya'
  }
  return null
}

function collectRecords(obj: unknown, bucket: RawRecord[]): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as RawRecord
        if (('fieldsMetadata' in rec || 'fields' in rec) && 'rows' in rec) {
          const fieldsRaw = Array.isArray(rec.fieldsMetadata) ? rec.fieldsMetadata
            : Array.isArray(rec.fields) ? rec.fields : []
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
    const fieldsRaw = Array.isArray(objRec.fieldsMetadata) ? objRec.fieldsMetadata
      : Array.isArray(objRec.fields) ? objRec.fields : []
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
  throw new Error(`Sankhya cities query falhou (${failures.join(' | ') || 'sem detalhes'})`)
}

/* ─────────────────────────────────────────────
   SQL: TSICUS split into two batches (Oracle 5000 row limit)
   Batch A: cities starting A-M (roughly half)
   Batch B: cities starting N-Z
   Both use ROWNUM guard as safety net.
───────────────────────────────────────────── */

function buildCitiesSql(letterFrom: string, letterTo: string): string {
  return `
SELECT
  TO_CHAR(C.CODCID) AS CODCID,
  UPPER(TRIM(C.NOMECID)) AS NOMECID,
  TO_CHAR(NVL(C.CODUF, 0)) AS CODUF,
  UPPER(TRIM(NVL(U.UF, ''))) AS SIGLAUF
FROM TSICUS C
LEFT JOIN TSICUF U ON U.CODUF = C.CODUF
WHERE TRIM(C.NOMECID) IS NOT NULL
  AND UPPER(TRIM(C.NOMECID)) >= '${letterFrom}'
  AND UPPER(TRIM(C.NOMECID)) < '${letterTo}'
  AND ROWNUM <= 4500
ORDER BY UPPER(TRIM(C.NOMECID))
`.trim()
}

// Fallback: without JOIN to TSICUF (in case that table doesn't exist)
function buildCitiesSqlNoJoin(letterFrom: string, letterTo: string): string {
  return `
SELECT
  TO_CHAR(C.CODCID) AS CODCID,
  UPPER(TRIM(C.NOMECID)) AS NOMECID,
  TO_CHAR(NVL(C.CODUF, 0)) AS CODUF,
  '' AS SIGLAUF
FROM TSICUS C
WHERE TRIM(C.NOMECID) IS NOT NULL
  AND UPPER(TRIM(C.NOMECID)) >= '${letterFrom}'
  AND UPPER(TRIM(C.NOMECID)) < '${letterTo}'
  AND ROWNUM <= 4500
ORDER BY UPPER(TRIM(C.NOMECID))
`.trim()
}

// Last resort: TGFPAR (get distinct cities from orders — always available)
function buildCitiesFromParSql(): string {
  return `
SELECT DISTINCT
  '0' AS CODCID,
  UPPER(TRIM(PAR.CIDADE)) AS NOMECID,
  '0' AS CODUF,
  UPPER(TRIM(NVL(PAR.UF, ''))) AS SIGLAUF
FROM TGFPAR PAR
WHERE TRIM(PAR.CIDADE) IS NOT NULL
ORDER BY UPPER(TRIM(PAR.CIDADE))
`.trim()
}

function parseCityRecords(records: RawRecord[]): City[] {
  const dedup = new Map<string, City>()
  for (const r of records) {
    const name = String(r.NOMECID ?? r.COL_2 ?? '').trim()
    if (!name) continue
    const code = String(r.CODCID ?? r.COL_1 ?? '0').trim()
    const ufCode = String(r.CODUF ?? r.COL_3 ?? '0').trim()
    const uf = String(r.SIGLAUF ?? r.UF ?? r.COL_4 ?? '').trim().toUpperCase()
    const key = `${code}|${name.toUpperCase()}`
    if (!dedup.has(key)) {
      dedup.set(key, { code, name, ufCode, uf })
    }
  }
  return [...dedup.values()]
}

/* ─────────────────────────────────────────────
   POST handler
───────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const integration = await prisma.integration.findFirst({
      where: { provider: 'sankhya', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, baseUrl: true, configEncrypted: true },
    })

    if (!integration?.configEncrypted) {
      return NextResponse.json({ error: 'Integração Sankhya não configurada' }, { status: 503 })
    }

    const config = parseStoredConfig(integration.configEncrypted)
    if (!config) return NextResponse.json({ error: 'Configuração Sankhya inválida' }, { status: 503 })

    const baseUrl = normalizeBaseUrl(integration.baseUrl ?? '')
    if (!baseUrl) return NextResponse.json({ error: 'URL base do Sankhya não configurada' }, { status: 503 })

    let bearerToken = await authenticateOAuth(config, baseUrl)
    if (!bearerToken) bearerToken = await authenticateSession(config, baseUrl)

    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey || config.token || null

    // Fetch cities in two batches (A–M and N–[beyond Z]) to stay under 5000-row limit
    const allCities: City[] = []
    const batches: Array<[string, string]> = [['A', 'N'], ['N', 'ZZZZZZ']]

    let usedFallback = false

    for (const [from, to] of batches) {
      let records: RawRecord[] = []
      try {
        records = await queryRows(baseUrl, headers, buildCitiesSql(from, to), appKey, { allowEmpty: true })
      } catch {
        try {
          records = await queryRows(baseUrl, headers, buildCitiesSqlNoJoin(from, to), appKey, { allowEmpty: true })
          usedFallback = true
        } catch {
          // batch failed — continue
        }
      }
      allCities.push(...parseCityRecords(records))
    }

    // If TSICUS entirely unavailable, fall back to distinct cities from TGFPAR
    if (allCities.length === 0) {
      try {
        const records = await queryRows(baseUrl, headers, buildCitiesFromParSql(), appKey, { allowEmpty: true })
        allCities.push(...parseCityRecords(records))
        usedFallback = true
      } catch {
        return NextResponse.json({ error: 'Não foi possível obter cidades do Sankhya. Verifique a conexão.' }, { status: 502 })
      }
    }

    const saved = await writeCityList(allCities)

    return NextResponse.json({
      count: saved.length,
      cities: saved,
      source: usedFallback ? 'tgfpar' : 'tsicus',
      message: `${saved.length} cidade${saved.length !== 1 ? 's' : ''} sincronizada${saved.length !== 1 ? 's' : ''} com sucesso.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[faturamento/cities/sync] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
