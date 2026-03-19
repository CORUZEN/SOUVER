import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, hasPermission } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'

/**
 * POST /api/admin/cleanup
 *
 * Executa rotinas de limpeza e manutenção do banco de dados.
 * Requer permissão `admin:cleanup` (fallback: somente ADMIN / GERENTE).
 *
 * Body (JSON, todos os campos opcionais):
 *   retentionDays   number  — dias de retenção para logs de auditoria (padrão: 90)
 *   notifDays       number  — dias de retenção para notificações lidas (padrão: 30)
 *   dryRun          boolean — se true, apenas conta sem deletar (padrão: false)
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const isAdmin = await hasPermission(auth.roleId, 'admin:cleanup')
    .catch(() => false)

  // Fallback: verificar permissão via roleCode
  if (!isAdmin) {
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { role: { select: { code: true } } },
    })
    const code = user?.role?.code?.toUpperCase() ?? ''
    if (!['ADMIN', 'GERENTE', 'MANAGER'].includes(code)) {
      return NextResponse.json({ error: 'Sem permissão para executar limpeza' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const retentionDays: number = Number(body.retentionDays ?? 90)
  const notifDays:     number = Number(body.notifDays     ?? 30)
  const dryRun:        boolean = Boolean(body.dryRun ?? false)

  if (retentionDays < 30) {
    return NextResponse.json({ error: 'retentionDays mínimo é 30 dias.' }, { status: 422 })
  }
  if (notifDays < 7) {
    return NextResponse.json({ error: 'notifDays mínimo é 7 dias.' }, { status: 422 })
  }

  const now      = new Date()
  const auditCut = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const notifCut = new Date(now.getTime() - notifDays    * 24 * 60 * 60 * 1000)

  // ── Contagens ──────────────────────────────────────────────────
  const [
    auditCount,
    notifCount,
    sessionCount,
    resetTokenCount,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: { lt: auditCut } },
    }),
    prisma.notification.count({
      where: { isRead: true, createdAt: { lt: notifCut } },
    }),
    prisma.userSession.count({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { status: { in: ['EXPIRED', 'REVOKED'] } },
        ],
      },
    }),
    prisma.passwordResetToken.count({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    }),
  ])

  const summary = {
    dryRun,
    auditLogsToDelete:    auditCount,
    notificationsToDelete: notifCount,
    sessionsToDelete:     sessionCount,
    resetTokensToDelete:  resetTokenCount,
    retentionDays,
    notifDays,
  }

  if (dryRun) {
    return NextResponse.json({ ...summary, message: 'Simulação concluída — nenhum dado foi removido.' })
  }

  // ── Execução ───────────────────────────────────────────────────
  const [deletedAudit, deletedNotif, deletedSessions, deletedTokens] = await Promise.all([
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCut } },
    }),
    prisma.notification.deleteMany({
      where: { isRead: true, createdAt: { lt: notifCut } },
    }),
    prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { status: { in: ['EXPIRED', 'REVOKED'] } },
        ],
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    }),
  ])

  await auditLog({
    userId: auth.id,
    module: 'admin',
    action: 'CLEANUP',
    description: `Limpeza executada: ${deletedAudit.count} logs de auditoria, ${deletedNotif.count} notificações, ${deletedSessions.count} sessões, ${deletedTokens.count} tokens de reset.`,
    ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: req.headers.get('user-agent') ?? 'unknown',
  })

  return NextResponse.json({
    ...summary,
    deleted: {
      auditLogs:    deletedAudit.count,
      notifications: deletedNotif.count,
      sessions:     deletedSessions.count,
      resetTokens:  deletedTokens.count,
    },
    message: 'Limpeza concluída com sucesso.',
    executedAt: now.toISOString(),
  })
}

/**
 * GET /api/admin/cleanup — retorna contagem prévia sem deletar (equivale a dryRun=true)
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    include: { role: { select: { code: true } } },
  })
  const code = user?.role?.code?.toUpperCase() ?? ''
  if (!['ADMIN', 'GERENTE', 'MANAGER'].includes(code)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const retentionDays = Number(searchParams.get('retentionDays') ?? 90)
  const notifDays     = Number(searchParams.get('notifDays')     ?? 30)
  const now           = new Date()
  const auditCut      = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const notifCut      = new Date(now.getTime() - notifDays     * 24 * 60 * 60 * 1000)

  const [auditCount, notifCount, sessionCount, resetTokenCount] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { lt: auditCut } } }),
    prisma.notification.count({ where: { isRead: true, createdAt: { lt: notifCut } } }),
    prisma.userSession.count({
      where: { OR: [{ expiresAt: { lt: now } }, { status: { in: ['EXPIRED', 'REVOKED'] } }] },
    }),
    prisma.passwordResetToken.count({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    }),
  ])

  return NextResponse.json({
    dryRun: true,
    retentionDays,
    notifDays,
    auditLogsToDelete:    auditCount,
    notificationsToDelete: notifCount,
    sessionsToDelete:     sessionCount,
    resetTokensToDelete:  resetTokenCount,
    message: 'Pré-visualização — nenhum dado removido.',
  })
}
