import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import { listNonConformances, createNC, NCStatusValue, NCSeverityValue } from '@/domains/quality/quality.service'
import { auditLog } from '@/domains/audit/audit.service'

const createSchema = z.object({
  title:           z.string().min(1, 'Título obrigatório'),
  description:     z.string().min(1, 'Descrição obrigatória'),
  severity:        z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  batchId:         z.string().optional(),
  departmentId:    z.string().optional(),
  qualityRecordId: z.string().optional(),
  assignedToId:    z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const result = await listNonConformances({
    search:       searchParams.get('search')       ?? undefined,
    severity:     (searchParams.get('severity') as unknown as NCSeverityValue | null) ?? undefined,
    status:       (searchParams.get('status')   as unknown as NCStatusValue   | null) ?? undefined,
    batchId:      searchParams.get('batchId')      ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    assignedToId: searchParams.get('assignedToId') ?? undefined,
    dateFrom:     searchParams.get('dateFrom')     ?? undefined,
    dateTo:       searchParams.get('dateTo')       ?? undefined,
    page:         Number(searchParams.get('page')     ?? 1),
    pageSize:     Number(searchParams.get('pageSize') ?? 20),
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

  const nc = await createNC({ ...parsed.data, openedById: user.id })

  await auditLog({
    userId:      user.id,
    module:      'quality',
    entityType:  'NonConformance',
    entityId:    nc.id,
    action:      'CREATE',
    newData:     nc,
    description: `NC aberta: ${nc.title}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(nc, { status: 201 })
}
