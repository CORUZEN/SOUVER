import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// GET /api/integrations — lista todas as integrações com contagem de logs
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const integrations = await prisma.integration.findMany({
    include: {
      _count: { select: { logs: true } },
      logs: {
        orderBy: { executedAt: 'desc' },
        take: 1,
        select: { status: true, message: true, executedAt: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ integrations })
}

// POST /api/integrations — cria nova integração
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { name, provider, description, baseUrl } = body ?? {}

  if (!name?.trim() || !provider?.trim()) {
    return NextResponse.json({ error: 'Nome e provedor são obrigatórios.' }, { status: 400 })
  }

  const integration = await prisma.integration.create({
    data: {
      name:        name.trim(),
      provider:    provider.trim().toLowerCase(),
      description: description?.trim() ?? null,
      baseUrl:     baseUrl?.trim() ?? null,
      status:      'INACTIVE',
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      module:     'integrations',
      action:     'INTEGRATION_CREATED',
      entityType: 'Integration',
      entityId:   integration.id,
      newData:    { name: integration.name, provider: integration.provider },
    },
  })

  return NextResponse.json({ integration }, { status: 201 })
}
