import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email('E-mail inválido').optional(),
  login: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  phone: z.string().nullable().optional(),
  password: z.string().min(8).optional().nullable(),
  departmentId: z.string().nullable().optional(),
  roleId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

function ensureDeveloper(user: Awaited<ReturnType<typeof getAuthUser>>) {
  if (!user) return { ok: false as const, response: NextResponse.json({ message: 'Não autenticado' }, { status: 401 }) }
  if (user.role?.code !== 'DEVELOPER') {
    return { ok: false as const, response: NextResponse.json({ message: 'Área Dev exclusiva para desenvolvedor.' }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req)
  const guard = ensureDeveloper(currentUser)
  if (!guard.ok) return guard.response

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      isActive: true,
      status: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  })

  if (!user) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ user })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req)
  const guard = ensureDeveloper(currentUser)
  if (!guard.ok) return guard.response

  const { id } = await params
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, email: true, login: true, isActive: true } })
  if (!target) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Dados inválidos.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { password, ...rest } = parsed.data

  if (rest.email && rest.email !== target.email) {
    const conflict = await prisma.user.findFirst({ where: { email: rest.email, NOT: { id } } })
    if (conflict) return NextResponse.json({ message: 'Este e-mail já esta em uso.' }, { status: 409 })
  }
  if (rest.login && rest.login !== target.login) {
    const conflict = await prisma.user.findFirst({ where: { login: rest.login, NOT: { id } } })
    if (conflict) return NextResponse.json({ message: 'Este login já esta em uso.' }, { status: 409 })
  }

  const updateData: Record<string, unknown> = { ...rest }
  if (password) {
    updateData.passwordHash = await hashPassword(password)
    updateData.passwordChangedAt = new Date()
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, fullName: true, email: true, login: true, isActive: true },
  })

  await auditLog({
    userId: currentUser!.id,
    module: 'users',
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: id,
    oldData: { fullName: target.fullName, email: target.email, login: target.login, isActive: target.isActive },
    newData: rest,
    description: `Usuário "${target.fullName}" atualizado no painel Dev.`,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Usuário atualizado com sucesso.', user: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req)
  const guard = ensureDeveloper(currentUser)
  if (!guard.ok) return guard.response

  const { id } = await params

  if (currentUser!.id === id) {
    return NextResponse.json({ message: 'Não e permitido excluir o proprio usuário.' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true, login: true, role: { select: { code: true } } },
  })
  if (!target) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })

  try {
    await prisma.user.delete({ where: { id } })
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível excluir este usuário porque ele possui histórico vinculado. Desative-o em vez de excluir.' },
      { status: 409 }
    )
  }

  await auditLog({
    userId: currentUser!.id,
    module: 'users',
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: id,
    oldData: { fullName: target.fullName, email: target.email, login: target.login },
    description: `Usuário "${target.fullName}" excluido permanentemente no painel Dev.`,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Usuário excluido com sucesso.' })
}
