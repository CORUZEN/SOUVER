import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listBatches, createBatch, ProductionShiftValue } from '@/domains/production/production.service'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'

const createSchema = z.object({
  batchCode: z.string().min(1, 'CÃ³digo do lote Ã© obrigatÃ³rio'),
  productName: z.string().min(1, 'Nome do produto Ã© obrigatÃ³rio'),
  productType: z.string().optional(),
  productionLine: z.string().optional(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']),
  plannedQty: z.number().positive().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'producao')
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const result = await listBatches({
    search: searchParams.get('search') ?? undefined,
    status: (searchParams.get('status') as never) ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    shift: (searchParams.get('shift') as unknown as ProductionShiftValue | null) ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 20),
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'producao')
  if (denied) return denied

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo invÃ¡lido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invÃ¡lidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const batch = await createBatch({ ...parsed.data, createdByUserId: user.id })

  emitDomainEvent('production:batch.created', { batchId: batch.id, userId: user.id })

  await auditLog({
    userId: user.id,
    module: 'production',
    entityType: 'ProductionBatch',
    entityId: batch.id,
    action: 'CREATE',
    newData: { batchCode: batch.batchCode, productName: batch.productName },
    description: `Lote criado: ${batch.batchCode} â€” ${batch.productName}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(batch, { status: 201 })
}

