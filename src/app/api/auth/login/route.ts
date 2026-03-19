import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations/auth'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'
import {
  createNotification,
  createNotificationsForRole,
  NOTIFICATION_TYPES,
} from '@/domains/notifications/notifications.service'

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
      emitDomainEvent('auth:login.failed', { login, ip })
      return NextResponse.json(
        { message: 'Credenciais inválidas.' },
        { status: 401 }
      )
    }

    // ── Bloqueio progressivo ──────────────────────────────────
    const MAX_ATTEMPTS = 5
    const LOCK_DURATION_MS = 30 * 60 * 1000 // 30 min

    const recentFailures = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        action: 'LOGIN_FAILED',
        createdAt: { gte: new Date(Date.now() - LOCK_DURATION_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ATTEMPTS + 1,
    })

    if (recentFailures.length >= MAX_ATTEMPTS) {
      const lastFail = recentFailures[0]
      const unlockAt = new Date(lastFail.createdAt.getTime() + LOCK_DURATION_MS)
      if (unlockAt > new Date()) {
        await auditLog({
          userId: user.id,
          module: 'auth',
          action: 'LOGIN_BLOCKED',
          description: `Login bloqueado por excesso de tentativas. Desbloqueio às ${unlockAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
          ipAddress: ip,
          userAgent,
        })
        return NextResponse.json(
          {
            message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente às ${unlockAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
          },
          { status: 429 }
        )
      }
    }
    // ─────────────────────────────────────────────────────────

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
      emitDomainEvent('auth:login.failed', { login: user.login, ip })
      return NextResponse.json(
        { message: 'Credenciais inválidas.' },
        { status: 401 }
      )
    }

    // 2FA: se o usuário já tem 2FA habilitado, redireciona para verificação
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { requiresTwoFactor: true, userId: user.id },
        { status: 200 }
      )
    }

    const { token, expiresAt } = await createSession(user.id, ip, userAgent, user.role?.sessionDurationHours)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Perfil exige 2FA mas o usuário ainda não o configurou — cria sessão e redireciona para setup
    if (user.role?.requireTwoFactor) {
      await auditLog({
        userId: user.id,
        module: 'auth',
        action: 'LOGIN_SUCCESS',
        description: 'Login realizado. Redirecionado para configuração obrigatória de 2FA.',
        ipAddress: ip,
        userAgent,
      })

      const setupResponse = NextResponse.json(
        {
          message: 'Login realizado. Configure o 2FA antes de continuar.',
          requiresTwoFactorSetup: true,
        },
        { status: 200 }
      )
      setupResponse.cookies.set('souver_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      })
      return setupResponse
    }

    // Captura IP do último login ANTES de registrar o atual (para comparação)
    const previousLogin = await prisma.auditLog.findFirst({
      where:   { userId: user.id, action: 'LOGIN_SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select:  { ipAddress: true },
    })

    await auditLog({
      userId: user.id,
      module: 'auth',
      action: 'LOGIN_SUCCESS',
      description: 'Login realizado com sucesso.',
      ipAddress: ip,
      userAgent,
    })

    emitDomainEvent('auth:login.success', { userId: user.id, ip })

    // ── Alerta de acesso suspeito (IP diferente do último login) ──
    if (
      previousLogin?.ipAddress &&
      previousLogin.ipAddress !== 'unknown' &&
      ip !== 'unknown' &&
      previousLogin.ipAddress !== ip
    ) {
      const userName = user.fullName

      // Notificação pessoal para o próprio usuário
      createNotification(user.id, {
        type:    NOTIFICATION_TYPES.LOGIN_SUSPICIOUS,
        title:   'Acesso de novo endereço IP detectado',
        message: `Seu acesso foi realizado de um IP diferente do usual. IP anterior: ${previousLogin.ipAddress} | IP atual: ${ip}. Se não foi você, contate o administrador.`,
        module:  'auth',
        link:    '/configuracoes/perfil',
      }).catch(() => null)

      // Alerta para administradores
      createNotificationsForRole('ADMIN', {
        type:    NOTIFICATION_TYPES.LOGIN_SUSPICIOUS,
        title:   `Acesso suspeito — ${userName}`,
        message: `O usuário ${userName} (${user.login}) acessou o sistema de um IP diferente. Anterior: ${previousLogin.ipAddress} | Atual: ${ip}.`,
        module:  'auth',
        link:    '/auditoria',
      }).catch(() => null)
    }
    // ─────────────────────────────────────────────────────────────

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
