import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, hasPermission } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  if (!currentUser) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const canRead = await hasPermission(currentUser.roleId, 'audit:read')
  if (!canRead) return NextResponse.json({ message: 'Sem permissão' }, { status: 403 })

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const since7  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000)

  const [
    activityByModule,
    criticalEvents,
    topUsers,
    loginStats,
    twoFaStats,
    dailyActivity,
  ] = await Promise.all([
    // Atividade por módulo nos últimos 30 dias
    prisma.auditLog.groupBy({
      by:     ['module'],
      where:  { createdAt: { gte: since30 } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Eventos críticos nos últimos 30 dias
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since30 },
        action: {
          in: ['LOGIN_FAILED', 'LOGIN_BLOCKED', '2FA_DISABLED', 'USER_CREATED',
               'USER_DELETED', 'PERMISSION_CHANGED', 'SYSTEM_CLEANUP'],
        },
      },
      select: {
        id: true, action: true, module: true, description: true,
        ipAddress: true, createdAt: true,
        user: { select: { fullName: true, login: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    // Top 10 usuários mais ativos (30 dias)
    prisma.auditLog.groupBy({
      by:     ['userId'],
      where:  { createdAt: { gte: since30 }, userId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),

    // Logins nos últimos 7 dias (sucesso vs falha)
    prisma.auditLog.groupBy({
      by:     ['action'],
      where:  {
        createdAt: { gte: since7 },
        action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED'] },
      },
      _count: { id: true },
    }),

    // Usuários com e sem 2FA
    prisma.user.groupBy({
      by:     ['twoFactorEnabled'],
      where:  { isActive: true },
      _count: { id: true },
    }),

    // Atividade diária (últimos 7 dias)
    prisma.auditLog.groupBy({
      by:     ['action'],
      where:  { createdAt: { gte: since7 } },
      _count: { id: true },
    }),
  ])

  // Resolve nomes dos top users
  const userIds = topUsers.map((u) => u.userId).filter(Boolean) as string[]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, login: true },
  })
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const topUsersResolved = topUsers.map((u) => ({
    userId:   u.userId,
    fullName: userMap[u.userId!]?.fullName ?? '—',
    login:    userMap[u.userId!]?.login ?? '—',
    count:    u._count.id,
  }))

  const loginSuccess = loginStats.find((s) => s.action === 'LOGIN_SUCCESS')?._count.id ?? 0
  const loginFailed  = loginStats.find((s) => s.action === 'LOGIN_FAILED')?._count.id ?? 0
  const loginBlocked = loginStats.find((s) => s.action === 'LOGIN_BLOCKED')?._count.id ?? 0

  const with2fa    = (twoFaStats.find((s) => s.twoFactorEnabled === true)?._count as { id: number } | undefined)?.id ?? 0
  const without2fa = (twoFaStats.find((s) => s.twoFactorEnabled === false)?._count as { id: number } | undefined)?.id ?? 0

  const totalActions30d = activityByModule.reduce((acc, m) => acc + m._count.id, 0)

  return NextResponse.json({
    period: { days30: since30.toISOString(), days7: since7.toISOString() },
    activityByModule: activityByModule.map((m) => ({ module: m.module, count: m._count.id })),
    criticalEvents,
    topUsers: topUsersResolved,
    loginStats: { success: loginSuccess, failed: loginFailed, blocked: loginBlocked },
    twoFaStats: { with: with2fa, without: without2fa },
    totalActions30d,
    summary: {
      totalEvents:    totalActions30d,
      criticalCount:  criticalEvents.length,
      loginFailRate:  loginFailed + loginBlocked > 0
        ? Math.round(((loginFailed + loginBlocked) / (loginSuccess + loginFailed + loginBlocked)) * 100)
        : 0,
      twoFaAdoption: with2fa + without2fa > 0
        ? Math.round((with2fa / (with2fa + without2fa)) * 100)
        : 0,
    },
  }, { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=60' } })
}
