import { prisma } from '@/lib/prisma'

// ─── Tipos de domínio ────────────────────────────────────────────
export type CollaboratorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface CollaboratorFilter {
  search?:       string
  departmentId?: string
  roleId?:       string
  status?:       CollaboratorStatus
  page?:         number
  pageSize?:     number
}

// ─── Listagem de colaboradores ───────────────────────────────────

export async function listCollaborators(filter: CollaboratorFilter) {
  const { page = 1, pageSize = 20, search, departmentId, roleId, status } = filter
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
      { login:    { contains: search, mode: 'insensitive' } },
    ]
  }
  if (departmentId) where.departmentId = departmentId
  if (roleId)       where.roleId       = roleId
  if (status)       where.status       = status

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { fullName: 'asc' },
      select: {
        id:              true,
        fullName:        true,
        email:           true,
        login:           true,
        phone:           true,
        avatarUrl:       true,
        status:          true,
        isActive:        true,
        lastLoginAt:     true,
        createdAt:       true,
        twoFactorEnabled: true,
        department: { select: { id: true, name: true, code: true } },
        role:       { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            sessions:      true,
            auditLogs:     true,
            createdBatches: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getCollaboratorById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id:              true,
      fullName:        true,
      email:           true,
      login:           true,
      phone:           true,
      avatarUrl:       true,
      status:          true,
      isActive:        true,
      lastLoginAt:     true,
      createdAt:       true,
      updatedAt:       true,
      twoFactorEnabled: true,
      department: { select: { id: true, name: true, code: true } },
      role:       { select: { id: true, name: true, code: true } },
      sessions: {
        orderBy:  { startedAt: 'desc' },
        take:     5,
        select:   { id: true, ipAddress: true, deviceName: true, startedAt: true, status: true },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take:    10,
        select:  { id: true, module: true, action: true, description: true, createdAt: true },
      },
      _count: {
        select: {
          sessions:       true,
          auditLogs:      true,
          createdBatches: true,
          createdItems:   true,
          createdMovements: true,
        },
      },
    },
  })
}

// ─── KPIs de RH ─────────────────────────────────────────────────

export async function getHRKPIs(dateRange?: { from: Date; to: Date }) {
  const loggedFilter = dateRange
    ? { gte: dateRange.from, lte: dateRange.to }
    : { gte: new Date(new Date().setHours(0, 0, 0, 0)) }

  const [
    totalActive,
    totalInactive,
    totalSuspended,
    with2FA,
    loggedToday,
    byDepartment,
    byRole,
  ] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE'    } }),
    prisma.user.count({ where: { status: 'INACTIVE'  } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.user.count({
      where: { lastLoginAt: loggedFilter },
    }),
    prisma.user.groupBy({
      by:    ['departmentId'],
      _count: { id: true },
      where: { status: 'ACTIVE', departmentId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take:  10,
    }),
    prisma.user.groupBy({
      by:    ['roleId'],
      _count: { id: true },
      where: { status: 'ACTIVE', roleId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take:  10,
    }),
  ])

  return {
    totalActive,
    totalInactive,
    totalSuspended,
    total: totalActive + totalInactive + totalSuspended,
    with2FA,
    loggedToday,
    byDepartment,
    byRole,
  }
}

// ─── Histograma de logins (últimos 7 dias) ───────────────────────

export async function getLoginActivity() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT date_trunc('day', started_at) AS day, COUNT(*)::bigint AS count
    FROM user_sessions
    WHERE started_at >= ${start}
    GROUP BY 1
    ORDER BY 1 ASC
  `

  const byDay = new Map<string, number>(
    rows.map((r) => [new Date(r.day).toDateString(), Number(r.count)])
  )

  const result: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    result.push({
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      count: byDay.get(d.toDateString()) ?? 0,
    })
  }

  return result
}
