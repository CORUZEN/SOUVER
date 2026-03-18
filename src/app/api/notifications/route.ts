import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// GET /api/notifications — lista notificações do usuário (não lidas primeiro)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)

  const notifications = await prisma.notification.findMany({
    where: {
      userId:  user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  const totalUnread = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  })

  return NextResponse.json({ notifications, totalUnread })
}
