import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const [integrations, recentLogs, logStats] = await Promise.all([
    // Resumo das integrações
    prisma.integration.findMany({
      select: {
        id: true, name: true, provider: true, status: true,
        lastSyncAt: true, lastSyncStatus: true,
        _count: { select: { logs: true } },
      },
      orderBy: { name: 'asc' },
    }),
    // Últimos 10 logs de todas as integrações
    prisma.integrationLog.findMany({
      select: {
        id: true, eventType: true, status: true, message: true,
        durationMs: true, recordsAffected: true, executedAt: true,
        integration: { select: { name: true, provider: true } },
      },
      orderBy: { executedAt: 'desc' },
      take: 10,
    }),
    // Estatísticas dos últimos 30 dias
    prisma.integrationLog.groupBy({
      by: ['status'],
      where: { executedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { id: true },
    }),
  ])

  const totalActive = integrations.filter((i) => i.status === 'ACTIVE').length
  const totalError  = integrations.filter((i) => i.status === 'ERROR').length
  const successLogs = logStats.find((s) => s.status === 'success')?._count.id ?? 0
  const errorLogs   = logStats.find((s) => s.status === 'error')?._count.id ?? 0
  const totalLogs   = logStats.reduce((a, s) => a + s._count.id, 0)

  return NextResponse.json({
    integrations,
    recentLogs,
    summary: {
      total:       integrations.length,
      active:      totalActive,
      error:       totalError,
      inactive:    integrations.length - totalActive - totalError,
      successRate: totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100,
      totalLogs30d: totalLogs,
      errorLogs30d: errorLogs,
    },
  }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=30' } })
}
