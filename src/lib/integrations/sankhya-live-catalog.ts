import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

export interface SankhyaLiveTable {
  owner: string
  tableName: string
  description: string | null
  status: string | null
  tablespace: string | null
  columnCount: number | null
}

export interface SankhyaLiveCatalogPayload {
  source: 'sankhya-live-integration'
  fetchedAt: string
  integration: { id: string; name: string }
  schemaOwner: string
  totalTables: number
  tables: SankhyaLiveTable[]
}

type RawRow = Record<string, unknown>

function normalizeObjectKeys(record: RawRow) {
  const normalized: RawRow = {}
  for (const [key, value] of Object.entries(record)) normalized[key.toUpperCase()] = value
  return normalized
}

function collectObjectArrays(payload: unknown, bucket: RawRow[][]) {
  if (!payload) return
  if (Array.isArray(payload)) {
    if (payload.length > 0 && payload.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))) {
      bucket.push(payload as RawRow[])
    }
    for (const entry of payload) collectObjectArrays(entry, bucket)
    return
  }
  if (typeof payload !== 'object') return
  for (const value of Object.values(payload as RawRow)) collectObjectArrays(value, bucket)
}

function collectMatrixRows(payload: unknown, bucket: RawRow[]) {
  if (!payload || typeof payload !== 'object') return
  const obj = payload as RawRow

  const responseBody = (obj.responseBody ?? null) as RawRow | null
  const rows = responseBody?.rows
  const fieldsRaw = responseBody?.fields

  if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0])) {
    const fields =
      Array.isArray(fieldsRaw) && fieldsRaw.length > 0
        ? fieldsRaw.map((field) => {
            if (typeof field === 'string') return field
            if (field && typeof field === 'object') {
              const mapped = field as RawRow
              return String(mapped.name ?? mapped.fieldName ?? mapped.FIELD_NAME ?? '')
            }
            return ''
          })
        : []

    for (const row of rows) {
      if (!Array.isArray(row)) continue
      const mapped: RawRow = {}
      for (let i = 0; i < row.length; i += 1) {
        const key = String(fields[i] ?? `COL_${i + 1}`).toUpperCase()
        mapped[key] = row[i]
      }
      bucket.push(mapped)
    }
  }

  for (const value of Object.values(obj)) collectMatrixRows(value, bucket)
}

function extractRows(payload: unknown): RawRow[] {
  const matrixRows: RawRow[] = []
  collectMatrixRows(payload, matrixRows)
  if (matrixRows.length > 0) return matrixRows

  const arrays: RawRow[][] = []
  collectObjectArrays(payload, arrays)
  return arrays.flat()
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : 0
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
  const obj = payload as RawRow
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
  if (config.token) headers.token = config.token
  return headers
}

function getSankhyaSqlEndpoints(baseUrl: string, opts?: { appKey?: string | null; hasBearer?: boolean }) {
  const appKeyParam = opts?.appKey ? `&appkey=${encodeURIComponent(opts.appKey)}` : ''
  const query = `serviceName=DbExplorerSP.executeQuery&outputType=json${appKeyParam}`
  const endpoints = [`${baseUrl}/mge/service.sbr?${query}`]

  if (opts?.hasBearer) {
    endpoints.push(`https://api.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sankhya.com.br/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`)
    endpoints.push(`https://api.sandbox.sankhya.com.br/mge/service.sbr?${query}`)
  }

  return [...new Set(endpoints)]
}

function extractServiceErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as RawRow
  const status = String(obj.status ?? '').trim()
  const statusMessage = String(obj.statusMessage ?? '').trim()
  if (!status && !statusMessage) return null
  if (status === '1' || status.toUpperCase() === 'SUCCESS') return null
  return statusMessage || `Falha no serviço Sankhya (status ${status || 'desconhecido'}).`
}

