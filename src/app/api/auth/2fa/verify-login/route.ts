import { NextRequest, NextResponse } from 'next/server'
import { OTP } from 'otplib'
import { prisma } from '@/lib/prisma'
import { verifyTwoFactorChallenge } from '@/lib/auth/two-factor-challenge'
import { createSession } from '@/lib/auth/session'
import { verifyPassword } from '@/lib/auth/password'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'

const totp = new OTP()

function parseSubmittedToken(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase()
}

function isTotpToken(value: string) {
  return /^\d{6}$/.test(value)
}

function isRecoveryCode(value: string) {
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(value)
}

export async function POST(req: NextRequest) {
  const challengeToken = req.cookies.get('souver_2fa_challenge')?.value
  if (!challengeToken) {
    return NextResponse.json(
      { message: 'Sessão de verificação 2FA expirada. Faça login novamente.' },
      { status: 401 }
    )
  }

  const challenge = await verifyTwoFactorChallenge(challengeToken)
  if (!challenge) {
    const expired = NextResponse.json(
      { message: 'Verificação 2FA inválida ou expirada. Faça login novamente.' },
      { status: 401 }
    )
    expired.cookies.delete('souver_2fa_challenge')
    return expired
  }

  const body = await req.json().catch(() => ({}))
  const token = parseSubmittedToken((body as { token?: string }).token)
  if (!token) {
    return NextResponse.json(
      { message: 'Informe o código de autenticação.' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    include: { role: true, department: true },
  })

  if (!user || !user.isActive) {
    return NextResponse.json({ message: 'Usuário inválido.' }, { status: 401 })
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json(
      { message: '2FA não está ativo para este usuário. Faça login novamente.' },
      { status: 400 }
    )
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  let isValid = false
  let usedRecoveryCodeId: string | null = null

  if (isTotpToken(token)) {
    const result = await totp.verify({
      token,
      secret: user.twoFactorSecret,
      epochTolerance: 30,
    })
    isValid = result.valid
  } else if (isRecoveryCode(token)) {
    const recoveryCodes = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: user.id, usedAt: null },
      select: { id: true, codeHash: true },
    })

    for (const code of recoveryCodes) {
      const match = await verifyPassword(token, code.codeHash)
      if (match) {
        isValid = true
        usedRecoveryCodeId = code.id
        break
      }
    }
  } else {
    return NextResponse.json(
      { message: 'Código inválido. Use 6 dígitos ou um código de recuperação.' },
      { status: 400 }
    )
  }

  if (!isValid) {
    await auditLog({
      userId: user.id,
      module: 'auth',
      action: 'LOGIN_FAILED',
      description: 'Falha na validação do segundo fator no login.',
      ipAddress: ip,
      userAgent,
    })
    return NextResponse.json({ message: 'Código de verificação inválido.' }, { status: 401 })
  }

  const { token: sessionToken, expiresAt } = await createSession(user.id, ip, userAgent, user.role?.sessionDurationHours)

  if (usedRecoveryCodeId) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.twoFactorRecoveryCode.update({
        where: { id: usedRecoveryCodeId },
        data: { usedAt: new Date() },
      }),
    ])
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
  }

  await auditLog({
    userId: user.id,
    module: 'auth',
    action: 'LOGIN_SUCCESS',
    description: usedRecoveryCodeId
      ? 'Login concluído com 2FA via código de recuperação.'
      : 'Login concluído com 2FA via aplicativo autenticador.',
    ipAddress: ip,
    userAgent,
  })

  emitDomainEvent('auth:login.success', { userId: user.id, ip })

  const response = NextResponse.json({
    message: 'Autenticado com sucesso.',
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      login: user.login,
      role: user.role?.code,
      department: user.department?.name,
    },
  })

  response.cookies.set('souver_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
  response.cookies.delete('souver_2fa_challenge')

  return response
}
