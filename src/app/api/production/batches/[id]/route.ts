import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import {
  getBatchById,
  updateBatch,
  changeBatchStatus,
  ProductionStatusValue,
} from '@/domains/production/production.service'
import { auditLog } from '@/domains/audit/audit.service'

const updateSchema = z.object({
  productName: z.string().min(1).optional(),
  productType: z.string().optional(),
  productionLine: z.string().optional(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
  plannedQty: z.number().positive().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
})

const statusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'PAUSED', 'FINISHED', 'CANCELLED']),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const batch = await getBatchById(id)
  if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  return NextResponse.json(batch)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const batch = await updateBatch(id, parsed.data)
  if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  await auditLog({
    userId: user.id,
    module: 'production',
    entityType: 'ProductionBatch',
    entityId: id,
    action: 'UPDATE',
    newData: parsed.data,
    description: `Lote atualizado: ${batch.batchCode}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(batch)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status inválido', details: parsed.error.flatten() }, { status: 422 })
  }

  const batch = await changeBatchStatus(id, parsed.data.status as ProductionStatusValue)

  await auditLog({
    userId: user.id,
    module: 'production',
    entityType: 'ProductionBatch',
    entityId: id,
    action: 'STATUS_CHANGE',
    newData: { status: parsed.data.status },
    description: `Status do lote ${batch.batchCode} alterado para ${parsed.data.status}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(batch)
}
