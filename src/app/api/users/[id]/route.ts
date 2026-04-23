import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'

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
  sellerCode: z.string().max(20).nullable().optional(),
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
      sellerCode: true,
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

  let normalizedSellerCode = typeof rest.sellerCode === 'string' ? rest.sellerCode.trim() : rest.sellerCode
  if (typeof normalizedSellerCode === 'string' && normalizedSellerCode) {
    const n = Number(normalizedSellerCode)
    if (Number.isFinite(n)) normalizedSellerCode = String(n)
  }

  const targetRoleId = rest.roleId ?? (await prisma.user.findUnique({ where: { id }, select: { roleId: true } }))?.roleId ?? null
  if (targetRoleId) {
    const role = await prisma.role.findUnique({
      where: { id: targetRoleId },
      select: { code: true },
    })
    const roleCode = String(role?.code ?? '').toUpperCase()
    if (roleCode === 'SALES_SUPERVISOR' || roleCode === 'SELLER') {
      const effectiveSellerCode = typeof normalizedSellerCode === 'string'
        ? normalizedSellerCode
        : (await prisma.user.findUnique({ where: { id }, select: { sellerCode: true } }))?.sellerCode ?? ''
      if (!effectiveSellerCode) {
        return NextResponse.json(
          { message: roleCode === 'SELLER' ? 'Vendedor vinculado é obrigatório para cargo Vendedor.' : 'Supervisor vinculado é obrigatório para cargo Supervisor de Vendas.' },
          { status: 400 },
        )
      }
      const allowlist = await readSellerAllowlist().catch(() => [])
      const activeCodes = new Set(
        getActiveAllowedSellersFromList(allowlist)
          .map((seller) => String(seller.code ?? '').trim())
          .filter((code) => code.length > 0),
      )
      if (!activeCodes.has(String(effectiveSellerCode).trim())) {
        return NextResponse.json(
          { message: 'Código de vendedor não encontrado na lista de vendedores liberados.' },
          { status: 400 },
        )
      }
    }
  }

  if (rest.email && rest.email !== target.email) {
    const conflict = await prisma.user.findFirst({ where: { email: rest.email, NOT: { id } } })
    if (conflict) return NextResponse.json({ message: 'Este e-mail já esta em uso.' }, { status: 409 })
  }
  if (rest.login && rest.login !== target.login) {
    const conflict = await prisma.user.findFirst({ where: { login: rest.login, NOT: { id } } })
    if (conflict) return NextResponse.json({ message: 'Este login já esta em uso.' }, { status: 409 })
  }

  const updateData: Record<string, unknown> = { ...rest }
  if (rest.sellerCode !== undefined) updateData.sellerCode = normalizedSellerCode || null
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
