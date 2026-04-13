import { NextRequest, NextResponse } from 'next/server'
import { canAccessIntegrations, getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type RawRecord = Record<string, unknown>
type MatrixRow = unknown[]

function escapeSqlLiteral(input: string) {
  return input.replace(/'/g, "''")
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
  const obj = payload as RawRecord
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

function buildHeaders(config: SankhyaConfig, bearerToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`
  if (config.token) headers['X-Token'] = config.token
  if (config.token) headers.token = config.token
  if (config.appKey) {
    headers.appkey = config.appKey
    headers.AppKey = config.appKey
  }
  return headers
}

function getSqlEndpoints(baseUrl: string, opts?: { appKey?: string | null; hasBearer?: boolean }) {
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

function extractRows(payload: unknown): MatrixRow[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as RawRecord

  const responseBody = obj.responseBody as RawRecord | undefined
  if (responseBody && Array.isArray(responseBody.rows) && responseBody.rows.every((row) => Array.isArray(row))) {
    return responseBody.rows as MatrixRow[]
  }

  for (const value of Object.values(obj)) {
    const nested = extractRows(value)
    if (nested.length > 0) return nested
  }

  return []
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

async function runDiagnosticSql(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  opts?: { appKey?: string | null }
) {
  const endpoints = getSqlEndpoints(baseUrl, {
    appKey: opts?.appKey,
    hasBearer: /^Bearer\s+/i.test(headers.Authorization ?? ''),
  })

  const payload = {
    serviceName: 'DbExplorerSP.executeQuery',
    requestBody: { sql },
  }

  const failures: string[] = []
  for (const endpoint of endpoints) {
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

    const serviceError = extractServiceError(data)
    if (serviceError) {
      failures.push(`${endpoint}: ${serviceError}`)
      continue
    }

    const rows = extractRows(data)
    if (rows.length > 0) return { rows, endpoint }

    failures.push(`${endpoint}: resposta sem rows`)
  }

  throw new Error(`Nao foi possivel executar consulta diagnostica (${failures.join(' | ') || 'sem detalhes'}).`)
}

function sanitizeTableName(raw: string): string {
  const normalized = raw.trim().toUpperCase()
  if (!/^[A-Z0-9_]+$/.test(normalized)) {
    throw new Error(`Nome de tabela invalido: ${raw}`)
  }
  return normalized
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  if (!(await canAccessIntegrations(authUser))) {
    return NextResponse.json({ message: 'Sem permissao para acessar Integracoes.' }, { status: 403 })
  }

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, baseUrl: true, configEncrypted: true },
  })

  if (!integration?.baseUrl) {
    return NextResponse.json({ message: 'Nenhuma integracao Sankhya ativa foi encontrada.' }, { status: 412 })
  }

  const config = parseStoredConfig(integration.configEncrypted)
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ message: 'URL da integracao Sankhya invalida.' }, { status: 412 })

  const tablesRaw = req.nextUrl.searchParams.get('tables') ?? 'TGFCAB'
  const sellerNameRaw = req.nextUrl.searchParams.get('sellerName')
  const tables = [...new Set(tablesRaw.split(',').map((entry) => sanitizeTableName(entry)).filter(Boolean))].slice(0, 10)

  try {
    const bearerToken = (config.authMode ?? 'OAUTH2') === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null

    const resultados: Record<string, { rows: MatrixRow[] }> = {}
    const endpointsUsed: string[] = []

    for (const tableName of tables) {
      const sql = `
SELECT OWNER, COLUMN_ID, COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE
FROM ALL_TAB_COLUMNS
WHERE TABLE_NAME = '${tableName}'
ORDER BY COLUMN_ID
`.trim()

      const result = await runDiagnosticSql(baseUrl, headers, sql, { appKey })
      resultados[`cols_${tableName}`] = { rows: result.rows }
      endpointsUsed.push(result.endpoint)
    }

    if (sellerNameRaw && sellerNameRaw.trim().length > 0) {
      const sellerName = sellerNameRaw.trim()
      const sellerSqlPrimary = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  V.APELIDO AS APELIDO_VENDEDOR,
  CAST(NULL AS VARCHAR2(1)) AS NOMEVEND
FROM TGFVEN V
WHERE UPPER(V.APELIDO) LIKE UPPER('%${escapeSqlLiteral(sellerName)}%')
ORDER BY V.APELIDO
`.trim()

      const sellerSqlFallback = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  CAST(NULL AS VARCHAR2(1)) AS APELIDO_VENDEDOR,
  CAST(NULL AS VARCHAR2(1)) AS NOMEVEND
FROM TGFVEN V
WHERE TO_CHAR(V.CODVEND) = '${escapeSqlLiteral(sellerName)}'
ORDER BY V.CODVEND
`.trim()

      let sellerResult: { rows: MatrixRow[]; endpoint: string }
      try {
        sellerResult = await runDiagnosticSql(baseUrl, headers, sellerSqlPrimary, { appKey })
      } catch {
        sellerResult = await runDiagnosticSql(baseUrl, headers, sellerSqlFallback, { appKey })
      }
      resultados.sellers_lookup = { rows: sellerResult.rows }
      endpointsUsed.push(sellerResult.endpoint)
    }

    return NextResponse.json({
      ok: true,
      integration: { id: integration.id, name: integration.name, baseUrl },
      endpointsUsed: [...new Set(endpointsUsed)],
      resultados,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Falha no diagnostico Sankhya.' },
      { status: 502 }
    )
  }
}

