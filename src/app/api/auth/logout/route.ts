import { NextRequest, NextResponse } from 'next/server'
import { revokeSession } from '@/lib/auth/session'
import { auditLog } from '@/domains/audit/audit.service'
import { getCurrentUser } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('souver_token')?.value
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? 'unknown'

    if (token) {
      const user = await getCurrentUser(token)
      if (user) {
        await revokeSession(token)
        await auditLog({
          userId: user.id,
          module: 'auth',
          action: 'LOGOUT',
          description: 'Logout realizado.',
          ipAddress: ip,
          userAgent,
        })
      }
    }

    const response = NextResponse.json({ message: 'Sessão encerrada.' })
    response.cookies.delete('souver_token')
    return response
  } catch (error) {
    console.error('[AUTH/LOGOUT]', error)
    const response = NextResponse.json({ message: 'Sessão encerrada.' })
    response.cookies.delete('souver_token')
    return response
  }
}
