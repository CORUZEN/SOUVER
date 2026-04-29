import { prisma } from '@/lib/prisma'
import { signTokenEdge, verifyTokenEdge } from './jwt-edge'
import { signRefreshToken, verifyRefreshToken } from './refresh-token'
import { addSeconds } from 'date-fns'

const SESSION_SECONDS = parseInt(
  process.env.SESSION_EXPIRATION_SECONDS ?? '28800',
  10
)

export interface SessionResult {
  token: string
  refreshToken: string
  expiresAt: Date
}

/** Cria sessão e retorna access token + refresh token */
export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  sessionDurationHours?: number | null
): Promise<SessionResult> {
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
  const refreshToken = await signRefreshToken(userId, session.id)
  return { token, refreshToken, expiresAt }
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
          twoFactorSecret: true,
          sellerCode: true,
          phone: true,
          avatarUrl: true,
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

/**
 * Revalida um refresh token e emite um novo access token.
 * Retorna null se o refresh token for inválido ou a sessão estiver revogada/expirada.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; expiresAt: Date } | null> {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) return null

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    select: {
      userId: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { role: { select: { sessionDurationHours: true } } } },
    },
  })

  if (!session) return null
  if (session.userId !== payload.sub) return null
  if (session.status !== 'ACTIVE') return null
  if (session.revokedAt) return null
  if (session.expiresAt <= new Date()) return null

  const seconds = session.user?.role?.sessionDurationHours != null
    ? session.user.role.sessionDurationHours * 3600
    : SESSION_SECONDS
  const expiresAt = addSeconds(new Date(), seconds)

  // Atualiza expiresAt da sessão no banco (slide session)
  await prisma.userSession.update({
    where: { id: payload.sessionId },
    data: { expiresAt },
  })

  const newToken = await signTokenEdge(session.userId, payload.sessionId)
  return { token: newToken, expiresAt }
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
