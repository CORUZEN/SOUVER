import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { authResetLimiter, getClientIp, checkRateLimit } from '@/lib/server/rate-limit'

// POST /api/auth/reset-password
// Body: { token: string, newPassword: string }
export async function POST(req: NextRequest) {
  // Rate limiting por IP
  const ip = getClientIp(req)
  const limitResult = await checkRateLimit(authResetLimiter, ip)
  if (!limitResult.ok) {
    return NextResponse.json(
      { error: `Muitas tentativas. Aguarde ${limitResult.retryAfterSeconds} segundos.` },
      { status: 429, headers: { 'Retry-After': String(limitResult.retryAfterSeconds) } }
    )
  }

  const body = await req.json().catch(() => null)
  const { token, newPassword } = body ?? {}

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token e nova senha são obrigatórios.' }, { status: 400 })
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  // Busca tokens não usados e não expirados
  const now = new Date()
  const candidates = await prisma.passwordResetToken.findMany({
    where: {
      usedAt:    null,
      expiresAt: { gt: now },
    },
    include: { user: { select: { id: true, status: true } } },
  })

  // Verifica qual token corresponde (bcrypt.compare)
  let matched: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    const ok = await bcrypt.compare(token, candidate.tokenHash)
    if (ok) { matched = candidate; break }
  }

  if (!matched) {
    return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 })
  }

  if (matched.user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Usuário inativo.' }, { status: 403 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    // Marca token como usado
    prisma.passwordResetToken.update({
      where: { id: matched.id },
      data:  { usedAt: now },
    }),
    // Atualiza senha do usuário
    prisma.user.update({
      where: { id: matched.userId },
      data:  {
        passwordHash:      newHash,
        passwordChangedAt: now,
      },
    }),
    // Revoga todas as sessões ativas
    prisma.userSession.updateMany({
      where:  { userId: matched.userId, status: 'ACTIVE' },
      data:   { status: 'REVOKED', revokedAt: now },
    }),
  ])

  return NextResponse.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' })
}
