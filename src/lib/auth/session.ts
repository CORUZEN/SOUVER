import { prisma } from '@/lib/prisma'
import { signTokenEdge, verifyTokenEdge } from './jwt-edge'
import { addSeconds } from 'date-fns'

const SESSION_SECONDS = parseInt(
  process.env.SESSION_EXPIRATION_SECONDS ?? '28800',
  10
)

/** Cria sessão e retorna token JWT */
export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = addSeconds(new Date(), SESSION_SECONDS)

  const session = await prisma.userSession.create({
    data: {
      userId,
      ipAddress,
      userAgent,
      expiresAt,
      status: 'ACTIVE',
    },
  })

  const token = await signTokenEdge(userId, session.id)
  return { token, expiresAt }
}

/** Retorna usuário autenticado pelo token, ou null se inválido/expirado */
export async function getCurrentUser(token: string) {
  const payload = await verifyTokenEdge(token)
  if (!payload) return null

  const session = await prisma.userSession.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.sub,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
  })

  if (!session) return null

  return prisma.user.findFirst({
    where: { id: payload.sub, isActive: true },
    include: { role: true, department: true },
  })
}

/** Revoga uma sessão pelo token JWT */
export async function revokeSession(token: string): Promise<void> {
  const payload = await verifyTokenEdge(token)
  if (!payload) return

  await prisma.userSession.updateMany({
    where: { id: payload.sessionId, userId: payload.sub },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })
}
