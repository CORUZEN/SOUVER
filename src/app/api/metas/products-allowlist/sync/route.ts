import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import {
  METAS_ALLOWED_PRODUCT_BRANDS,
  normalizeBrand,
  isAllowedProductBrand,
  type AllowedProduct,
} from '@/lib/metas/product-allowlist'
import { readProductAllowlist, writeProductAllowlist } from '@/lib/metas/product-allowlist-store'

type RawRecord = Record<string, unknown>

type ProductRow = {
  code: string
  description: string
  brand: string
  unit: string
  mobility: 'SIM' | 'NAO'
}

function simplifyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'erro desconhecido')
  const marker = 'Nao foi possivel consultar produtos no Sankhya'
  if (raw.startsWith(marker) && raw.includes('(')) {
    return raw.slice(raw.indexOf('(') + 1, raw.lastIndexOf(')')).trim()
  }
  return raw.trim()
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
  const endpoints = [
    `${baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`,
  ]

  for (const endpoint of endpoints) {
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
      if (!response.ok || !data) continue

      const body = data.responseBody ?? data
      const sessionToken =
        typeof body.jsessionid === 'string' ? body.jsessionid :
        typeof body.JSESSIONID === 'string' ? body.JSESSIONID :
        typeof body.callID === 'string' ? body.callID :
        typeof body.bearerToken === 'string' ? body.bearerToken :
        null

      const cookieToken = extractBearerToken(body)
      const token = sessionToken || cookieToken
      if (token) return token
    } catch {
      // tenta proximo endpoint
    }
  }

  return null
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
  // appkey header: use explicit appKey, fall back to token (Sankhya cloud needs this)
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

  throw new Error(`Nao foi possivel consultar produtos no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function inferBrandFromDescription(text: string): string {
  const source = normalizeBrand(text)
  if (source.includes('CAFE')) return 'CAFES'
  if (source.includes('COLORIFICO') || source.includes('TEMPERO')) return 'COLORIFICOS/TEMPEROS'
  if (source.includes('GRAO') || source.includes('GRAOS')) return 'GRAOS'
  if (source.includes('PASSARO')) return 'RACAO PASSAROS'
  if (source.includes('GATO')) return 'RACAO PET - GATO'
  if (source.includes('CACHORRO') || source.includes('CAO') || source.includes('CAES')) return 'RACAO PET - CACHORRO'
  return ''
}

function parseProducts(
  records: RawRecord[],
  groupBrandByCode: Map<string, string>,
  brandByProductCode: Map<string, string>,
  unitByProductCode: Map<string, string>,
  mobilityByProductCode: Map<string, 'SIM' | 'NAO'>,
  mobilityColumnFound: boolean
) {
  const dedup = new Map<string, ProductRow>()
  for (const raw of records) {
    const row: RawRecord = {}
    for (const [key, value] of Object.entries(raw)) row[key.toUpperCase()] = value

    const code = String(row.CODIGO ?? row.CODPROD ?? row.COL_1 ?? '').trim()
    const description = String(row.DESCRICAO ?? row.DESCRPROD ?? row.COL_2 ?? '').trim()
    const groupCode = String(row.CODGRUPO_REF ?? row.COL_6 ?? '').trim()
    const brandRaw =
      String(row.MARCA ?? row.COL_3 ?? '').trim() ||
      brandByProductCode.get(code) ||
      groupBrandByCode.get(groupCode) ||
      inferBrandFromDescription(description)
    const brand = normalizeBrand(brandRaw)
    const unit =
      String(row.UNIDADE ?? row.CODVOL ?? row.COL_3 ?? '').trim().toUpperCase() ||
      unitByProductCode.get(code) ||
      'UN'
    const mobility = mobilityByProductCode.get(code) ?? (mobilityColumnFound ? 'NAO' : 'SIM')

    if (!code || !description || !unit) continue
    if (mobility !== 'SIM') continue
    if (!isAllowedProductBrand(brand)) continue

    const key = `${code}|${description.toUpperCase()}|${brand}|${unit}`
    if (!dedup.has(key)) {
      dedup.set(key, { code, description, brand, unit, mobility })
    }
  }

  return [...dedup.values()].sort((a, b) => a.description.localeCompare(b.description))
}

async function queryProducts(baseUrl: string, headers: Record<string, string>, appKey?: string | null) {
  const failures: string[] = []

  // Mobility column candidates — only one will exist in the target database
  const mobilityCandidates = ['AD_MOBILIDADE', 'AD_MOBILIDA', 'MOBILIDADE', 'MOBILIDA']
  // Brand column candidates
  const brandCandidates = ['MARCA', 'AD_MARCA']
  // Unit column candidates
  const unitCandidates = ['CODVOL', 'UNIDPADRAO', 'UNDPADRAO', 'UNIDADEPADRAO', 'CODVOLPADRAO']

  // --- Strategy: single combined query filtered by mobility in SQL -------
  // This avoids the 5000-row API limit by bringing back only eligible rows.
  for (const mobCol of mobilityCandidates) {
    for (const brandCol of brandCandidates) {
      for (const unitCol of unitCandidates) {
        const sql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TRIM(P.DESCRPROD) AS DESCRICAO,
  TRIM(P.${brandCol}) AS MARCA,
  UPPER(TRIM(TO_CHAR(P.${unitCol}))) AS UNIDADE,
  UPPER(TRIM(TO_CHAR(P.${mobCol}))) AS MOBILIDADE
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL
  AND UPPER(TRIM(TO_CHAR(P.${mobCol}))) IN ('SIM', 'S', '1', 'Y')
ORDER BY TRIM(P.DESCRPROD)`.trim()

        try {
          const records = await queryRows(baseUrl, headers, sql, appKey, { allowEmpty: true })
          if (records.length === 0) continue

          const dedup = new Map<string, ProductRow>()
          for (const raw of records) {
            const row: RawRecord = {}
            for (const [key, value] of Object.entries(raw)) row[key.toUpperCase()] = value

            const code = String(row.CODIGO ?? row.COL_1 ?? '').trim()
            const description = String(row.DESCRICAO ?? row.COL_2 ?? '').trim()
            const brandRaw = String(row.MARCA ?? row.COL_3 ?? '').trim()
            const brand = normalizeBrand(brandRaw || inferBrandFromDescription(description))
            const unit = String(row.UNIDADE ?? row.COL_4 ?? '').trim().toUpperCase() || 'UN'

            if (!code || !description) continue
            if (!isAllowedProductBrand(brand)) continue

            const key = `${code}|${description.toUpperCase()}|${brand}|${unit}`
            if (!dedup.has(key)) {
              dedup.set(key, { code, description, brand, unit, mobility: 'SIM' })
            }
          }

          const products = [...dedup.values()].sort((a, b) => a.description.localeCompare(b.description))
          if (products.length > 0) return products
        } catch {
          // column combination invalid, try next
        }
      }
    }
  }

  // --- Fallback: separate queries (legacy) when combined query fails -----
  const productSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TRIM(P.DESCRPROD) AS DESCRICAO
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL
ORDER BY TRIM(P.DESCRPROD)`.trim()

  let productRecords: RawRecord[] = []
  try {
    productRecords = await queryRows(baseUrl, headers, productSql, appKey)
  } catch (error) {
    failures.push(simplifyErrorMessage(error))
  }

  if (productRecords.length === 0) {
    throw new Error(
      `Nao foi possivel consultar produtos no Sankhya (${failures.slice(0, 6).join(' | ') || 'sem detalhes'}).`
    )
  }

  const brandByProductCode = new Map<string, string>()
  const unitByProductCode = new Map<string, string>()
  const mobilityByProductCode = new Map<string, 'SIM' | 'NAO'>()
  let mobilityColumnFound = false

  for (const unitColumn of unitCandidates) {
    const unitSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  UPPER(TRIM(TO_CHAR(P.${unitColumn}))) AS UNIDADE
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL`.trim()
    try {
      const rows = await queryRows(baseUrl, headers, unitSql, appKey, { allowEmpty: true })
      for (const row of rows) {
        const code = String(row.CODIGO ?? row.COL_1 ?? '').trim()
        const unit = String(row.UNIDADE ?? row.COL_2 ?? '').trim().toUpperCase()
        if (!code || !unit) continue
        unitByProductCode.set(code, unit)
      }
      if (unitByProductCode.size > 0) break
    } catch {
      // tenta próxima coluna
    }
  }

  for (const brandProductColumn of brandCandidates) {
    const brandSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  P.${brandProductColumn} AS MARCA
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL`.trim()
    try {
      const brandRows = await queryRows(baseUrl, headers, brandSql, appKey, { allowEmpty: true })
      for (const raw of brandRows) {
        const code = String(raw.CODIGO ?? raw.COL_1 ?? '').trim()
        const brand = String(raw.MARCA ?? raw.COL_2 ?? '').trim()
        if (!code || !brand) continue
        brandByProductCode.set(code, brand)
      }
      if (brandByProductCode.size > 0) break
    } catch {
      // tenta proxima coluna candidata
    }
  }

  for (const mobilityColumn of mobilityCandidates) {
    const mobilitySql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  UPPER(TRIM(TO_CHAR(P.${mobilityColumn}))) AS MOBILIDADE
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL`.trim()
    try {
      const rows = await queryRows(baseUrl, headers, mobilitySql, appKey, { allowEmpty: true })
      mobilityColumnFound = true
      for (const row of rows) {
        const code = String(row.CODIGO ?? row.COL_1 ?? '').trim()
        const mobilityRaw = String(row.MOBILIDADE ?? row.COL_2 ?? '').trim().toUpperCase()
        if (!code) continue
        const mobility: 'SIM' | 'NAO' =
          mobilityRaw === 'S' || mobilityRaw === 'SIM' || mobilityRaw === '1' || mobilityRaw === 'Y'
            ? 'SIM'
            : 'NAO'
        mobilityByProductCode.set(code, mobility)
      }
      break
    } catch {
      // tenta próxima coluna
    }
  }

  const groupBrandByCode = new Map<string, string>()
  const parsed = parseProducts(productRecords, groupBrandByCode, brandByProductCode, unitByProductCode, mobilityByProductCode, mobilityColumnFound)
  if (parsed.length === 0) {
    throw new Error(
      'Consulta autorizada, mas sem produtos elegiveis. Verifique mobilidade = SIM e categorias de marca permitidas.'
    )
  }
  return parsed
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
    const remoteProducts = await queryProducts(baseUrl, headers, appKey)
    const existing = await readProductAllowlist()

    const existingByCode = new Map(existing.map((item) => [item.code, item]))
    const merged: AllowedProduct[] = remoteProducts.map((product) => {
      const prev = existingByCode.get(product.code)
      return {
        ...product,
        unit: product.unit,
        active: prev?.active ?? true,
      }
    })

    const saved = await writeProductAllowlist(merged)
    return NextResponse.json({
      ok: true,
      integration: { id: integration.id, name: integration.name },
      imported: remoteProducts.length,
      allowedBrands: METAS_ALLOWED_PRODUCT_BRANDS,
      products: saved,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar produtos da meta.'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
