import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations/auth'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Dados inválidos.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { login, password } = parsed.data
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? 'unknown'

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ login }, { email: login }],
        isActive: true,
      },
      include: { role: true, department: true },
    })

    if (!user) {
      await auditLog({
        module: 'auth',
        action: 'LOGIN_FAILED',
        description: `Tentativa de login com credencial inexistente: ${login}`,
        ipAddress: ip,
        userAgent,
      })
      return NextResponse.json(
        { message: 'Credenciais inválidas.' },
        { status: 401 }
      )
    }

    const passwordValid = await verifyPassword(password, user.passwordHash)
    if (!passwordValid) {
      await auditLog({
        userId: user.id,
        module: 'auth',
        action: 'LOGIN_FAILED',
        description: 'Senha incorreta.',
        ipAddress: ip,
        userAgent,
      })
      return NextResponse.json(
        { message: 'Credenciais inválidas.' },
        { status: 401 }
      )
    }

    // 2FA obrigatório se habilitado
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { requiresTwoFactor: true, userId: user.id },
        { status: 200 }
      )
    }

    const { token, expiresAt } = await createSession(user.id, ip, userAgent)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await auditLog({
      userId: user.id,
      module: 'auth',
      action: 'LOGIN_SUCCESS',
      description: 'Login realizado com sucesso.',
      ipAddress: ip,
      userAgent,
    })

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

    response.cookies.set('souver_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[AUTH/LOGIN]', error)
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
