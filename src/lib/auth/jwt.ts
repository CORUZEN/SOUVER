import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!

if (!SECRET) {
  throw new Error('[SOUVER] JWT_SECRET não definido nas variáveis de ambiente.')
}

interface JwtPayload {
  sub: string
  sessionId: string
  iat?: number
  exp?: number
}

export function signToken(sub: string, sessionId: string): string {
  return jwt.sign({ sub, sessionId }, SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '8h',
    algorithm: 'HS256',
  })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload
  } catch {
    return null
  }
}
