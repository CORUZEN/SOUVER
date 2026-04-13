import { NextRequest, NextResponse } from 'next/server'
import { canAccessIntegrations, getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { withRetry, CircuitBreaker, CircuitOpenError } from '@/lib/resilience'
import { parseStoredConfig, type SankhyaConfig } from '@/lib/integrations/config'

type TestStatus = 'success' | 'error'

// Um circuito por integracao (mantido em memoria do processo)
const circuits = new Map<string, CircuitBreaker>()
function getCircuit(id: string): CircuitBreaker {
  if (!circuits.has(id)) {
    circuits.set(id, new CircuitBreaker(`integration:${id}`, { failureThreshold: 3, recoveryTimeMs: 30_000 }))
  }
  return circuits.get(id)!
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

function mapResponseToResult(status: number): { status: TestStatus; message: string } {
  if (status >= 200 && status < 300) return { status: 'success', message: `Conexao com o ERP validada (HTTP ${status}).` }
  if (status === 401 || status === 403) return { status: 'error', message: 'Falha de autenticacao no ERP. Revise token e credenciais.' }
  if (status === 404) return { status: 'error', message: 'Endpoint nao encontrado. Revise a URL da API configurada.' }
  if (status === 405) return { status: 'success', message: 'Autenticacao validada. O endpoint nao aceita GET (HTTP 405).' }
  if (status === 429) return { status: 'error', message: 'Limite de requisicoes atingido (HTTP 429). Tente novamente em instantes.' }
  if (status >= 500) return { status: 'error', message: `Servicos Sankhya indisponiveis no momento (HTTP ${status}).` }
  return { status: 'error', message: `Resposta inesperada do ERP (HTTP ${status}).` }
}

function mapGatewayCodeToMessage(code: string) {
  if (code.startsWith('GTW2510') || code.startsWith('GTW2511')) return 'Authorization Bearer ausente ou em formato invalido.'
  if (code.startsWith('GTW3403')) return 'Bearer token invalido ou expirado. Refaca autenticacao.'
  if (code.startsWith('GTW3503')) return 'Tempo maximo da requisicao do gateway excedido.'
  if (code.startsWith('GTW2509')) return 'Erro de paginacao/parametros no serviço de consulta.'
  if (code.startsWith('GTW3407')) return 'Nao foi possivel realizar login no ERP. Verifique ambiente e credenciais.'
  if (code.startsWith('CORE_')) return 'Erro de regra de negocio do Sankhya retornado pelo ERP.'
  return 'Erro retornado pelo gateway Sankhya.'
}

function extractGatewayCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const possible = [obj.code, obj.errorCode, obj?.error && (obj.error as Record<string, unknown>).code]
  for (const value of possible) {
    if (typeof value === 'string' && (value.startsWith('GTW') || value.startsWith('CORE_'))) return value
  }
  return null
}

function extractBearerToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const candidates = [obj.access_token, obj.bearerToken, obj.token, obj.jwt]
  for (const token of candidates) {
    if (typeof token === 'string' && token.trim().length > 0) return token.trim()
  }
  return null
}

async function authenticateOAuth(config: SankhyaConfig, baseUrl: string) {
  if (!config.token || !config.clientId || !config.clientSecret) {
    return {
      ok: false,
      message: 'Para OAuth2, informe token, client_id e client_secret.',
      bearerToken: null as string | null,
    }
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })
  const authOrigins = getSankhyaAuthOrigins(baseUrl)
  const attemptMessages: string[] = []

  for (const origin of authOrigins) {
    const authUrl = `${origin}/authenticate`
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': config.token,
      },
      body,
      signal: AbortSignal.timeout(7000),
    })

    const payload = await response.json().catch(() => null)
    if (response.ok) {
      const bearerToken = extractBearerToken(payload)
      if (!bearerToken) {
        attemptMessages.push(`${authUrl} (200 sem access_token)`)
        continue
      }

      return {
        ok: true,
        message: 'Autenticação OAuth2 validada com sucesso.',
        bearerToken,
      }
    }

    const code = extractGatewayCode(payload)
    const reason = code ? `${mapGatewayCodeToMessage(code)} (${code})` : `HTTP ${response.status}`
    attemptMessages.push(`${authUrl} (${reason})`)
  }

  const formattedAttempts = attemptMessages.slice(0, 3).join(' | ')
  return {
    ok: false,
    message: `Falha na autenticação OAuth2. Verifique token/client_id/client_secret e ambiente do Gateway. Tentativas: ${formattedAttempts}`,
    bearerToken: null as string | null,
  }
}

