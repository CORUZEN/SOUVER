import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { verifyTokenEdge } from '@/lib/auth/jwt-edge'

// GET /api/users/me/sessions  — lista sessões ativas do usuário autenticado
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Identifica a sessão atual pelo cookie
  const currentToken = req.cookies.get('souver_token')?.value
  const currentPayload = currentToken ? await verifyTokenEdge(currentToken) : null
  const currentSessionId = currentPayload?.sessionId ?? null

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id:         true,
      ipAddress:  true,
      userAgent:  true,
      deviceName: true,
      startedAt:  true,
      expiresAt:  true,
    },
  })

  const result = sessions.map(s => ({
    ...s,
    isCurrent: s.id === currentSessionId,
  }))

  return NextResponse.json({ sessions: result })
}
