import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenEdge } from '@/lib/auth/jwt-edge'
import { authLoginLimiter, authForgotLimiter, checkRateLimit, getClientIp } from '@/lib/server/rate-limit'

// Rotas públicas que não exigem autenticação
const PUBLIC_PATHS = [
  '/login',
  '/app/login',
  '/app/esqueci-senha',
  '/api/auth/login',
  '/api/auth/2fa/verify-login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/esqueci-senha',
  '/resetar-senha',
]

// Rotas de assets estáticos que nunca devem ser bloqueadas
const STATIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/images',
  '/branding',
  '/fonts',
  '/manifest',
  '/sw.js',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (pathname.includes('.')) return true
  return false
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1) Rate limiting em APIs de auth (mesmo para rotas públicas)
  const ip = getClientIp(req)

  if (pathname === '/api/auth/login') {
    const result = await checkRateLimit(authLoginLimiter, ip)
    if (!result.ok) {
      return NextResponse.json(
        { message: `Muitas tentativas de login. Aguarde ${result.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      )
    }
  }

  if (pathname === '/api/auth/forgot-password') {
    const result = await checkRateLimit(authForgotLimiter, ip)
    if (!result.ok) {
      return NextResponse.json(
        { message: `Muitas tentativas de recuperação. Aguarde ${result.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      )
    }
  }

  // 2) Permite rotas públicas e assets
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 3) Valida sessão para rotas protegidas
  const token = req.cookies.get('souver_token')?.value

  const loginUrl = pathname.startsWith('/app/')
    ? new URL('/app/login', req.url)
    : new URL('/login', req.url)

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 })
    }
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyTokenEdge(token)

  if (!payload) {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ message: 'Sessão inválida ou expirada.' }, { status: 401 })
      : NextResponse.redirect(loginUrl)

    response.cookies.delete('souver_token')
    response.cookies.delete('souver_impersonator_token')
    return response
  }

  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|eot)$).*)'],
}
