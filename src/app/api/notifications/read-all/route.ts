import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// PATCH /api/notifications/read-all — marca TODAS como lidas
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { count } = await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ markedRead: count })
}
