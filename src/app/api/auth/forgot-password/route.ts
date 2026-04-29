import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

// POST /api/auth/forgot-password
// Body: { login: string }   (aceita login OU email)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const identifier = body?.login?.trim() ?? body?.email?.trim()

  if (!identifier) {
    return NextResponse.json({ error: 'Informe o login ou e-mail.' }, { status: 400 })
  }

  // Busca o usuário — não revela se existe ou não (anti-enumeration)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { login: identifier },
        { email: identifier },
      ],
      status: 'ACTIVE',
    },
    select: { id: true, email: true, fullName: true },
  })

  // Sempre retorna 200 para não revelar se o usuário existe
  if (!user) {
    return NextResponse.json({
      message: 'Se o cadastro existir, um link de recuperação foi gerado.',
    })
  }

  // Invalida tokens anteriores não usados para este usuário
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data:  { usedAt: new Date() },
  })

  // Gera token aleatório seguro
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hora

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  // Em produção real: enviar e-mail. Aqui retornamos o token na resposta (dev only).
  // PRODUCTION_NOTE: integre um serviço de e-mail (Resend, SendGrid, etc.) aqui.
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001'}/resetar-senha?token=${rawToken}`

  const isDev = process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'development'

  return NextResponse.json({
    message: 'Se o cadastro existir, um link de recuperação foi gerado.',
    ...(isDev ? { _dev: { resetUrl, token: rawToken } } : {}),
  })
}
