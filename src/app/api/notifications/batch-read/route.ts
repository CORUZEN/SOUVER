import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

// PATCH /api/notifications/batch-read — marca IDs específicas como lidas
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids deve ser um array não vazio' }, { status: 400 })
  }

  // Garante que só marcamos notificações do próprio usuário
  const { count } = await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: user.id, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ markedRead: count })
}
