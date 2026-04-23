import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenEdge } from '@/lib/auth/jwt-edge'

// Rotas públicas que não exigem autenticação
const PUBLIC_PATHS = [
  '/login',
  '/app/login',
  '/app/esqueci-senha',
  '/api/auth/login',
  '/api/auth/2fa/verify-login',
  '/api/auth/forgot-password',
  '/api/health',
  '/api/integrations/sankhya/data-dictionary',
  '/esqueci-senha',
  '/resetar-senha',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permite rotas públicas e assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('souver_token')?.value

  // Rotas /app/* sem autenticação vão direto para o login PWA
  const loginUrl = pathname.startsWith('/app/')
    ? new URL('/app/login', req.url)
    : new URL('/login', req.url)

  if (!token) {
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyTokenEdge(token)

  if (!payload) {
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('souver_token')
    return response
  }

  const response = NextResponse.next()

  // Adicionar headers de performance
  response.headers.set('X-Content-Type-Options', 'nosniff')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|eot)$).*)'],
}
