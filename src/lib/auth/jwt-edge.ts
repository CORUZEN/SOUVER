import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET ?? '')

export interface JwtPayload {
  sub: string
  sessionId: string
  iat?: number
  exp?: number
}

/** Verifica token JWT — compatível com Edge Runtime (middleware) */
export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

/** Assina token JWT — compatível com Edge Runtime */
export async function signTokenEdge(sub: string, sessionId: string): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h'
  const seconds = parseExpiry(expiresIn)

  return new SignJWT({ sub, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(SECRET_KEY)
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 28800
  const value = parseInt(match[1])
  const unit = match[2]
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * (units[unit] ?? 1)
}
