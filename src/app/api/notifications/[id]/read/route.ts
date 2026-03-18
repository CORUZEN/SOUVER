import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

// PATCH /api/notifications/[id]/read — marca notificação como lida
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== user.id) {
    return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data:  { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ notification: updated })
}
