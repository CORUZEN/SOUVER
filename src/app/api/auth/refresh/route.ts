import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth/session'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * POST /api/auth/refresh
 *
 * Recebe o refresh token via cookie `souver_refresh_token` e emite
 * um novo access token (`souver_token`) se a sessão ainda for válida.
 *
 * Retorna 200 em todos os casos para evitar logs de erro no console
 * do navegador em fluxos proativos de silent refresh (PWA).
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('souver_refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, message: 'Refresh token não encontrado.' },
      { status: 200, headers: NO_CACHE_HEADERS }
    )
  }

  const result = await refreshAccessToken(refreshToken)

  if (!result) {
    const response = NextResponse.json(
      { ok: false, message: 'Sessão inválida ou expirada. Faça login novamente.' },
      { status: 200, headers: NO_CACHE_HEADERS }
    )
    response.cookies.delete('souver_token')
    response.cookies.delete('souver_refresh_token')
    response.cookies.delete('souver_impersonator_token')
    return response
  }

  const response = NextResponse.json(
    { ok: true, message: 'Sessão renovada com sucesso.' },
    { headers: NO_CACHE_HEADERS }
  )

  response.cookies.set('souver_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: result.expiresAt,
    path: '/',
  })

  return response
}
