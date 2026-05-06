import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import { authenticateSankhyaCached } from '@/lib/integrations/sankhya-auth'

type RawRecord = Record<string, unknown>

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
    return typeof msg === 'string' ? msg : 'Erro de serviÃ§o Sankhya'
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
  options?: { allowEmpty?: boolean; logTag?: string }
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
        if (options?.logTag) {
          const rawJson = JSON.stringify(data ?? null)
          console.log(`[diagnose:${options.logTag}] endpoint=${endpoint} records=${records.length} rawKeys=${Object.keys(data ?? {}).join(',')} rawResponse=${rawJson.slice(0, 2000)}`)
        }
        if (records.length > 0) return records
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'rede')
      }
    }
  }
  if (hadSuccess && options?.allowEmpty) return []
  throw new Error(`Sankhya query falhou (${failures.join(' | ') || 'sem detalhes'})`)
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 })
    }
  const denied = await requireModuleInteract(request, 'previsao')
  if (denied) return denied

    const searchParams = request.nextUrl.searchParams
    const sellersParam = searchParams.get('sellers') ?? ''
    const sellerCodes: number[] = sellersParam
      ? sellersParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      : []

    const integration = await prisma.integration.findFirst({
      where: { provider: 'sankhya', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, baseUrl: true, configEncrypted: true },
    })

    if (!integration?.configEncrypted) {
      return NextResponse.json({ error: 'IntegraÃ§Ã£o Sankhya nÃ£o configurada' }, { status: 503 })
    }

    const config = parseStoredConfig(integration.configEncrypted)
    if (!config) {
      return NextResponse.json({ error: 'ConfiguraÃ§Ã£o Sankhya invÃ¡lida' }, { status: 503 })
    }

    const baseUrl = normalizeBaseUrl(integration.baseUrl ?? '')
    if (!baseUrl) {
      return NextResponse.json({ error: 'URL base do Sankhya nÃ£o configurada' }, { status: 503 })
    }

    const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey || config.token || null

    const results: Record<string, unknown> = {}
    const sellerFilter = sellerCodes.length > 0 ? `AND CODVEND IN (${sellerCodes.join(', ')})` : ''

    // Test 0: Mirror sellers-performance EXACT query (proven to work)
    try {
      const startDate = '2026-04-01'
      const endDateExclusive = '2026-05-01'
      const rows = await queryRows(baseUrl, headers, `
SELECT
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DTNEG,
  NVL(VEN.APELIDO, 'SEM VENDEDOR') AS VENDEDOR,
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  TO_CHAR(NVL(CAB.CODPARC, 0)) AS CODPARC,
  TO_CHAR(CAB.NUNOTA) AS NUNOTA,
  NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
  NVL(CAB.PESOBRUTO, 0) AS PESOBRUTO,
  NVL(CAB.QTDVOL, 0) AS QTDVOL,
  NVL(CAB.STATUSNOTA, 'L') AS STATUSNOTA,
  TO_CHAR(CAB.CODEMP) AS CODEMP
FROM TGFCAB CAB
LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
WHERE CAB.DTNEG >= TO_DATE('${startDate}', 'YYYY-MM-DD')
  AND CAB.DTNEG < TO_DATE('${endDateExclusive}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  AND CAB.CODTIPOPER = 1001
  AND CAB.CODEMP = 1
ORDER BY CAB.CODVEND
      `.trim(), appKey, { allowEmpty: true, logTag: 'metas-mirror' })
      results.metasMirrorQuery = { rowCount: rows.length, sample: rows.slice(0, 2) }
    } catch (err) {
      results.metasMirrorQueryError = err instanceof Error ? err.message : 'erro'
    }

    // Test 1: TGFCAB only â€” count ALL orders (no date filter)
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT COUNT(1) AS TOTAL FROM TGFCAB WHERE ROWNUM <= 1
      `.trim(), appKey, { allowEmpty: true, logTag: 'count-all' })
      results.totalOrdersAllTime = rows[0]?.TOTAL ?? 0
    } catch (err) {
      results.totalOrdersAllTimeError = err instanceof Error ? err.message : 'erro'
    }

    // Test 2: Count total orders for these sellers (no status filter, last 30 days)
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT COUNT(1) AS TOTAL FROM TGFCAB
        WHERE DTNEG >= ADD_MONTHS(SYSDATE, -1)
          ${sellerFilter}
      `.trim(), appKey, { allowEmpty: true, logTag: 'count-30d' })
      results.totalOrdersLast30Days = rows[0]?.TOTAL ?? 0
    } catch (err) {
      results.totalOrdersLast30DaysError = err instanceof Error ? err.message : 'erro'
    }

    // Test 3: Count by STATUSNOTA (no date filter)
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT NVL(STATUSNOTA, 'NULL') AS STATUS, COUNT(1) AS TOTAL
        FROM TGFCAB
        WHERE ROWNUM <= 1000
        GROUP BY STATUSNOTA
        ORDER BY COUNT(1) DESC
      `.trim(), appKey, { allowEmpty: true, logTag: 'status-breakdown' })
      results.statusNotaBreakdown = rows.map((r) => ({ status: r.STATUS, count: r.TOTAL }))
    } catch (err) {
      results.statusNotaBreakdownError = err instanceof Error ? err.message : 'erro'
    }

    // Test 4: Check PENDENTE breakdown (no date filter)
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT NVL(PENDENTE, 'NULL') AS PEND, COUNT(1) AS TOTAL
        FROM TGFCAB
        WHERE ROWNUM <= 1000
        GROUP BY PENDENTE
        ORDER BY COUNT(1) DESC
      `.trim(), appKey, { allowEmpty: true, logTag: 'pend-breakdown' })
      results.pendenteBreakdown = rows.map((r) => ({ pendente: r.PEND, count: r.TOTAL }))
    } catch (err) {
      results.pendenteBreakdownError = err instanceof Error ? err.message : 'erro'
    }

    // Test 5: Sample 5 orders (no date filter)
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT TO_CHAR(NUNOTA) AS NUNOTA, TO_CHAR(CODVEND) AS CODVEND,
               NVL(STATUSNOTA, 'NULL') AS STATUSNOTA, DTNEG,
               NVL(PENDENTE, 'NULL') AS PENDENTE,
               TIPMOV, CODTIPOPER
        FROM TGFCAB
        WHERE ROWNUM <= 5
        ORDER BY DTNEG DESC
      `.trim(), appKey, { allowEmpty: true, logTag: 'sample-orders' })
      results.sampleOrders = rows
    } catch (err) {
      results.sampleOrdersError = err instanceof Error ? err.message : 'erro'
    }

    // Test 6: Verify seller codes exist in TGFVEN
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT TO_CHAR(CODVEND) AS CODVEND, UPPER(TRIM(APELIDO)) AS APELIDO
        FROM TGFVEN
        WHERE CODVEND IN (${sellerCodes.join(', ') || '0'})
        ORDER BY APELIDO
      `.trim(), appKey, { allowEmpty: true, logTag: 'sellers-in-db' })
      results.sellersInDb = rows
    } catch (err) {
      results.sellersInDbError = err instanceof Error ? err.message : 'erro'
    }

    // Test 7: All sellers in TGFVEN
    try {
      const rows = await queryRows(baseUrl, headers, `
        SELECT TO_CHAR(CODVEND) AS CODVEND, UPPER(TRIM(APELIDO)) AS APELIDO
        FROM TGFVEN
        WHERE ROWNUM <= 20
        ORDER BY APELIDO
      `.trim(), appKey, { allowEmpty: true, logTag: 'all-sellers' })
      results.allSellersSample = rows
    } catch (err) {
      results.allSellersSampleError = err instanceof Error ? err.message : 'erro'
    }

    // Test 8: Full JOIN query (what faturamento uses) â€” corrected
    try {
      const today = new Date().toISOString().slice(0, 10)
      const rows = await queryRows(baseUrl, headers, `
SELECT
  TO_CHAR(CAB.NUNOTA) AS NUNOTA,
  TO_CHAR(CAB.CODVEND) AS CODVEND,
  UPPER(TRIM(NVL(VEN.APELIDO, 'SEM VENDEDOR'))) AS VENDEDOR,
  TO_CHAR(CAB.CODPARC) AS CODPARC,
  UPPER(TRIM(PAR.NOMEPARC)) AS CLIENTE,
  UPPER(TRIM(NVL(CID.NOMECID, 'SEM CIDADE'))) AS CIDADE,
  UPPER(TRIM(NVL(UF.UF, ''))) AS UF,
  TO_CHAR(CAB.CODTIPOPER) AS CODTIPOPER,
  UPPER(TRIM(CAB.TIPMOV)) AS TIPMOV,
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DTNEG,
  TO_CHAR(I.CODPROD) AS CODPROD,
  UPPER(TRIM(P.DESCRPROD)) AS PRODUTO,
  UPPER(TRIM(NVL(P.MARCA, ''))) AS GRUPO,
  UPPER(TRIM(TO_CHAR(P.CODVOL))) AS UNIDADE,
  I.QTDNEG AS QUANTIDADE,
  NVL(I.PESO, 0) AS PESO_KG
FROM TGFCAB CAB
INNER JOIN TGFITE I   ON I.NUNOTA   = CAB.NUNOTA
INNER JOIN TGFPRO P   ON P.CODPROD  = I.CODPROD
INNER JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
INNER JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
LEFT  JOIN TSICID CID ON CID.CODCID = PAR.CODCID
LEFT  JOIN TSIUFS UF  ON UF.CODUF   = CID.UF
WHERE CAB.DTNEG >= TO_DATE('${today}', 'YYYY-MM-DD')
  AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
  AND CAB.CODVEND > 0
  ${sellerFilter}
ORDER BY VEN.APELIDO, CID.NOMECID, CAB.NUNOTA, I.CODPROD
      `.trim(), appKey, { allowEmpty: true, logTag: 'full-join' })
      results.fullJoinQuery = { rowCount: rows.length, sample: rows.slice(0, 2) }
    } catch (err) {
      results.fullJoinQueryError = err instanceof Error ? err.message : 'erro'
    }

    return NextResponse.json({
      sellerCodes,
      baseUrl,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[faturamento/diagnose] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

