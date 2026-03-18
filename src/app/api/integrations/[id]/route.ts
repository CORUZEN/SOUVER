import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/[id] — detalhe + logs paginados
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = 20

  const [integration, logs, total] = await Promise.all([
    prisma.integration.findUnique({
      where: { id },
      include: { _count: { select: { logs: true } } },
    }),
    prisma.integrationLog.findMany({
      where:   { integrationId: id },
      orderBy: { executedAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.integrationLog.count({ where: { integrationId: id } }),
  ])

  if (!integration) return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 })

  return NextResponse.json({ integration, logs, total, page, pages: Math.ceil(total / limit) })
}

// PATCH /api/integrations/[id] — atualiza integração
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const { name, description, baseUrl, status } = body ?? {}

  const existing = await prisma.integration.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 })

  const VALID_STATUS = ['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING']
  if (status && !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  const updated = await prisma.integration.update({
    where: { id },
    data: {
      ...(name        !== undefined && { name:        name.trim() }),
      ...(description !== undefined && { description: description?.trim() ?? null }),
      ...(baseUrl     !== undefined && { baseUrl:     baseUrl?.trim() ?? null }),
      ...(status      !== undefined && { status }),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      module:     'integrations',
      action:     'INTEGRATION_UPDATED',
      entityType: 'Integration',
      entityId:   id,
      newData:    { name: updated.name, status: updated.status },
    },
  })

  return NextResponse.json({ integration: updated })
}

// DELETE /api/integrations/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.integration.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 })

  await prisma.integration.delete({ where: { id } })

  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      module:     'integrations',
      action:     'INTEGRATION_DELETED',
      entityType: 'Integration',
      entityId:   id,
      oldData:    { name: existing.name, provider: existing.provider },
    },
  })

  return NextResponse.json({ message: 'Integração removida.' })
}
