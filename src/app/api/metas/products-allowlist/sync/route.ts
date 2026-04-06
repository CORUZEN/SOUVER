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
  const idx = raw.indexOf('(')
  if (idx <= 0) return raw
  return raw.slice(0, idx).trim()
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
    const unit = String(row.UNIDADE ?? row.CODVOL ?? row.COL_3 ?? '').trim().toUpperCase()
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

  const unitCandidates = ['CODVOL', 'UNIDPADRAO', 'UNDPADRAO', 'UNIDADEPADRAO', 'CODVOLPADRAO']
  const mobilityCandidates = ['AD_MOBILIDADE', 'AD_MOBILIDA', 'MOBILIDADE', 'MOBILIDA']
  const groupCodeCandidates = ['CODGRUPOPROD', 'CODGRUPO', 'CODGRUPOPRO', 'CODGRUPPROD']

  let productRecords: RawRecord[] = []

  for (const unitColumn of unitCandidates) {
    const productSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TRIM(P.DESCRPROD) AS DESCRICAO,
  P.${unitColumn} AS UNIDADE
FROM TGFPRO P
WHERE NVL(TRIM(P.DESCRPROD), '') <> ''
ORDER BY TRIM(P.DESCRPROD)
`.trim()
    try {
      const rows = await queryRows(baseUrl, headers, productSql, appKey, { allowEmpty: true })
      if (rows.length > 0) {
        productRecords = rows
        break
      }
    } catch (error) {
      failures.push(simplifyErrorMessage(error))
    }
    if (productRecords.length > 0) break
  }

  if (productRecords.length === 0) {
    throw new Error(
      `Nao foi possivel consultar produtos no Sankhya (${failures.slice(0, 6).join(' | ') || 'sem detalhes'}).`
    )
  }

  const groupBrandByCode = new Map<string, string>()
  const brandByProductCode = new Map<string, string>()
  const mobilityByProductCode = new Map<string, 'SIM' | 'NAO'>()
  let mobilityColumnFound = false

  for (const brandProductColumn of ['MARCA', 'AD_MARCA']) {
    const brandSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  P.${brandProductColumn} AS MARCA
FROM TGFPRO P
WHERE NVL(TRIM(P.DESCRPROD), '') <> ''
`.trim()
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

  let groupCodeColumnFound: string | null = null
  for (const groupCodeColumn of groupCodeCandidates) {
    const groupRefSql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TO_CHAR(P.${groupCodeColumn}) AS CODGRUPO_REF
FROM TGFPRO P
WHERE NVL(TRIM(P.DESCRPROD), '') <> ''
`.trim()
    try {
      const rows = await queryRows(baseUrl, headers, groupRefSql, appKey, { allowEmpty: true })
      for (const row of rows) {
        const code = String(row.CODIGO ?? row.COL_1 ?? '').trim()
        const grp = String(row.CODGRUPO_REF ?? row.COL_2 ?? '').trim()
        if (!code || !grp) continue
        groupBrandByCode.set(`__PRODUCT__${code}`, grp)
      }
      groupCodeColumnFound = groupCodeColumn
      break
    } catch {
      // tenta próxima coluna
    }
  }

  if (groupCodeColumnFound) {
    const groupDescByCode = new Map<string, string>()
    for (const groupDescColumn of ['DESCRGRUPOPROD', 'DESCRGRUPOPRODUTO', 'DESCRGRUPO', 'DESCRICAO']) {
      const groupSql = `
SELECT
  TO_CHAR(G.${groupCodeColumnFound}) AS CODGRUPO_REF,
  TRIM(G.${groupDescColumn}) AS MARCA
FROM TGFGRU G
WHERE NVL(TRIM(G.${groupDescColumn}), '') <> ''
`.trim()
      try {
        const groupRows = await queryRows(baseUrl, headers, groupSql, appKey, { allowEmpty: true })
        for (const raw of groupRows) {
          const code = String(raw.CODGRUPO_REF ?? raw.COL_1 ?? '').trim()
          const brand = String(raw.MARCA ?? raw.COL_2 ?? '').trim()
          if (!code || !brand) continue
          groupDescByCode.set(code, brand)
        }
        if (groupDescByCode.size > 0) break
      } catch {
        // tenta proxima coluna candidata
      }
    }

    if (groupDescByCode.size > 0) {
      for (const [k, v] of groupBrandByCode.entries()) {
        if (!k.startsWith('__PRODUCT__')) continue
        const prodCode = k.replace('__PRODUCT__', '')
        const grpCode = v
        const grpDesc = groupDescByCode.get(grpCode)
        if (grpDesc) groupBrandByCode.set(prodCode, grpDesc)
      }
      for (const key of [...groupBrandByCode.keys()]) {
        if (key.startsWith('__PRODUCT__')) groupBrandByCode.delete(key)
      }
    } else {
      groupBrandByCode.clear()
    }
  }

  for (const mobilityColumn of mobilityCandidates) {
    const mobilitySql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  UPPER(TRIM(TO_CHAR(P.${mobilityColumn}))) AS MOBILIDADE
FROM TGFPRO P
WHERE NVL(TRIM(P.DESCRPROD), '') <> ''
`.trim()
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

  const parsed = parseProducts(
    productRecords,
    groupBrandByCode,
    brandByProductCode,
    mobilityByProductCode,
    mobilityColumnFound
  )
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
    const bearerToken = (config.authMode ?? 'OAUTH2') === 'OAUTH2' ? await authenticateOAuth(config, baseUrl) : null
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
