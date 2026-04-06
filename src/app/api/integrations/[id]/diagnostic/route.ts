import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { normalizeBaseUrl, parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type RawObject = Record<string, unknown>

interface OAuthAttempt {
  authUrl: string
  ok: boolean
  httpStatus: number | null
  reason: string
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
  const obj = payload as RawObject
  const candidates = [obj.access_token, obj.bearerToken, obj.token, obj.jwt]
  for (const token of candidates) {
    if (typeof token === 'string' && token.trim().length > 0) return token.trim()
  }
  return null
}

function extractGatewayCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as RawObject
  const possible = [
    obj.code,
    obj.errorCode,
    obj?.error && (obj.error as RawObject).code,
    obj?.statusMessage,
  ]
  for (const value of possible) {
    if (typeof value === 'string' && (value.startsWith('GTW') || value.startsWith('CORE_'))) return value
  }
  return null
}

function extractServiceStatus(payload: unknown): { status: string | null; statusMessage: string | null } {
  if (!payload || typeof payload !== 'object') return { status: null, statusMessage: null }
  const obj = payload as RawObject
  const status = typeof obj.status === 'string' ? obj.status.trim() : null
  const statusMessage = typeof obj.statusMessage === 'string' ? obj.statusMessage.trim() : null
  return { status, statusMessage }
}

async function authenticateOAuth(config: SankhyaConfig, baseUrl: string) {
  const result: {
    ok: boolean
    bearerToken: string | null
    attempts: OAuthAttempt[]
    message: string
    authMode: string
  } = {
    ok: false,
    bearerToken: null,
    attempts: [],
    message: '',
    authMode: config.authMode ?? 'OAUTH2',
  }

  if (!config.token || !config.clientId || !config.clientSecret) {
    result.message = 'Credenciais OAuth2 incompletas: token/client_id/client_secret.'
    return result
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  for (const origin of getSankhyaAuthOrigins(baseUrl)) {
    const authUrl = `${origin}/authenticate`
    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': config.token,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      const payload = await response.json().catch(() => null)
      const bearer = response.ok ? extractBearerToken(payload) : null
      if (response.ok && bearer) {
        result.ok = true
        result.bearerToken = bearer
        result.attempts.push({
          authUrl,
          ok: true,
          httpStatus: response.status,
          reason: 'access_token recebido',
        })
        result.message = `OAuth validado em ${authUrl}.`
        return result
      }

      const gatewayCode = extractGatewayCode(payload)
      result.attempts.push({
        authUrl,
        ok: false,
        httpStatus: response.status,
        reason: gatewayCode ? `${gatewayCode}` : `HTTP ${response.status}`,
      })
    } catch (error) {
      result.attempts.push({
        authUrl,
        ok: false,
        httpStatus: null,
        reason: error instanceof Error ? error.message : 'falha de rede',
      })
    }
  }

  result.message = 'Falha de OAuth2 em todas as origens testadas.'
  return result
}

function buildProbeHeaders(config: SankhyaConfig, bearerToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
  } else if (config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
  }

  if (config.token) headers['X-Token'] = config.token
  if (config.appKey) {
    headers.appkey = config.appKey
    headers.AppKey = config.appKey
  }
  return headers
}

async function runSqlAuthorizationProbe(baseUrl: string, headers: Record<string, string>) {
  const endpoint = `${baseUrl}/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`
  const sql = "SELECT 'OK' AS STATUS FROM DUAL"
  const payload = {
    serviceName: 'DbExplorerSP.executeQuery',
    requestBody: { sql },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })

  const data = await response.json().catch(() => null)
  const service = extractServiceStatus(data)
  const unauthorizedMessage = `${service.status ?? ''} ${service.statusMessage ?? ''}`.toLowerCase()
  const unauthorized =
    unauthorizedMessage.includes('nao autorizado') ||
    unauthorizedMessage.includes('não autorizado')

  return {
    ok: response.ok && !unauthorized && service.status !== '3',
    httpStatus: response.status,
    status: service.status,
    statusMessage: service.statusMessage,
    unauthorized,
    endpoint,
  }
}

function extractRequestContext(req: NextRequest) {
  return {
    requestUrl: req.nextUrl.toString(),
    requestHost: req.headers.get('host'),
    xForwardedHost: req.headers.get('x-forwarded-host'),
    xForwardedProto: req.headers.get('x-forwarded-proto'),
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
    userAgent: req.headers.get('user-agent'),
  }
}

// POST /api/integrations/[id]/diagnostic - valida host atual + OAuth + autorizacao SQL
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await params
  const integration = await prisma.integration.findUnique({ where: { id } })
  if (!integration) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })
  if (integration.provider !== 'sankhya') {
    return NextResponse.json({ error: 'Diagnostico disponivel apenas para integracoes Sankhya.' }, { status: 400 })
  }

  const context = extractRequestContext(req)
  const config = parseStoredConfig(integration.configEncrypted)
  const baseUrl = normalizeBaseUrl(integration.baseUrl)
  if (!baseUrl) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'A integracao nao possui URL Sankhya valida.',
        diagnostic: { context },
      },
      { status: 400 }
    )
  }

  const oauth = await authenticateOAuth(config, baseUrl)
  const headers = buildProbeHeaders(config, oauth.bearerToken)

  let sqlProbe:
    | Awaited<ReturnType<typeof runSqlAuthorizationProbe>>
    | { ok: false; unauthorized: false; httpStatus: null; status: null; statusMessage: string; endpoint: string } = {
      ok: false,
      unauthorized: false,
      httpStatus: null,
      status: null,
      statusMessage: 'Teste SQL nao executado.',
      endpoint: `${baseUrl}/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`,
    }

  if (oauth.ok || Boolean(config.username && config.password)) {
    try {
      sqlProbe = await runSqlAuthorizationProbe(baseUrl, headers)
    } catch (error) {
      sqlProbe = {
        ok: false,
        unauthorized: false,
        httpStatus: null,
        status: null,
        statusMessage: error instanceof Error ? error.message : 'Falha ao executar teste SQL.',
        endpoint: `${baseUrl}/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`,
      }
    }
  }

  const overallOk = oauth.ok && sqlProbe.ok
  const message = overallOk
    ? 'Comunicacao autorizada: host atual + OAuth + SQL validados.'
    : sqlProbe.unauthorized
      ? 'OAuth validou, mas o Sankhya recusou SQL (Nao autorizado em DbExplorerSP.executeQuery).'
      : !oauth.ok
        ? 'Falha no OAuth para o host atual com as credenciais configuradas.'
        : 'Falha no teste de comunicacao SQL com o Sankhya.'

  await prisma.integrationLog.create({
    data: {
      integrationId: id,
      eventType: 'TEST',
      status: overallOk ? 'success' : 'error',
      message,
      responsePayload: {
        diagnostic: {
          host: context.requestHost,
          forwardedHost: context.xForwardedHost,
          oauthOk: oauth.ok,
          sqlOk: sqlProbe.ok,
          sqlUnauthorized: sqlProbe.unauthorized,
        },
      },
    },
  })

  return NextResponse.json({
    status: overallOk ? 'success' : 'error',
    message,
    diagnostic: {
      checkedAt: new Date().toISOString(),
      context,
      integration: {
        id: integration.id,
        name: integration.name,
        baseUrl,
      },
      oauth: {
        ok: oauth.ok,
        mode: oauth.authMode,
        message: oauth.message,
        attempts: oauth.attempts,
      },
      sqlProbe,
    },
  })
}
