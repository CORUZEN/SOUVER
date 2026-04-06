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

function getSqlEndpoints(baseUrl: string, appKey?: string | null) {
  const appKeyParam = appKey ? `&appkey=${encodeURIComponent(appKey)}` : ''
  const query = `serviceName=DbExplorerSP.executeQuery&outputType=json${appKeyParam}`
  return [
    `${baseUrl}/mge/service.sbr?${query}`,
    `https://api.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`,
    `https://api.sankhya.com.br/mge/service.sbr?${query}`,
    `https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?${query}`,
    `https://api.sandbox.sankhya.com.br/mge/service.sbr?${query}`,
  ]
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
    const fieldsRaw = Array.isArray(body.fields) ? body.fields : []

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

function parseRows(payload: unknown): SellerRow[] {
  const records: RawRecord[] = []
  collectRecords(payload, records)
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

  return [...dedup.values()]
}

async function querySellers(baseUrl: string, headers: Record<string, string>, appKey?: string | null) {
  const sqlPrimary = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  TO_CHAR(MAX(CAB.CODPARC)) AS CODPARC
FROM TGFVEN V
LEFT JOIN TGFCAB CAB
  ON CAB.CODVEND = V.CODVEND
 AND CAB.TIPMOV IN ('V', 'P')
 AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
WHERE NVL(TRIM(V.APELIDO), '') <> ''
GROUP BY V.CODVEND, TRIM(V.APELIDO)
ORDER BY TRIM(V.APELIDO)
`.trim()

  const sqlFallbackFromCab = `
SELECT
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  NVL(MAX(VEN.APELIDO), 'SEM VENDEDOR') AS APELIDO,
  TO_CHAR(MAX(CAB.CODPARC)) AS CODPARC
FROM TGFCAB CAB
LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
WHERE CAB.TIPMOV IN ('V', 'P')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND NVL(CAB.CODVEND, 0) > 0
GROUP BY CAB.CODVEND
ORDER BY NVL(MAX(VEN.APELIDO), 'SEM VENDEDOR')
`.trim()

  const sqlFallbackVenOnly = `
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  CAST(NULL AS VARCHAR2(20)) AS CODPARC
FROM TGFVEN V
WHERE NVL(TRIM(V.APELIDO), '') <> ''
ORDER BY TRIM(V.APELIDO)
`.trim()

  const sqlCandidates = [sqlPrimary, sqlFallbackFromCab, sqlFallbackVenOnly]
  const failures: string[] = []
  let hadAuthorizedResponse = false

  for (const sql of sqlCandidates) {
    for (const endpoint of getSqlEndpoints(baseUrl, appKey)) {
      const payloadVariants = [
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

      for (const payload of payloadVariants) {
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

        hadAuthorizedResponse = true
        const rows = parseRows(data)
        if (rows.length > 0) return rows
      }
    }
  }

  if (hadAuthorizedResponse) {
    throw new Error(
      'Consulta autorizada, mas sem vendedores retornados. Verifique se o usuario OAuth tem acesso de leitura a TGFVEN/TGFCAB.'
    )
  }

  throw new Error(`Nao foi possivel consultar vendedores no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
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
    const bearerToken = (config.authMode ?? 'OAUTH2') === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
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
