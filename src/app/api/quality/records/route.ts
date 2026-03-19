import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import {
  listQualityRecords,
  createQualityRecord,
  InspectionResultValue,
} from '@/domains/quality/quality.service'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'

const createSchema = z.object({
  batchId:        z.string().optional(),
  inspectionType: z.string().min(1, 'Tipo de inspeção obrigatório'),
  result:         z.enum(['PENDING', 'APPROVED', 'CONDITIONAL', 'REJECTED']),
  notes:          z.string().optional(),
  inspectedAt:    z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const result = await listQualityRecords({
    batchId:       searchParams.get('batchId')       ?? undefined,
    result:        (searchParams.get('result') as unknown as InspectionResultValue | null) ?? undefined,
    inspectedById: searchParams.get('inspectedById') ?? undefined,
    dateFrom:      searchParams.get('dateFrom')      ?? undefined,
    dateTo:        searchParams.get('dateTo')        ?? undefined,
    page:          Number(searchParams.get('page')     ?? 1),
    pageSize:      Number(searchParams.get('pageSize') ?? 20),
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const record = await createQualityRecord({ ...parsed.data, inspectedById: user.id })

  emitDomainEvent('quality:record.created', { recordId: record.id, userId: user.id, result: record.result })

  await auditLog({
    userId:      user.id,
    module:      'quality',
    entityType:  'QualityRecord',
    entityId:    record.id,
    action:      'CREATE',
    newData:     record,
    description: `Inspeção registrada: ${record.inspectionType} — ${record.result}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(record, { status: 201 })
}