async function runSankhyaSql(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  opts?: { appKey?: string | null }
): Promise<RawRow[]> {
  const endpoints = getSankhyaSqlEndpoints(baseUrl, {
    appKey: opts?.appKey,
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

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        failures.push(`${endpoint}: HTTP ${response.status}`)
        continue
      }

      const serviceError = extractServiceErrorMessage(data)
      if (serviceError) {
        failures.push(`${endpoint}: ${serviceError}`)
        continue
      }

      const rows = extractRows(data)
      if (rows.length > 0) return rows

      failures.push(`${endpoint}: resposta sem linhas`)
    }
  }

  const normalized = failures.join(' | ') || 'sem detalhes'
  if (/n.o autorizado/i.test(normalized)) {
    throw new Error(
      'Sankhya recusou a consulta SQL (Nao autorizado). Verifique permissoes do integrador para DbExplorerSP.executeQuery.'
    )
  }
  throw new Error(`Nao foi possivel consultar catalogo no Sankhya (${normalized}).`)
}

async function runSankhyaCrudDictionary(
  baseUrl: string,
  headers: Record<string, string>
): Promise<RawRow[]> {
  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json`
  const rootEntities = ['TabelaDicionario', 'DicionarioTabela', 'TDDTAB', 'DicionarioDados']
  const failures: string[] = []

  for (const rootEntity of rootEntities) {
    const payloads: unknown[] = [
      {
        serviceName: 'CRUDServiceProvider.loadRecords',
        requestBody: {
          dataSet: {
            rootEntity,
            includePresentationFields: 'N',
            offsetPage: '0',
            entity: { fieldset: { list: 'NOMETAB,DESCRTAB' } },
          },
        },
      },
      {
        requestBody: {
          dataSet: {
            rootEntity,
            includePresentationFields: 'N',
            offsetPage: '0',
            entity: { fieldset: { list: 'NOMETAB,DESCRTAB' } },
          },
        },
      },
    ]

    for (const payload of payloads) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        failures.push(`CRUD ${rootEntity}: HTTP ${response.status}`)
        continue
      }

      const serviceError = extractServiceErrorMessage(data)
      if (serviceError) {
        failures.push(`CRUD ${rootEntity}: ${serviceError}`)
        continue
      }

      const rows = extractRows(data)
      if (rows.length > 0) return rows
      failures.push(`CRUD ${rootEntity}: resposta sem linhas`)
    }
  }

  const normalized = failures.join(' | ') || 'sem detalhes'
  if (/n.o autorizado/i.test(normalized)) {
    throw new Error(
      'Sankhya recusou a consulta de catalogo (Nao autorizado). Verifique permissoes para DbExplorerSP.executeQuery e CRUDServiceProvider.loadRecords.'
    )
  }
  throw new Error(`Nao foi possivel consultar catalogo no Sankhya via CRUD (${normalized}).`)
}

function mapRowsToTables(rows: RawRow[]) {
  return rows
    .map((row) => {
      const record = normalizeObjectKeys(row)
      const inferredOwner = String(record.OWNER ?? record.SCHEMA_OWNER ?? record.COL_1 ?? '').trim()
      const inferredTableName = String(record.TABLE_NAME ?? record.NOMETAB ?? record.COL_2 ?? '').trim()
      const rawCol3 = record.COL_3 == null ? null : String(record.COL_3).trim()
      const looksLikeStatus = rawCol3 === 'VALID' || rawCol3 === 'INVALID'
      const inferredDescription = record.DESCRTAB ?? (looksLikeStatus ? null : record.COL_3)
      const inferredStatus = record.STATUS ?? (looksLikeStatus ? rawCol3 : null)

      const tableName = inferredTableName || String(record.COL_1 ?? '').trim()
      if (!tableName || tableName.startsWith('BIN$')) return null
      if (/^\d+$/.test(tableName)) return null

      return {
        owner: inferredOwner || 'UNKNOWN',
        tableName,
        description: (inferredDescription == null ? null : String(inferredDescription).trim() || null),
        status: (inferredStatus == null ? null : String(inferredStatus).trim() || null),
        tablespace: (record.TABLESPACE_NAME == null ? null : String(record.TABLESPACE_NAME).trim() || null),
        columnCount:
          record.COLUMN_COUNT == null
            ? (record.COL_3 == null ? null : parseNumber(record.COL_3))
            : parseNumber(record.COLUMN_COUNT),
      }
    })
    .filter((item): item is SankhyaLiveTable => Boolean(item))
    .sort((a, b) => a.tableName.localeCompare(b.tableName))
}

export async function fetchSankhyaLiveCatalog(): Promise<SankhyaLiveCatalogPayload> {
  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, baseUrl: true, configEncrypted: true },
  })

  if (!integration?.baseUrl) {
    throw new Error('Nenhuma integracao Sankhya ativa com URL valida foi encontrada.')
  }

  const config = parseStoredConfig(integration.configEncrypted)
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) throw new Error('A URL da integracao Sankhya esta invalida.')

  const authMode = config.authMode ?? 'OAUTH2'
  const bearerToken = authMode === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
  const headers = buildSankhyaHeaders(config, bearerToken)

const allTablesSql = `
SELECT
  T.OWNER,
  T.TABLE_NAME,
  DD.DESCRTAB,
  T.STATUS,
  T.TABLESPACE_NAME,
  NVL(C.COLUMN_COUNT, 0) AS COLUMN_COUNT
FROM ALL_TABLES T
LEFT JOIN TDDTAB DD
  ON DD.NOMETAB = T.TABLE_NAME
LEFT JOIN (
  SELECT OWNER, TABLE_NAME, COUNT(*) AS COLUMN_COUNT
  FROM ALL_TAB_COLUMNS
  GROUP BY OWNER, TABLE_NAME
) C
  ON C.OWNER = T.OWNER
 AND C.TABLE_NAME = T.TABLE_NAME
WHERE T.OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
ORDER BY T.TABLE_NAME
`.trim()

const userTablesSql = `
SELECT
  USER AS OWNER,
  T.TABLE_NAME,
  DD.DESCRTAB,
  T.STATUS,
  T.TABLESPACE_NAME,
  NVL(C.COLUMN_COUNT, 0) AS COLUMN_COUNT
FROM USER_TABLES T
LEFT JOIN TDDTAB DD
  ON DD.NOMETAB = T.TABLE_NAME
LEFT JOIN (
  SELECT TABLE_NAME, COUNT(*) AS COLUMN_COUNT
  FROM USER_TAB_COLUMNS
  GROUP BY TABLE_NAME
) C
  ON C.TABLE_NAME = T.TABLE_NAME
ORDER BY T.TABLE_NAME
`.trim()

  const tddtabSql = `
SELECT
  'SANKHYA_DD' AS SCHEMA_OWNER,
  NOMETAB AS TABLE_NAME,
  DESCRTAB
FROM TDDTAB
ORDER BY NOMETAB
`.trim()

  const allColumnsSql = `
SELECT
  C.OWNER,
  C.TABLE_NAME,
  COUNT(*) AS COLUMN_COUNT
FROM ALL_TAB_COLUMNS C
WHERE C.OWNER NOT IN ('SYS', 'SYSTEM')
GROUP BY C.OWNER, C.TABLE_NAME
ORDER BY C.OWNER, C.TABLE_NAME
`.trim()

  let rows: RawRow[] = []
  try {
    rows = await runSankhyaSql(baseUrl, headers, allTablesSql, { appKey: config.appKey ?? config.token ?? null })
  } catch {
    try {
      rows = await runSankhyaSql(baseUrl, headers, userTablesSql, { appKey: config.appKey ?? config.token ?? null })
    } catch {
      try {
        rows = await runSankhyaSql(baseUrl, headers, tddtabSql, { appKey: config.appKey ?? config.token ?? null })
      } catch {
        try {
          rows = await runSankhyaSql(baseUrl, headers, allColumnsSql, { appKey: config.appKey ?? config.token ?? null })
        } catch {
          rows = await runSankhyaCrudDictionary(baseUrl, headers)
        }
      }
    }
  }

  const tables = mapRowsToTables(rows)
  if (tables.length === 0) {
    throw new Error('A consulta ao catalogo retornou zero tabelas para o schema autenticado.')
  }

  return {
    source: 'sankhya-live-integration',
    fetchedAt: new Date().toISOString(),
    integration: { id: integration.id, name: integration.name },
    schemaOwner: tables[0]?.owner ?? 'UNKNOWN',
    totalTables: tables.length,
    tables,
  }
}
