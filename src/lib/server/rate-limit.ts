import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'

/* ── Rate limiters por categoria ─────────────────────────────────────── */

/** Login / 2FA verify — 5 tentativas por IP a cada 15 minutos */
export const authLoginLimiter = new RateLimiterMemory({
  keyPrefix: 'auth_login_ip',
  points: 5,
  duration: 15 * 60,
})

/** Forgot-password — 3 tentativas por IP a cada 60 minutos */
export const authForgotLimiter = new RateLimiterMemory({
  keyPrefix: 'auth_forgot_ip',
  points: 3,
  duration: 60 * 60,
})

/** Reset-password — 5 tentativas por IP a cada 15 minutos */
export const authResetLimiter = new RateLimiterMemory({
  keyPrefix: 'auth_reset_ip',
  points: 5,
  duration: 15 * 60,
})

/** APIs públicas gerais — 100 req/min por IP */
export const publicApiLimiter = new RateLimiterMemory({
  keyPrefix: 'public_api_ip',
  points: 100,
  duration: 60,
})

/** APIs pesadas (Sankhya, relatórios) — 30 req/min por IP */
export const heavyApiLimiter = new RateLimiterMemory({
  keyPrefix: 'heavy_api_ip',
  points: 30,
  duration: 60,
})

/** APIs autenticadas gerais — 200 req/min por IP */
export const authedApiLimiter = new RateLimiterMemory({
  keyPrefix: 'authed_api_ip',
  points: 200,
  duration: 60,
})

/* ── Helpers ─────────────────────────────────────────────────────────── */

export type RateLimitResult =
  | { ok: true; remainingPoints: number }
  | { ok: false; retryAfterSeconds: number }

export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<RateLimitResult> {
  try {
    const res = await limiter.consume(key, 1)
    return { ok: true, remainingPoints: res.remainingPoints }
  } catch (rej) {
    if (rej instanceof RateLimiterRes) {
      return { ok: false, retryAfterSeconds: Math.ceil(rej.msBeforeNext / 1000) }
    }
    // Se houver erro inesperado no rate limiter, não bloqueamos a requisição
    return { ok: true, remainingPoints: 0 }
  }
}

/** Extrai IP de forma robusta (funciona com proxies) */
export function getClientIp(req: { headers: { get: (name: string) => string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
