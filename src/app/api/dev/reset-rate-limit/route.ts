import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { authLoginLimiter } from '@/lib/server/rate-limit'

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req)

  if (!currentUser) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })
  }

  const SYSTEM_OWNER_LOGIN = process.env.SYSTEM_OWNER_LOGIN || 'admin'
  if (currentUser.login !== SYSTEM_OWNER_LOGIN) {
    return NextResponse.json({ message: 'Apenas o administrador principal pode executar esta ação.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const ip = searchParams.get('ip')

  if (!ip) {
    return NextResponse.json({ message: 'Informe o IP via query param ?ip=...' }, { status: 400 })
  }

  try {
    await authLoginLimiter.delete(ip)
    return NextResponse.json({ message: `Rate limit resetado para IP ${ip}.` })
  } catch {
    return NextResponse.json({ message: 'Não havia rate limit ativo para este IP.' })
  }
}
