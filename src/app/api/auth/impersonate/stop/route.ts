import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, revokeSession } from '@/lib/auth/session'
import { auditLog } from '@/domains/audit/audit.service'

export async function POST(req: NextRequest) {
  const impersonatorToken = req.cookies.get('souver_impersonator_token')?.value
  if (!impersonatorToken) {
    return NextResponse.json({ message: 'Nenhuma locação ativa foi encontrada.' }, { status: 400 })
  }

  const developerUser = await getCurrentUser(impersonatorToken)
  if (!developerUser || developerUser.role?.code !== 'DEVELOPER') {
    const response = NextResponse.json({ message: 'Sessão de desenvolvedor inválida.' }, { status: 401 })
    response.cookies.delete('souver_impersonator_token')
    return response
  }

  const currentToken = req.cookies.get('souver_token')?.value
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  if (currentToken && currentToken !== impersonatorToken) {
    await revokeSession(currentToken)
  }

  await auditLog({
    userId: developerUser.id,
    module: 'auth',
    action: 'IMPERSONATION_STOPPED',
    description: 'Desenvolvedor retornou para sua sessão original.',
    ipAddress: ip,
    userAgent,
  })

  const response = NextResponse.json({
    message: `Sessão original restaurada para ${developerUser.fullName}.`,
  })

  response.cookies.set('souver_token', impersonatorToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  response.cookies.delete('souver_impersonator_token')

  return response
}
