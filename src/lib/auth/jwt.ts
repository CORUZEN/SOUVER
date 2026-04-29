import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!
const LEGACY_SECRET = process.env.JWT_SECRET_LEGACY || null

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

/** Verifica token JWT.
 *  Tenta a chave atual primeiro; se falhar, tenta a chave legada (transição suave).
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as JwtPayload
  } catch {
    if (LEGACY_SECRET) {
      try {
        return jwt.verify(token, LEGACY_SECRET, { algorithms: ['HS256'] }) as JwtPayload
      } catch {
        return null
      }
    }
    return null
  }
}
