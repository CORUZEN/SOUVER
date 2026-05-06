import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, isUserManager } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'NÃ£o autenticado' }, { status: 401 })

  await prisma.department.upsert({
    where: { code: 'DESENV' },
    update: {
      name: 'Desenvolvimento',
      description: 'Engenharia e desenvolvimento de software',
    },
    create: {
      name: 'Desenvolvimento',
      code: 'DESENV',
      description: 'Engenharia e desenvolvimento de software',
    },
  })

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, code: true, description: true, managerUserId: true,
      manager: { select: { id: true, fullName: true } },
      _count: { select: { users: true } },
    },
  })

  return NextResponse.json({ departments })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'NÃ£o autenticado' }, { status: 401 })

  if (!isUserManager(user.role?.code)) {
    return NextResponse.json({ message: 'Ãrea restrita a administradores.' }, { status: 403 })
  }

  const body = await req.json()
  const { name, code, description, managerUserId } = body

  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Nome e cÃ³digo sÃ£o obrigatÃ³rios' }, { status: 400 })
  }

  const existing = await prisma.department.findFirst({
    where: { OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }] },
  })
  if (existing) {
    return NextResponse.json({ error: 'Nome ou cÃ³digo jÃ¡ existem' }, { status: 409 })
  }

  const department = await prisma.department.create({
    data: {
      name:          name.trim(),
      code:          code.trim().toUpperCase(),
      description:   description?.trim() || null,
      managerUserId: managerUserId || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: user.id, module: 'departments', action: 'DEPARTMENT_CREATED',
      entityType: 'Department', entityId: department.id,
      newData: { name: department.name, code: department.code },
    },
  })

  return NextResponse.json({ department }, { status: 201 })
}


