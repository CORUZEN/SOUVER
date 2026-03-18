import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET /api/users/me — retorna dados do perfil atual (inclui phone, avatarUrl)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  return NextResponse.json({
    user: {
      id:               user.id,
      fullName:         user.fullName,
      email:            user.email,
      login:            user.login,
      phone:            user.phone,
      avatarUrl:        user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      role:             user.role?.name ?? null,
      department:       user.department?.name ?? null,
    },
  })
}

// PATCH /api/users/me — atualiza perfil
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { fullName, phone, avatarUrl, currentPassword, newPassword } = body

  // Validação de comprimento para evitar payloads anômalos
  if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120)) {
    return NextResponse.json({ error: 'Nome inválido (2–120 caracteres)' }, { status: 400 })
  }
  if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 30)) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }
  if (avatarUrl !== undefined && avatarUrl !== null && (typeof avatarUrl !== 'string' || avatarUrl.length > 500)) {
    return NextResponse.json({ error: 'URL de avatar inválida' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (fullName !== undefined)  updates.fullName  = fullName.trim()
  if (phone !== undefined)     updates.phone     = phone?.trim() || null
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl?.trim() || null

  // Troca de senha
  if (newPassword !== undefined) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Senha atual é obrigatória para alterar a senha' }, { status: 400 })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Nova senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
    if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const match = await bcrypt.compare(currentPassword, dbUser.passwordHash)
    if (!match) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

    updates.passwordHash      = await bcrypt.hash(newPassword, 12)
    updates.passwordChangedAt = new Date()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data:  updates,
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, twoFactorEnabled: true },
  })

  // Auditoria
  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      module:     'users',
      action:     'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId:   user.id,
      newData:    { fullName: updated.fullName, phone: updated.phone },
    },
  })

  return NextResponse.json({ user: updated })
}
