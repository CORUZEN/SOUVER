import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { readSellerAllowlist, writeSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

type RawRecord = Record<string, unknown>

type SellerRow = {
  code: string
  name: string
  partnerCode: string | null
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

async function authenticateSession(config: SankhyaConfig, baseUrl: string): Promise<string | null> {
  if (!config.username || !config.password) return null

  const loginPayload = {
    serviceName: 'MobileLoginSP.login',
    requestBody: {
      NOMUSU: { $: config.username },
      INTERNO: { $: config.password },
      KEEPCONNECTED: { $: 'S' },
    },
  }

  const tokenHeader = config.appKey || config.token || ''
  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(tokenHeader ? { token: tokenHeader } : {}),
      },
      body: JSON.stringify(loginPayload),
      signal: AbortSignal.timeout(15_000),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data) return null

    const body = data.responseBody ?? data
    const sessionToken =
      typeof body.jsessionid === 'string' ? body.jsessionid :
      typeof body.JSESSIONID === 'string' ? body.JSESSIONID :
      typeof body.callID === 'string' ? body.callID :
      typeof body.bearerToken === 'string' ? body.bearerToken :
      null

    return sessionToken || extractBearerToken(body)
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
          for (let i = 0; i < row.length; i += 1) {
            mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
          }
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
) {
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
        if (!response.ok) {
          failures.push(`${endpoint}: HTTP ${response.status}`)
          continue
        }
        const serviceError = extractServiceError(data)
        if (serviceError) {
          failures.push(`${endpoint}: ${serviceError}`)
          continue
        }
        hadSuccessfulExecution = true
        const records: RawRecord[] = []
        collectRecords(data, records)
        if (records.length > 0) return records
      } catch (err) {
        failures.push(`${endpoint}: ${err instanceof Error ? err.message : 'erro de rede'}`)
      }
    }
  }

  if (hadSuccessfulExecution && options?.allowEmpty) return []

  throw new Error(`Nao foi possivel consultar vendedores no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function parseSellerRecords(records: RawRecord[]): SellerRow[] {
  const dedup = new Map<string, SellerRow>()

  for (const record of records) {
    const code = String(record.CODVEND ?? record.COL_1 ?? '').trim()
    const name = String(record.APELIDO ?? record.NOMEVEND ?? record.COL_2 ?? '').trim()
    const partnerCodeRaw = String(record.CODPARC ?? record.COL_3 ?? '').trim()
    if (!code || !name) continue

    const key = `${code}|${name.toUpperCase()}`
    if (!dedup.has(key)) {
      dedup.set(key, {
        code,
        name,
        partnerCode: partnerCodeRaw.length > 0 ? partnerCodeRaw : null,
      })
    }
  }

  return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function querySellers(baseUrl: string, headers: Record<string, string>, appKey?: string | null) {
  // --- Strategy: single combined query with TIPO and ATIVO filters in SQL ---
  // TGFVEN.TIPVEND: 'V' (Vendedor), 'S' (Supervisor) — also accept full-text values
  // TGFVEN.ATIVO: 'S' (Sim)
  // LEFT JOIN TGFCAB to get the most recent partner code (CODPARC) from orders
  const sqlCombined = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  TO_CHAR(MAX(CAB.CODPARC)) AS CODPARC
FROM TGFVEN V
LEFT JOIN TGFCAB CAB
  ON CAB.CODVEND = V.CODVEND
 AND CAB.TIPMOV IN ('V', 'P')
 AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
WHERE TRIM(V.APELIDO) IS NOT NULL
  AND UPPER(TRIM(V.TIPVEND)) IN ('V', 'S', 'VENDEDOR', 'SUPERVISOR')
  AND V.ATIVO = 'S'
GROUP BY V.CODVEND, TRIM(V.APELIDO)
ORDER BY TRIM(V.APELIDO)`.trim()

  try {
    const records = await queryRows(baseUrl, headers, sqlCombined, appKey, { allowEmpty: true })
    if (records.length > 0) return parseSellerRecords(records)
  } catch {
    // combined query failed, try fallback
  }

  // --- Fallback: TGFVEN only (no JOIN), still filtered by TIPO and ATIVO ---
  const sqlFallback = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  CAST(NULL AS VARCHAR2(20)) AS CODPARC
FROM TGFVEN V
WHERE TRIM(V.APELIDO) IS NOT NULL
  AND UPPER(TRIM(V.TIPVEND)) IN ('V', 'S', 'VENDEDOR', 'SUPERVISOR')
  AND V.ATIVO = 'S'
ORDER BY TRIM(V.APELIDO)`.trim()

  try {
    const records = await queryRows(baseUrl, headers, sqlFallback, appKey, { allowEmpty: true })
    if (records.length > 0) return parseSellerRecords(records)
  } catch {
    // fallback also failed
  }

  // --- Last resort: all active sellers without type filter (TIPVEND column may not exist) ---
  const sqlLastResort = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  CAST(NULL AS VARCHAR2(20)) AS CODPARC
FROM TGFVEN V
WHERE TRIM(V.APELIDO) IS NOT NULL
  AND V.ATIVO = 'S'
ORDER BY TRIM(V.APELIDO)`.trim()

  const records = await queryRows(baseUrl, headers, sqlLastResort, appKey)
  return parseSellerRecords(records)
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

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
    let bearerToken: string | null = null
    if ((config.authMode ?? 'OAUTH2') === 'OAUTH2') {
      bearerToken = await authenticateOAuth(config, baseUrl)
    }
    if (!bearerToken) {
      bearerToken = await authenticateSession(config, baseUrl)
    }
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey ?? config.token ?? null
    const remoteSellers = await querySellers(baseUrl, headers, appKey)
    const existing = await readSellerAllowlist()

    const existingByCode = new Map(existing.map((item) => [String(item.code ?? '').trim(), item]))
    const merged = remoteSellers.map((seller) => {
      const prev = existingByCode.get(seller.code)
      return {
        code: seller.code,
        partnerCode: seller.partnerCode ?? prev?.partnerCode ?? null,
        name: seller.name,
        active: prev?.active ?? true,
      }
    })

    const saved = await writeSellerAllowlist(merged)
    return NextResponse.json({
      ok: true,
      integration: { id: integration.id, name: integration.name },
      imported: remoteSellers.length,
      sellers: saved,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar vendedores da meta.'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
