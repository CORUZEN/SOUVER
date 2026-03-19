import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'

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
  if (!['DEVELOPER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  // Apenas requireTwoFactor é editável aqui
  if (typeof body.requireTwoFactor !== 'boolean') {
    return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })
  }

  const updated = await prisma.role.update({
    where: { id },
    data: { requireTwoFactor: body.requireTwoFactor },
  })

  return NextResponse.json({ role: updated })
}
