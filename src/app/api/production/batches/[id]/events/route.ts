import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listBatchEvents, createEvent } from '@/domains/production/production.service'
import { auditLog } from '@/domains/audit/audit.service'

const createEventSchema = z.object({
  type: z.enum(['START', 'PROGRESS', 'PAUSE', 'RESUME', 'WASTE', 'FINISH', 'NOTE']),
  description: z.string().min(1, 'Descrição é obrigatória'),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const denied = await requireModuleInteract(req, 'producao')
  if (denied) return denied

  const { id } = await params
  const events = await listBatchEvents(id)
  return NextResponse.json({ items: events, total: events.length })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const denied = await requireModuleInteract(req, 'producao')
  if (denied) return denied

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const event = await createEvent({
    batchId: id,
    type: parsed.data.type,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
    createdById: user.id,
  })

  await auditLog({
    userId: user.id,
    module: 'production',
    entityType: 'ProductionEvent',
    entityId: event.id,
    action: 'CREATE',
    newData: { batchId: id, type: event.type },
    description: `Evento ${event.type} registrado no lote`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(event, { status: 201 })
}
