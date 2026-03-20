import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// GET /api/notifications — lista notificações do usuário com paginação e filtros
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const moduleName = searchParams.get('module') ?? undefined
  const skip       = (page - 1) * limit

  const where = {
    userId: user.id,
    ...(unreadOnly ? { isRead: false } : {}),
    ...(moduleName ? { module: moduleName } : {}),
  }

  const [notifications, total, totalUnread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ])

  return NextResponse.json({
    notifications,
    totalUnread,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=10' },
  })
}

// POST /api/notifications — cria notificação (uso interno / admin)
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['DEVELOPER', 'ADMIN'].includes(user.role?.code ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, userIds, roleCode, type, title, message, module: mod, link } = body

  if (!type || !title || !message) {
    return NextResponse.json({ error: 'type, title e message são obrigatórios' }, { status: 400 })
  }

  // Determina os destinatários
  let targetIds: string[] = []

  if (userId) {
    targetIds = [userId]
  } else if (userIds && Array.isArray(userIds)) {
    targetIds = userIds
  } else if (roleCode) {
    const role = await prisma.role.findUnique({ where: { code: roleCode }, select: { id: true } })
    if (role) {
      const users = await prisma.user.findMany({
        where: { roleId: role.id, status: 'ACTIVE' },
        select: { id: true },
      })
      targetIds = users.map(u => u.id)
    }
  } else {
    return NextResponse.json({ error: 'Informe userId, userIds ou roleCode' }, { status: 400 })
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  const result = await prisma.notification.createMany({
    data: targetIds.map(uid => ({
      userId: uid,
      type,
      title,
      message,
      module: mod ?? null,
      link:   link ?? null,
    })),
  })

  return NextResponse.json({ created: result.count }, { status: 201 })
}
