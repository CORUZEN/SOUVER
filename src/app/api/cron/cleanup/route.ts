import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'

// Políticas de retenção padrão (dias)
const RETENTION = {
  auditLogs:    90,   // logs de auditoria: 90 dias
  notifications: 30,  // notificações lidas: 30 dias
  integrationLogs: 60, // logs de integração: 60 dias
}

/**
 * GET /api/cron/cleanup
 * Executa limpeza automática semanal — chamado via Vercel Cron
 */
export async function GET(req: NextRequest) {
  // Verifica autenticação do cron — secret obrigatório (fail-closed)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const now = new Date()
  const auditCut      = new Date(now.getTime() - RETENTION.auditLogs      * 24 * 60 * 60 * 1000)
  const notifCut      = new Date(now.getTime() - RETENTION.notifications  * 24 * 60 * 60 * 1000)
  const intLogCut     = new Date(now.getTime() - RETENTION.integrationLogs * 24 * 60 * 60 * 1000)

  const [deletedAudit, deletedNotif, deletedSessions, deletedTokens, deletedIntLogs] = await Promise.all([
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
    prisma.integrationLog.deleteMany({
      where: { executedAt: { lt: intLogCut } },
    }),
  ])

  const summary = {
    auditLogs:       deletedAudit.count,
    notifications:   deletedNotif.count,
    sessions:        deletedSessions.count,
    resetTokens:     deletedTokens.count,
    integrationLogs: deletedIntLogs.count,
  }

  const totalDeleted = Object.values(summary).reduce((a, b) => a + b, 0)

  if (totalDeleted > 0) {
    await auditLog({
      module:      'system',
      action:      'SCHEDULED_CLEANUP',
      description: `Limpeza automática semanal: ${deletedAudit.count} audit logs (>${RETENTION.auditLogs}d), ${deletedNotif.count} notificações (>${RETENTION.notifications}d), ${deletedSessions.count} sessões expiradas, ${deletedTokens.count} tokens, ${deletedIntLogs.count} integration logs (>${RETENTION.integrationLogs}d)`,
    })
  }

  return NextResponse.json({
    ok: true,
    retention: RETENTION,
    deleted: summary,
    totalDeleted,
    executedAt: now.toISOString(),
  })
}
