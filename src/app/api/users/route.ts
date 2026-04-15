import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(120),
  email: z.string().email('E-mail inválido'),
  login: z
    .string()
    .min(3, 'Login deve ter no mínimo 3 caracteres')
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Login deve conter apenas letras, numeros, . - _'),
  phone: z.string().optional().nullable(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  departmentId: z.string().optional().nullable(),
  roleId: z.string().optional().nullable(),
  sellerCode: z.string().max(20).optional().nullable(),
})

function ensureDeveloper(user: Awaited<ReturnType<typeof getAuthUser>>) {
  if (!user) return { ok: false as const, response: NextResponse.json({ message: 'Não autenticado' }, { status: 401 }) }
  if (user.role?.code !== 'DEVELOPER') {
    return { ok: false as const, response: NextResponse.json({ message: 'Área Dev exclusiva para desenvolvedor.' }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  const guard = ensureDeveloper(currentUser)
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const roleId = searchParams.get('roleId') || undefined
  const departmentId = searchParams.get('departmentId') || undefined
  const statusFilter = searchParams.get('status') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

  const where = {
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { login: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(roleId ? { roleId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(statusFilter === 'active' ? { isActive: true } : statusFilter === 'inactive' ? { isActive: false } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
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
        sellerCode: true,
        role: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

export async function POST(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  const guard = ensureDeveloper(currentUser)
  if (!guard.ok) return guard.response

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Dados inválidos.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { fullName, email, login, phone, password, departmentId, roleId, sellerCode } = parsed.data

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { login }] },
    select: { email: true, login: true },
  })
  if (existing) {
    const field = existing.email === email ? 'e-mail' : 'login'
    return NextResponse.json({ message: `Este ${field} já esta em uso.` }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)

  const created = await prisma.user.create({
    data: {
      fullName,
      email,
      login,
      phone: phone ?? null,
      passwordHash,
      departmentId: departmentId ?? null,
      roleId: roleId ?? null,
      sellerCode: sellerCode ?? null,
      passwordChangedAt: new Date(),
    },
    select: { id: true, fullName: true, email: true, login: true },
  })

  await auditLog({
    userId: currentUser!.id,
    module: 'users',
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: created.id,
    newData: { fullName, email, login, departmentId, roleId },
    description: `Usuário "${fullName}" criado no painel Dev.`,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Usuário criado com sucesso.', user: created }, { status: 201 })
}
