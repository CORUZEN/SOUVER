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
          for (let i = 0; i < row.length; i += 1) mapped[fields[i] ?? `COL_${i + 1}`] = row[i]
          bucket.push(mapped)
        }
      }
    }
  }

  for (const value of Object.values(obj)) collectRecords(value, bucket)
}

async function queryRows(baseUrl: string, headers: Record<string, string>, sql: string, appKey?: string | null) {
  const failures: string[] = []
  const payloadVariants = [
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
    { requestBody: { sql } },
    { serviceName: 'DbExplorerSP.executeQuery', requestBody: { statement: sql } },
  ]

  for (const endpoint of getSqlEndpoints(baseUrl, appKey)) {
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
      const records: RawRecord[] = []
      collectRecords(data, records)
      if (records.length > 0) return records
    }
  }

  throw new Error(`Nao foi possivel consultar produtos no Sankhya (${failures.join(' | ') || 'sem detalhes'}).`)
}

function hasColumn(columns: Set<string>, name: string) {
  return columns.has(name.toUpperCase())
}

function asSqlStr(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function parseProducts(records: RawRecord[]) {
  const dedup = new Map<string, ProductRow>()
  for (const raw of records) {
    const row: RawRecord = {}
    for (const [key, value] of Object.entries(raw)) row[key.toUpperCase()] = value

    const code = String(row.CODIGO ?? row.CODPROD ?? row.COL_1 ?? '').trim()
    const description = String(row.DESCRICAO ?? row.DESCRPROD ?? row.COL_2 ?? '').trim()
    const brand = normalizeBrand(String(row.MARCA ?? row.COL_3 ?? '').trim())
    const unit = String(row.UNIDADE ?? row.CODVOL ?? row.COL_4 ?? '').trim().toUpperCase()
    const mobilityRaw = String(row.MOBILIDADE ?? row.COL_5 ?? 'NAO').trim().toUpperCase()
    const mobility: 'SIM' | 'NAO' = mobilityRaw === 'SIM' ? 'SIM' : 'NAO'

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
  const columnsSql = `
SELECT TABLE_NAME, COLUMN_NAME
FROM ALL_TAB_COLUMNS
WHERE TABLE_NAME IN ('TGFPRO', 'TGFGRU')
ORDER BY TABLE_NAME, COLUMN_NAME
`.trim()

  const columnRecords = await queryRows(baseUrl, headers, columnsSql, appKey)
  const proColumns = new Set<string>()
  const gruColumns = new Set<string>()
  for (const row of columnRecords) {
    const tableName = String((row.TABLE_NAME ?? row.COL_1 ?? '')).trim().toUpperCase()
    const columnName = String((row.COLUMN_NAME ?? row.COL_2 ?? '')).trim().toUpperCase()
    if (!tableName || !columnName) continue
    if (tableName === 'TGFPRO') proColumns.add(columnName)
    if (tableName === 'TGFGRU') gruColumns.add(columnName)
  }

  if (!hasColumn(proColumns, 'CODPROD') || !hasColumn(proColumns, 'DESCRPROD')) {
    throw new Error('Nao foi possivel localizar colunas obrigatorias de produto (CODPROD/DESCRPROD) na TGFPRO.')
  }

  const mobilityColumn = ['MOBILIDADE', 'AD_MOBILIDADE', 'MOBILIDA'].find((name) => hasColumn(proColumns, name))
  if (!mobilityColumn) {
    throw new Error('Nao foi possivel localizar a coluna de mobilidade na TGFPRO.')
  }
  const unitColumn = ['CODVOL', 'UNIDPADRAO', 'UNDPADRAO', 'UNIDADEPADRAO'].find((name) => hasColumn(proColumns, name))
  if (!unitColumn) {
    throw new Error('Nao foi possivel localizar a coluna de unidade padrao na TGFPRO.')
  }

  const brandProductColumn = ['MARCA', 'AD_MARCA'].find((name) => hasColumn(proColumns, name))
  const groupJoinColumn = ['CODGRUPOPROD', 'CODGRUPO'].find((name) => hasColumn(proColumns, name) && hasColumn(gruColumns, name))
  const groupDescColumn = ['DESCRGRUPOPROD', 'DESCRGRUPO', 'DESCRICAO'].find((name) => hasColumn(gruColumns, name))
  const activeColumn = ['ATIVO', 'INATIVO'].find((name) => hasColumn(proColumns, name))

  const brandExpr = groupJoinColumn && groupDescColumn
    ? `TRIM(G.${groupDescColumn})`
    : brandProductColumn
      ? `TRIM(P.${brandProductColumn})`
      : `CAST(NULL AS VARCHAR2(200))`

  const mobilityExpr = `UPPER(TRIM(NVL(P.${mobilityColumn}, 'NAO')))`
  const activeFilter =
    activeColumn === 'ATIVO'
      ? `AND NVL(UPPER(TRIM(P.ATIVO)), 'S') IN ('S', 'SIM')`
      : activeColumn === 'INATIVO'
        ? `AND NVL(UPPER(TRIM(P.INATIVO)), 'N') IN ('N', 'NAO')`
        : ''

  const brandInList = METAS_ALLOWED_PRODUCT_BRANDS.map((item) => asSqlStr(item)).join(', ')
  const joinClause =
    groupJoinColumn && groupDescColumn
      ? `LEFT JOIN TGFGRU G ON G.${groupJoinColumn} = P.${groupJoinColumn}`
      : ''

  const sql = `
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TRIM(P.DESCRPROD) AS DESCRICAO,
  UPPER(${brandExpr}) AS MARCA,
  UPPER(TRIM(P.${unitColumn})) AS UNIDADE,
  ${mobilityExpr} AS MOBILIDADE
FROM TGFPRO P
${joinClause}
WHERE NVL(TRIM(P.DESCRPROD), '') <> ''
  AND ${mobilityExpr} = 'SIM'
  AND UPPER(${brandExpr}) IN (${brandInList})
  ${activeFilter}
ORDER BY TRIM(P.DESCRPROD)
`.trim()

  const productRecords = await queryRows(baseUrl, headers, sql, appKey)
  return parseProducts(productRecords)
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
