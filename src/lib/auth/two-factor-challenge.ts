import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
const DEFAULT_EXPIRY_SECONDS = 10 * 60

function getChallengeExpirySeconds() {
  const value = Number.parseInt(process.env.TWO_FACTOR_CHALLENGE_EXPIRY_SECONDS ?? '', 10)
  if (Number.isFinite(value) && value > 0) return value
  return DEFAULT_EXPIRY_SECONDS
}

export async function createTwoFactorChallenge(userId: string) {
  const expiresInSeconds = getChallengeExpirySeconds()
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

  const token = await new SignJWT({ purpose: 'login-2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(SECRET_KEY)

  return { token, expiresAt }
}

export async function verifyTwoFactorChallenge(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    if (payload.purpose !== 'login-2fa') return null
    if (!payload.sub) return null
    return { userId: payload.sub }
  } catch {
    return null
  }
}
