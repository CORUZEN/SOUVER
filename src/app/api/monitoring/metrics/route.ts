import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/monitoring/metrics — Métricas operacionais do sistema
 * Apenas usuários autenticados (admin) devem acessar.
 */

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const last7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeSessionsToday,
    auditLast7d,
    auditLast30d,
    batchesToday,
    movementsToday,
    ncOpen,
    integrationErrors,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.userSession.count({ where: { expiresAt: { gte: now }, revokedAt: null } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last7 } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last30 } } }),
    prisma.productionBatch.count({ where: { createdAt: { gte: today } } }),
    prisma.inventoryMovement.count({ where: { movedAt: { gte: today } } }),
    prisma.nonConformance.count({ where: { status: 'OPEN' } }),
    prisma.integrationLog.count({ where: { status: 'error', executedAt: { gte: last7 } } }),
  ])

  return NextResponse.json(
    {
      timestamp: now.toISOString(),
      users: {
        total: totalUsers,
        activeSessions: activeSessionsToday,
      },
      audit: {
        last7d: auditLast7d,
        last30d: auditLast30d,
        avgPerDay7d: Math.round(auditLast7d / 7),
      },
      operations: {
        batchesToday,
        movementsToday,
        ncOpen,
      },
      integrations: {
        errorsLast7d: integrationErrors,
      },
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}
