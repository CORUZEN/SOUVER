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
  userAgent: string,
  sessionDurationHours?: number | null
): Promise<{ token: string; expiresAt: Date }> {
  const seconds = sessionDurationHours != null
    ? sessionDurationHours * 3600
    : SESSION_SECONDS
  const expiresAt = addSeconds(new Date(), seconds)

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

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    select: {
      userId: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          login: true,
          roleId: true,
          departmentId: true,
          isActive: true,
          twoFactorEnabled: true,
          role: {
            select: {
              id: true,
              name: true,
              code: true,
              requireTwoFactor: true,
              sessionDurationHours: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!session) return null
  if (session.userId !== payload.sub) return null
  if (session.status !== 'ACTIVE') return null
  if (session.revokedAt) return null
  if (session.expiresAt <= new Date()) return null
  if (!session.user?.isActive) return null

  return session.user
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
