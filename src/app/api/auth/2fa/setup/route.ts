import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { OTP } from 'otplib'
import QRCode from 'qrcode'
import { auditLog } from '@/domains/audit/audit.service'

const totp = new OTP()

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  if (user.twoFactorEnabled) {
    return NextResponse.json({ message: '2FA já está habilitado.' }, { status: 400 })
  }

  // Usa segredo existente (pendente de verificação) ou gera novo
  const secret = user.twoFactorSecret ?? totp.generateSecret()

  if (!user.twoFactorSecret) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } })
  }

  const otpauthUrl = totp.generateURI({ label: user.email, issuer: 'SOUVER — Ouro Verde', secret })
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

  return NextResponse.json({ secret, qrDataUrl, otpauthUrl })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  if (user.twoFactorEnabled) {
    return NextResponse.json({ message: '2FA já está habilitado.' }, { status: 400 })
  }

  if (!user.twoFactorSecret) {
    return NextResponse.json({ message: 'Configure o 2FA antes de verificar.' }, { status: 400 })
  }

  const body = await req.json()
  const { totp: totpCode } = body as { totp?: string }

  if (!totpCode || typeof totpCode !== 'string') {
    return NextResponse.json({ message: 'Código TOTP é obrigatório.' }, { status: 400 })
  }

  const result = await totp.verify({ token: totpCode.replace(/\s/g, ''), secret: user.twoFactorSecret, epochTolerance: 30 })
  if (!result.valid) {
    return NextResponse.json({ message: 'Código inválido. Tente novamente.' }, { status: 400 })
  }

  // Gera 8 códigos de backup únicos
  const backupCodes: string[] = Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 7).toUpperCase() +
    '-' +
    Math.random().toString(36).substring(2, 7).toUpperCase()
  )

  const { hashPassword } = await import('@/lib/auth/password')
  const hashedCodes = await Promise.all(backupCodes.map((c) => hashPassword(c)))

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ])

  await auditLog({
    userId: user.id,
    module: 'auth',
    action: '2FA_ENABLED',
    description: 'Autenticação de dois fatores habilitada.',
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({
    message: '2FA habilitado com sucesso!',
    backupCodes,
  })
}
