import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type UserSummary = {
  id: string
  fullName: string
  login: string
}

/**
 * GET /api/analytics — Analytics avançado por módulo e usuário
 *
 * Query params:
 *   ?period=7|30|90 (dias, default 30)
 *   ?userId=xxx (filtrar por usuário)
 */

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const period = Math.min(Number(searchParams.get('period') ?? 30), 365)
  const filterUserId = searchParams.get('userId') ?? undefined

  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000)
  const userFilter = filterUserId ? { userId: filterUserId } : {}

  // ── Ações por módulo ────────────────────────────────────────
  const actionsByModule = await prisma.auditLog.groupBy({
    by: ['module'],
    where: { createdAt: { gte: since }, ...userFilter },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  // ── Ações por tipo de ação ──────────────────────────────────
  const actionsByType = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { createdAt: { gte: since }, ...userFilter },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  })

  // ── Top 10 usuários mais ativos ─────────────────────────────
  const topUsers = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since }, userId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const userIds = topUsers
    .map((u: { userId: string | null }) => u.userId)
    .filter((id: string | null): id is string => Boolean(id))
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, login: true },
  })
  const userMap = new Map<string, UserSummary>(
    users.map((u: UserSummary): [string, UserSummary] => [u.id, u])
  )

  const topUsersWithNames = topUsers.map((u: { userId: string | null; _count: { id: number } }) => ({
    userId: u.userId,
    name: userMap.get(u.userId!)?.fullName ?? 'Desconhecido',
    login: userMap.get(u.userId!)?.login ?? '-',
    actions: u._count.id,
  }))

  // ── Atividade por dia (timeline) ────────────────────────────
  const userClause = filterUserId
    ? Prisma.sql`AND "user_id" = ${filterUserId}`
    : Prisma.empty

  const dailyActivity = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE("created_at") as day, COUNT(*)::bigint as count
    FROM "audit_logs"
    WHERE "created_at" >= ${since}
    ${userClause}
    GROUP BY DATE("created_at")
    ORDER BY day ASC
  `.catch(() => [])

  // ── Produção: lotes por status (período) ────────────────────
  const batchesByStatus = await prisma.productionBatch.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  })

  // ── Qualidade: NCs por severidade (período) ─────────────────
  const ncBySeverity = await prisma.nonConformance.groupBy({
    by: ['severity'],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  })

  // ── Logística: movimentações por tipo (período) ─────────────
  const movementsByType = await prisma.inventoryMovement.groupBy({
    by: ['type'],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  })

  return NextResponse.json(
    {
      period,
      since: since.toISOString(),
      modules: actionsByModule.map((m: { module: string; _count: { id: number } }) => ({ module: m.module, count: m._count.id })),
      actions: actionsByType.map((a: { action: string; _count: { id: number } }) => ({ action: a.action, count: a._count.id })),
      topUsers: topUsersWithNames,
      dailyActivity: dailyActivity.map((d: { day: Date; count: bigint }) => ({
        day: d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day),
        count: Number(d.count),
      })),
      production: {
        byStatus: batchesByStatus.map((b: { status: string; _count: { id: number } }) => ({ status: b.status, count: b._count.id })),
      },
      quality: {
        bySeverity: ncBySeverity.map((n: { severity: string; _count: { id: number } }) => ({ severity: n.severity, count: n._count.id })),
      },
      logistics: {
        byType: movementsByType.map((m: { type: string; _count: { id: number } }) => ({ type: m.type, count: m._count.id })),
      },
    },
    { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=60' } }
  )
}
