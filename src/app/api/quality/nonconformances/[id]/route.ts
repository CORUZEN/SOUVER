import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import { getNCById, updateNC, changeNCStatus, NCStatusValue } from '@/domains/quality/quality.service'
import { auditLog } from '@/domains/audit/audit.service'

const updateSchema = z.object({
  title:        z.string().min(1).optional(),
  description:  z.string().min(1).optional(),
  severity:     z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedToId: z.string().nullable().optional(),
  resolution:   z.string().optional(),
})

const statusSchema = z.object({
  status: z.enum(['OPEN', 'IN_ANALYSIS', 'IN_TREATMENT', 'RESOLVED', 'CLOSED']),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const nc = await getNCById(id)
  if (!nc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(nc)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const existing = await getNCById(id)
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await updateNC(id, parsed.data)

  await auditLog({
    userId:      user.id,
    module:      'quality',
    entityType:  'NonConformance',
    entityId:    id,
    action:      'UPDATE',
    oldData:     existing,
    newData:     updated,
    description: `NC atualizada: ${updated.title}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(updated)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const existing = await getNCById(id)
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 422 })
  }

  const updated = await changeNCStatus(id, parsed.data.status as NCStatusValue)

  await auditLog({
    userId:      user.id,
    module:      'quality',
    entityType:  'NonConformance',
    entityId:    id,
    action:      'STATUS_CHANGE',
    oldData:     { status: existing.status },
    newData:     { status: updated.status },
    description: `NC ${id} → ${parsed.data.status}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(updated)
}
