import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
const LEGACY_SECRET_KEY = process.env.JWT_SECRET_LEGACY
  ? new TextEncoder().encode(process.env.JWT_SECRET_LEGACY)
  : null

export interface RefreshTokenPayload {
  sub: string
  sessionId: string
  purpose: 'refresh'
  iat?: number
  exp?: number
}

const REFRESH_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60 // 30 dias

/**
 * Gera um refresh token JWT separado do access token.
 * Usado para revalidar sessões sem exigir novo login.
 */
export async function signRefreshToken(
  userId: string,
  sessionId: string
): Promise<string> {
  return new SignJWT({ purpose: 'refresh' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + REFRESH_EXPIRES_IN_SECONDS)
    .sign(SECRET_KEY)
}

/**
 * Verifica um refresh token JWT.
 * Tenta a chave atual primeiro; se falhar, tenta a chave legada (transição suave).
 */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload | null> {
  async function verifyWithKey(key: Uint8Array): Promise<RefreshTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        clockTolerance: 60,
      })
      if (payload.purpose !== 'refresh') return null
      if (!payload.sub || !payload.jti) return null
      return {
        sub: payload.sub,
        sessionId: payload.jti,
        purpose: 'refresh',
        iat: payload.iat,
        exp: payload.exp,
      }
    } catch {
      return null
    }
  }

  const result = await verifyWithKey(SECRET_KEY)
  if (result) return result

  if (LEGACY_SECRET_KEY) {
    return verifyWithKey(LEGACY_SECRET_KEY)
  }

  return null
}
