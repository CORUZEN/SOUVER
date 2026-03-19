import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { jobQueue } from '@/lib/jobs'

/**
 * GET /api/jobs/status — Retorna status da fila de jobs
 * POST /api/jobs/enqueue — Enfileira um novo job (admin only)
 */

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const stats = jobQueue.stats()
  const recent = jobQueue.recent(20)

  return NextResponse.json({ stats, recent })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.type) {
    return NextResponse.json({ error: 'Tipo de job obrigatório' }, { status: 400 })
  }

  const jobId = jobQueue.enqueue(body.type, body.payload ?? {}, {
    maxAttempts: body.maxAttempts ?? 3,
  })

  return NextResponse.json({ jobId, message: 'Job enfileirado com sucesso' }, { status: 201 })
}