function buildProbeHeaders(config: SankhyaConfig, bearerToken: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
  }

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
    return headers
  }

  if (config.username && config.password) {
    const basic = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    headers.Authorization = `Basic ${basic}`
  }

  if (config.appKey) headers.appkey = config.appKey
  if (config.token) headers['X-Token'] = config.token
  return headers
}

async function runConnectionProbe(id: string, baseUrl: string, headers: HeadersInit) {
  return withRetry(
    () =>
      getCircuit(id).execute(async () => {
        return fetch(baseUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(7000),
        })
      }),
    { maxAttempts: 2, initialDelayMs: 250 }
  )
}

// POST /api/integrations/[id]/test - dispara um teste de conexao
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (!(await canAccessIntegrations(user))) {
    return NextResponse.json({ error: 'Sem permissao para acessar Integracoes.' }, { status: 403 })
  }

  const { id } = await params
  const integration = await prisma.integration.findUnique({ where: { id } })
  if (!integration) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })

  const config = parseStoredConfig(integration.configEncrypted)
  const start = Date.now()

  let testStatus: TestStatus = 'success'
  let testMessage = 'Conexao com o ERP estabelecida com sucesso.'

  if (!integration.baseUrl) {
    testStatus = 'error'
    testMessage = 'A integracao nao possui URL da API configurada.'
  } else {
    try {
      let bearerToken: string | null = null
      const authMode = config.authMode ?? 'OAUTH2'

      if (integration.provider === 'sankhya' && authMode === 'OAUTH2') {
        const auth = await authenticateOAuth(config, integration.baseUrl)
        if (!auth.ok) {
          testStatus = 'error'
          testMessage = auth.message
        } else {
          bearerToken = auth.bearerToken
        }
      }

      if (testStatus !== 'error') {
        const response = await runConnectionProbe(id, integration.baseUrl, buildProbeHeaders(config, bearerToken))
        const payload = await response.clone().json().catch(() => null)
        const code = extractGatewayCode(payload)

        if (code) {
          testStatus = 'error'
          testMessage = `${mapGatewayCodeToMessage(code)} (${code})`
        } else {
          const mapped = mapResponseToResult(response.status)
          testStatus = mapped.status
          testMessage = mapped.message
        }
      }
    } catch (err: unknown) {
      testStatus = 'error'
      if (err instanceof CircuitOpenError) {
        testMessage = `Circuito de resiliencia aberto apos falhas repetidas. Aguarde ${Math.ceil(err.retryAfterMs / 1000)}s.`
      } else {
        testMessage = err instanceof Error ? err.message : 'Falha de conexao com o ERP.'
      }
    }
  }

  const durationMs = Date.now() - start
  const now = new Date()

  const log = await prisma.integrationLog.create({
    data: {
      integrationId: id,
      eventType: 'TEST',
      status: testStatus,
      message: testMessage,
      durationMs,
    },
  })

  await prisma.integration.update({
    where: { id },
    data: {
      lastSyncAt: now,
      lastSyncStatus: testStatus,
      status: testStatus === 'success' ? 'ACTIVE' : 'ERROR',
    },
  })

  return NextResponse.json({ status: testStatus, message: testMessage, durationMs, log })
}
