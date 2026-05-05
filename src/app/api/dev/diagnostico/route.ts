import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'
import {
  authenticateSankhyaCached,
  buildHeaders,
  collectRecords,
  getSqlEndpoints,
  extractServiceError,
} from '@/lib/integrations/sankhya-auth'

type RawRecord = Record<string, unknown>

async function isDeveloper(req: NextRequest): Promise<boolean> {
  const user = await getAuthUser(req)
  return user?.role?.code === 'DEVELOPER'
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const n = Number(value.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

async function runSql(
  baseUrl: string,
  headers: Record<string, string>,
  sql: string,
  appKey?: string | null,
): Promise<{ records: RawRecord[]; endpoint: string }> {
  const hasBearer = /^Bearer\s+/i.test(headers.Authorization ?? '')
  const failures: string[] = []
  for (const endpoint of getSqlEndpoints(baseUrl, appKey, hasBearer)) {
    for (const body of [
      { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
      { requestBody: { sql } },
    ]) {
      try {
        const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
        const data = await res.json().catch(() => null)
        if (!res.ok) { failures.push(`HTTP ${res.status} @ ${endpoint}`); continue }
        const err = extractServiceError(data)
        if (err) { failures.push(`${err} @ ${endpoint}`); continue }
        const records: RawRecord[] = []
        collectRecords(data, records)
        return { records, endpoint }
      } catch (e) {
        failures.push(`${e instanceof Error ? e.message : 'rede'} @ ${endpoint}`)
      }
    }
  }
  throw new Error(failures.join(' | ') || 'query falhou')
}

export async function GET(req: NextRequest) {
  if (!(await isDeveloper(req))) {
    return NextResponse.json({ ok: false, error: 'Acesso restrito ao perfil Desenvolvedor.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const action = searchParams.get('action') ?? 'status'
  const nunota = searchParams.get('nunota')?.trim()
  const dateFrom = searchParams.get('dateFrom') ?? new Date().toISOString().slice(0, 10)
  const dateTo = searchParams.get('dateTo') ?? dateFrom

  if (action === 'status') {
    const [integrationRow, userCount, sessionCount] = await Promise.all([
      prisma.integration.findFirst({ where: { provider: 'sankhya' }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, status: true, baseUrl: true, updatedAt: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.userSession.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
    ])
    return NextResponse.json({
      ok: true,
      system: { timestamp: new Date().toISOString(), nodeEnv: process.env.NODE_ENV, appEnv: process.env.APP_ENV, usersActive: userCount, sessionsActive: sessionCount },
      integration: integrationRow ? { id: integrationRow.id, name: integrationRow.name, status: integrationRow.status, baseUrl: integrationRow.baseUrl, updatedAt: integrationRow.updatedAt } : null,
    })
  }

  const integration = await prisma.integration.findFirst({
    where: { provider: 'sankhya', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, baseUrl: true, configEncrypted: true },
  })
  if (!integration?.configEncrypted) return NextResponse.json({ ok: false, error: 'Integração Sankhya não configurada ou inativa.' }, { status: 412 })
  const config = parseStoredConfig(integration.configEncrypted) as SankhyaConfig
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) return NextResponse.json({ ok: false, error: 'baseUrl inválida.' }, { status: 412 })

  if (action === 'connection') {
    const start = Date.now()
    try {
      const res = await fetch(`${baseUrl}/mge/service.sbr?serviceName=AutenticacaoSP.login&outputType=json`, { method: 'GET', signal: AbortSignal.timeout(8_000) })
      return NextResponse.json({ ok: res.status < 500, httpStatus: res.status, reachable: res.status < 500, elapsedMs: Date.now() - start, baseUrl })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'timeout', elapsedMs: Date.now() - start, baseUrl }, { status: 502 })
    }
  }

  if (action === 'auth') {
    const start = Date.now()
    try {
      const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)
      return NextResponse.json({ ok: !!bearerToken, authMode: config.authMode ?? 'OAUTH2', bearerObtained: !!bearerToken, bearerPreview: bearerToken ? `${bearerToken.slice(0, 12)}...` : null, elapsedMs: Date.now() - start })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'auth falhou', elapsedMs: Date.now() - start }, { status: 502 })
    }
  }

  if (action === 'inspect-pedido') {
    if (!nunota || !/^\d+$/.test(nunota)) return NextResponse.json({ ok: false, error: 'nunota inválido.' }, { status: 400 })
    const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey || config.token || null
    const sqlRaw = `SELECT I.NUNOTA, I.SEQUENCIA, I.CODPROD, P.DESCRPROD, P.CODVOL AS PRD_CODVOL, P.MEDAUX AS PRD_MEDAUX, P.CONVERVOL AS PRD_CONVERVOL, P.FATTOTAL AS PRD_FATTOTAL, P.QTDEMB AS PRD_QTDEMB, P.MULTIPVENDA AS PRD_MULTIPVENDA, P.PESOBRUTO AS PRD_PESOBRUTO, I.CODVOL AS ITE_CODVOL, I.QTDNEG, I.QTDVOL, I.VLRUNIT, I.PESO FROM TGFITE I INNER JOIN TGFPRO P ON P.CODPROD = I.CODPROD WHERE I.NUNOTA = ${nunota} ORDER BY I.SEQUENCIA`
    const sqlSim = `SELECT TO_CHAR(CAB.NUNOTA) AS NUNOTA, TO_CHAR(I.CODPROD) AS CODPROD, UPPER(TRIM(P.DESCRPROD)) AS PRODUTO, UPPER(TRIM(TO_CHAR(P.CODVOL))) AS PRD_CODVOL, UPPER(TRIM(NVL(TO_CHAR(I.CODVOL), TO_CHAR(P.CODVOL)))) AS ITE_CODVOL, NVL(P.MEDAUX, 1) AS MEDAUX, NVL(P.CONVERVOL, 1) AS CONVERVOL, NVL(P.FATTOTAL, 1) AS FATTOTAL, SUM(I.QTDNEG) AS QTDNEG_SUM, SUM(NVL(I.QTDVOL, 0)) AS QTDVOL_SUM, SUM(NVL(I.PESO, NVL(P.PESOBRUTO, 0) * I.QTDNEG)) AS PESO_KG, NVL(CAB.APROVADO, 'N') AS APROVADO, NVL(CAB.PENDENTE, 'N') AS PENDENTE FROM TGFCAB CAB INNER JOIN TGFITE I ON I.NUNOTA = CAB.NUNOTA INNER JOIN TGFPRO P ON P.CODPROD = I.CODPROD WHERE CAB.NUNOTA = ${nunota} GROUP BY CAB.NUNOTA, I.CODPROD, P.DESCRPROD, P.CODVOL, I.CODVOL, P.MEDAUX, P.CONVERVOL, P.FATTOTAL, CAB.APROVADO, CAB.PENDENTE ORDER BY I.CODPROD`
    const sqlCabLiberacao = `SELECT CAB.NUNOTA, CAB.NUMNOTA, TO_CHAR(CAB.DTNEG,'YYYY-MM-DD') AS DTNEG, CAB.PENDENTE, CAB.APROVADO, CAB.STATUSNOTA, CAB.LIBCONF, CAB.CONFIRMNOTAFAT, CAB.SEQCONFIRMA, CAB.CODUSU, CAB.CODUSUINC, CAB.CODVEND, CAB.CODTIPOPER, CAB.CODTIPVENDA, CAB.CODOBSPADRAO, CAB.OBSERVACAO, CAB.VLRNOTA, TO_CHAR(CAB.AD_DHCONFIRMVDY,'YYYY-MM-DD HH24:MI:SS') AS AD_DHCONFIRMVDY, TO_CHAR(CAB.DTALTER,'YYYY-MM-DD HH24:MI:SS') AS DTALTER, P.NOMEPARC, V.APELIDO AS VENDEDOR, U.NOMEUSU AS USUARIO, UIC.NOMEUSU AS USUARIO_INC, T.DESCROPER AS TIPO_OPERACAO FROM TGFCAB CAB LEFT JOIN TGFPAR P ON P.CODPARC = CAB.CODPARC LEFT JOIN TGFVEN V ON V.CODVEND = CAB.CODVEND LEFT JOIN TSIUSU U ON U.CODUSU = CAB.CODUSU LEFT JOIN TSIUSU UIC ON UIC.CODUSU = CAB.CODUSUINC LEFT JOIN TGFTOP T ON T.CODTIPOPER = CAB.CODTIPOPER WHERE CAB.NUNOTA = ${nunota}`
    const sqlLiberacoes = `SELECT L.NUNOTA, L.CODUSU, U.NOMEUSU, TO_CHAR(L.DT,'YYYY-MM-DD HH24:MI:SS') AS DT, L.LIBERACOES, L.OBS FROM TGFLIB L LEFT JOIN TSIUSU U ON U.CODUSU = L.CODUSU WHERE L.NUNOTA = ${nunota} ORDER BY L.DT`
    const sqlItensStatus = `SELECT I.NUNOTA, I.SEQUENCIA, I.CODPROD, P.DESCRPROD, I.PENDENTE, I.STATUSNOTA, I.QTDCONFERIDA, I.CODOBSPADRAO, I.QTDNEG, I.QTDVOL, I.VLRTOT FROM TGFITE I INNER JOIN TGFPRO P ON P.CODPROD = I.CODPROD WHERE I.NUNOTA = ${nunota} ORDER BY I.SEQUENCIA`
    const sqlVsiLib = `SELECT V.NUNOTA, V.NUCHAVE, V.EVENTO, E.DESCRICAO AS EVENTO_DESCR, V.SEQUENCIA, V.CODUSUSOLICIT, US.NOMEUSU AS USUARIO_SOLICIT, V.DHSOLICIT, V.VLRLIMITE, V.VLRATUAL, V.VLRLIBERADO, V.CODUSULIB, UL.NOMEUSU AS USUARIO_LIB, V.DHLIB, V.OBSERVACAO, V.OBSLIB, V.REPROVADO, V.VLRNOTA, V.STATUSNOTA, V.CODPARC, V.CODVEND, V.DTNEG, V.CODTIPOPER FROM VSILIB V LEFT JOIN VGFLIBEVE E ON E.EVENTO = V.EVENTO LEFT JOIN TSIUSU US ON US.CODUSU = V.CODUSUSOLICIT LEFT JOIN TSIUSU UL ON UL.CODUSU = V.CODUSULIB WHERE V.NUNOTA = ${nunota} ORDER BY V.SEQUENCIA, V.DHSOLICIT`
    const start = Date.now()
    const [rawResult, simResult, cabResult, libResult, itemResult, vsiResult] = await Promise.allSettled([
      runSql(baseUrl, headers, sqlRaw, appKey),
      runSql(baseUrl, headers, sqlSim, appKey),
      runSql(baseUrl, headers, sqlCabLiberacao, appKey),
      runSql(baseUrl, headers, sqlLiberacoes, appKey),
      runSql(baseUrl, headers, sqlItensStatus, appKey),
      runSql(baseUrl, headers, sqlVsiLib, appKey),
    ])
    const simRows = simResult.status === 'fulfilled'
      ? simResult.value.records.map(r => {
          const medaux = Math.max(1, parseNumber(r.MEDAUX) || 1)
          const convervol = Math.max(1, parseNumber(r.CONVERVOL) || 1)
          const fattotal = Math.max(1, parseNumber(r.FATTOTAL) || 1)
          const prdUnit = String(r.PRD_CODVOL ?? '')
          const iteUnit = String(r.ITE_CODVOL ?? '')
          const unitMismatch = iteUnit !== prdUnit && iteUnit !== ''
          const nameFactor = unitMismatch ? (() => { const m = String(r.PRODUTO ?? '').match(/\b(\d+)[Xx]\d/); return m ? Math.max(1, parseInt(m[1], 10)) : 1 })() : 1
          const factor = convervol > 1 ? convervol : fattotal > 1 ? fattotal : medaux > 1 ? medaux : nameFactor
          const qtdneg = parseNumber(r.QTDNEG_SUM)
          const qtdvol = parseNumber(r.QTDVOL_SUM)
          const unitFinal = factor > 1 ? 'UN' : (iteUnit || prdUnit)
          const qtyFinal = factor > 1 ? Math.round(qtdneg * factor) : qtdneg
          return {
            ...r,
            _analysis: {
              medaux, convervol, fattotal, factor, qtdneg, qtdvol,
              ite_unit: iteUnit, prd_unit: prdUnit, unit_mismatch: unitMismatch,
              unit_final: unitFinal, qty_final: qtyFinal,
              souver_displays: `${qtyFinal} ${unitFinal}`,
              conversion_source: convervol > 1 ? 'CONVERVOL' : fattotal > 1 ? 'FATTOTAL' : medaux > 1 ? 'MEDAUX' : nameFactor > 1 ? 'NOME_PRODUTO' : qtdvol > 0 ? 'QTDVOL' : 'none',
              diagnosis: convervol > 1
                ? `CONVERVOL=${convervol} → ${qtdneg} × ${convervol} = ${qtyFinal} UN`
                : fattotal > 1
                  ? `FATTOTAL=${fattotal} → ${qtdneg} × ${fattotal} = ${qtyFinal} UN`
                  : medaux > 1
                    ? `MEDAUX=${medaux} → ${qtdneg} × ${medaux} = ${qtyFinal} UN`
                    : nameFactor > 1
                      ? `Nome "${String(r.PRODUTO ?? '').match(/\d+[Xx]\d+[A-Za-z]*/)?.[0] ?? ''}" → fator ${nameFactor} → ${qtdneg} × ${nameFactor} = ${qtyFinal} UN`
                      : unitMismatch ? `ITE_CODVOL(${iteUnit}) ≠ PRD_CODVOL(${prdUnit}) — fator não encontrado` : qtdvol > 0 ? `QTDVOL=${qtdvol} → usar diretamente` : `Sem fator detectado — exibe ${qtdneg} ${iteUnit || prdUnit}`,
            },
          }
        })
      : []
    return NextResponse.json({
      ok: true, nunota, elapsedMs: Date.now() - start,
      endpoint: simResult.status === 'fulfilled' ? simResult.value.endpoint : (rawResult.status === 'fulfilled' ? rawResult.value.endpoint : null),
      raw: { ok: rawResult.status === 'fulfilled', error: rawResult.status === 'rejected' ? String(rawResult.reason?.message) : null, rows: rawResult.status === 'fulfilled' ? rawResult.value.records : [] },
      simulation: { ok: simResult.status === 'fulfilled', error: simResult.status === 'rejected' ? String(simResult.reason?.message) : null, rows: simRows },
      cabecalho: { ok: cabResult.status === 'fulfilled', error: cabResult.status === 'rejected' ? String(cabResult.reason?.message) : null, rows: cabResult.status === 'fulfilled' ? cabResult.value.records : [] },
      liberacoes: { ok: libResult.status === 'fulfilled', error: libResult.status === 'rejected' ? String(libResult.reason?.message) : null, rows: libResult.status === 'fulfilled' ? libResult.value.records : [] },
      itensStatus: { ok: itemResult.status === 'fulfilled', error: itemResult.status === 'rejected' ? String(itemResult.reason?.message) : null, rows: itemResult.status === 'fulfilled' ? itemResult.value.records : [] },
      vsiLiberacoes: { ok: vsiResult.status === 'fulfilled', error: vsiResult.status === 'rejected' ? String(vsiResult.reason?.message) : null, rows: vsiResult.status === 'fulfilled' ? vsiResult.value.records : [] },
    })
  }

  if (action === 'custom-sql') {
    const sql = searchParams.get('sql')?.trim()
    if (!sql || sql.length < 6) return NextResponse.json({ ok: false, error: 'Parâmetro sql ausente.' }, { status: 400 })
    if (!/^\s*SELECT\s/i.test(sql)) return NextResponse.json({ ok: false, error: 'Apenas SELECT é permitido.' }, { status: 400 })
    const bearerToken = await authenticateSankhyaCached(config, baseUrl, integration.id)
    const headers = buildHeaders(config, bearerToken)
    const appKey = config.appKey || config.token || null
    const start = Date.now()
    try {
      const result = await runSql(baseUrl, headers, sql, appKey)
      return NextResponse.json({ ok: true, elapsedMs: Date.now() - start, endpoint: result.endpoint, rowCount: result.records.length, rows: result.records })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'query falhou' }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: false, error: `Ação desconhecida: ${action}` }, { status: 400 })
}
