import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, fullName: true } },
      users:   { select: { id: true, fullName: true, status: true, role: { select: { name: true } } } },
      _count:  { select: { users: true, batches: true, nonConformances: true } },
    },
  })
  if (!dept) return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 })
  return NextResponse.json({ department: dept })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, code, description, managerUserId } = body

  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Nome e código são obrigatórios' }, { status: 400 })
  }

  const conflict = await prisma.department.findFirst({
    where: {
      AND: [
        { id: { not: id } },
        { OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }] },
      ],
    },
  })
  if (conflict) return NextResponse.json({ error: 'Nome ou código já existem' }, { status: 409 })

  const updated = await prisma.department.update({
    where: { id },
    data: {
      name:          name.trim(),
      code:          code.trim().toUpperCase(),
      description:   description?.trim() || null,
      managerUserId: managerUserId || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: user.id, module: 'departments', action: 'DEPARTMENT_UPDATED',
      entityType: 'Department', entityId: id,
      newData: { name: updated.name, code: updated.code },
    },
  })

  return NextResponse.json({ department: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const userCount = await prisma.user.count({ where: { departmentId: id } })
  if (userCount > 0) {
    return NextResponse.json({ error: `Não é possível excluir: ${userCount} colaborador(es) vinculado(s)` }, { status: 409 })
  }

  await prisma.department.delete({ where: { id } })

  await prisma.auditLog.create({
    data: {
      userId: user.id, module: 'departments', action: 'DEPARTMENT_DELETED',
      entityType: 'Department', entityId: id,
    },
  })

  return NextResponse.json({ ok: true })
}
