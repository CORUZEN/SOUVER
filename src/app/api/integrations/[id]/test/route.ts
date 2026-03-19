import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { withRetry, CircuitBreaker, CircuitOpenError } from '@/lib/resilience'

// Um circuito por integração (mantido em memória do processo)
const circuits = new Map<string, CircuitBreaker>()
function getCircuit(id: string): CircuitBreaker {
  if (!circuits.has(id)) {
    circuits.set(id, new CircuitBreaker(`integration:${id}`, { failureThreshold: 3, recoveryTimeMs: 30_000 }))
  }
  return circuits.get(id)!
}

// POST /api/integrations/[id]/test — dispara um teste de conexão simulado
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const integration = await prisma.integration.findUnique({ where: { id } })
  if (!integration) return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 })

  const start = Date.now()

  // Simulação de teste de conectividade.
  // PRODUCTION_NOTE: substitua este bloco pela lógica real de conexão com o provider.
  let testStatus: 'success' | 'error' = 'success'
  let testMessage = 'Conexão estabelecida com sucesso.'

  if (!integration.baseUrl) {
    testStatus  = 'error'
    testMessage = 'URL base não configurada.'
  } else {
    try {
      await withRetry(
        () => getCircuit(id).execute(async () => {
          const res = await fetch(integration.baseUrl!, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          })
          if (!res.ok) throw new Error(`Servidor respondeu com status ${res.status}.`)
        }),
        { maxAttempts: 2, initialDelayMs: 200 },
      )
    } catch (err: unknown) {
      testStatus = 'error'
      if (err instanceof CircuitOpenError) {
        testMessage = `Circuito aberto após falhas repetidas. Aguarde ${Math.ceil(err.retryAfterMs / 1000)}s.`
      } else {
        testMessage = err instanceof Error ? err.message : 'Falha de conexão.'
      }
    }
  }

  const durationMs = Date.now() - start
  const now = new Date()

  // Registra log
  const log = await prisma.integrationLog.create({
    data: {
      integrationId: id,
      eventType:     'TEST',
      status:        testStatus,
      message:       testMessage,
      durationMs,
    },
  })

  // Atualiza status da integração
  await prisma.integration.update({
    where: { id },
    data:  {
      lastSyncAt:     now,
      lastSyncStatus: testStatus,
      status:         testStatus === 'success' ? 'ACTIVE' : 'ERROR',
    },
  })

  return NextResponse.json({ status: testStatus, message: testMessage, durationMs, log })
}
