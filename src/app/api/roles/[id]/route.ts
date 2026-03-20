import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      rolePermissions: {
        include: {
          permission: { select: { id: true, module: true, action: true, code: true, description: true } },
        },
        orderBy: [{ permission: { module: 'asc' } }, { permission: { action: 'asc' } }],
      },
    },
  })

  if (!role) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  return NextResponse.json({ role })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })
  if (!['DEVELOPER', 'ADMIN'].includes(user.role?.code ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  // Editable fields: requireTwoFactor and sessionDurationHours
  const updates: { requireTwoFactor?: boolean; sessionDurationHours?: number | null } = {}

  if (typeof body.requireTwoFactor === 'boolean') {
    updates.requireTwoFactor = body.requireTwoFactor
  }

  if ('sessionDurationHours' in body) {
    if (body.sessionDurationHours === null || body.sessionDurationHours === undefined) {
      updates.sessionDurationHours = null
    } else if (typeof body.sessionDurationHours === 'number' && body.sessionDurationHours >= 1 && body.sessionDurationHours <= 720) {
      updates.sessionDurationHours = Math.round(body.sessionDurationHours)
    } else {
      return NextResponse.json({ error: 'sessionDurationHours deve ser um número entre 1 e 720 (horas)' }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido enviado' }, { status: 400 })
  }

  const updated = await prisma.role.update({
    where: { id },
    data: updates,
  })

  await auditLog({
    userId:      user.id,
    module:      'system',
    action:      'PERMISSION_CHANGED',
    entityType:  'Role',
    entityId:    id,
    description: `Perfil ${updated.name} atualizado: ${JSON.stringify(updates)}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
  })

  return NextResponse.json({ role: updated })
}
