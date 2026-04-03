import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { withRetry, CircuitBreaker, CircuitOpenError } from '@/lib/resilience'

interface SankhyaConfig {
  companyCode?: string | null
  username?: string | null
  password?: string | null
  token?: string | null
  clientId?: string | null
  clientSecret?: string | null
}

// Um circuito por integracao (mantido em memoria do processo)
const circuits = new Map<string, CircuitBreaker>()
function getCircuit(id: string): CircuitBreaker {
  if (!circuits.has(id)) {
    circuits.set(id, new CircuitBreaker(`integration:${id}`, { failureThreshold: 3, recoveryTimeMs: 30_000 }))
  }
  return circuits.get(id)!
}

function parseStoredConfig(raw: string | null | undefined): SankhyaConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as SankhyaConfig
  } catch {
    return {}
  }
}

function buildHeaders(config: SankhyaConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
  }

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
    headers['X-Token'] = config.token
    headers['X-AppKey'] = config.token
  }

  if (config.clientId) headers['X-Client-Id'] = config.clientId
  if (config.clientSecret) headers['X-Client-Secret'] = config.clientSecret

  if (config.username && config.password) {
    const basic = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    headers.Authorization = `Basic ${basic}`
  }

  return headers
}

function mapResponseToResult(status: number): { status: 'success' | 'error'; message: string } {
  if (status >= 200 && status < 300) {
    return { status: 'success', message: `Conexao com o ERP validada (HTTP ${status}).` }
  }
  if (status === 401 || status === 403) {
    return { status: 'error', message: 'Falha de autenticacao no ERP. Revise usuario, senha e tokens.' }
  }
  if (status === 404) {
    return { status: 'error', message: 'Endpoint do ERP nao encontrado. Revise a URL da API.' }
  }
  if (status >= 500) {
    return { status: 'error', message: `Servidor ERP indisponivel no momento (HTTP ${status}).` }
  }
  return { status: 'error', message: `Resposta inesperada do ERP (HTTP ${status}).` }
}

// POST /api/integrations/[id]/test - dispara um teste de conexao
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await params
  const integration = await prisma.integration.findUnique({ where: { id } })
  if (!integration) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })

  const config = parseStoredConfig(integration.configEncrypted)
  const start = Date.now()

  let testStatus: 'success' | 'error' = 'success'
  let testMessage = 'Conexao com o ERP estabelecida com sucesso.'

  if (!integration.baseUrl) {
    testStatus = 'error'
    testMessage = 'A integracao nao possui URL da API configurada.'
  } else if (integration.provider === 'sankhya' && (!config.username || !config.password)) {
    testStatus = 'error'
    testMessage = 'Usuario e senha da API Sankhya sao obrigatorios para validar a conexao.'
  } else {
    try {
      const response = await withRetry(
        () =>
          getCircuit(id).execute(async () => {
            return fetch(integration.baseUrl!, {
              method: 'GET',
              headers: buildHeaders(config),
              signal: AbortSignal.timeout(7000),
            })
          }),
        { maxAttempts: 2, initialDelayMs: 250 }
      )

      const mapped = mapResponseToResult(response.status)
      testStatus = mapped.status
      testMessage = mapped.message
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
