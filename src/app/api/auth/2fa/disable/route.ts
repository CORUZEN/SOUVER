import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { OTP } from 'otplib'
import { auditLog } from '@/domains/audit/audit.service'

const totp = new OTP()

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  if (!user.twoFactorEnabled) {
    return NextResponse.json({ message: '2FA não está habilitado.' }, { status: 400 })
  }

  const body = await req.json()
  const { totp: totpCode } = body as { totp?: string }

  if (!totpCode || !user.twoFactorSecret) {
    return NextResponse.json({ message: 'Código TOTP é obrigatório.' }, { status: 400 })
  }

  const result = await totp.verify({ token: totpCode.replace(/\s/g, ''), secret: user.twoFactorSecret, epochTolerance: 30 })
  if (!result.valid) {
    return NextResponse.json({ message: 'Código inválido. Tente novamente.' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ])

  await auditLog({
    userId: user.id,
    module: 'auth',
    action: '2FA_DISABLED',
    description: 'Autenticação de dois fatores desabilitada.',
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: '2FA desabilitado com sucesso.' })
}
