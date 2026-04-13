import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('souver_token')?.value
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const user = await getCurrentUser(token)
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const impersonatorToken = req.cookies.get('souver_impersonator_token')?.value
    let impersonation: { active: boolean; developerName: string } | null = null

    if (impersonatorToken && impersonatorToken !== token) {
      const impersonator = await getCurrentUser(impersonatorToken)
      if (impersonator?.role?.code === 'DEVELOPER') {
        impersonation = {
          active: true,
          developerName: impersonator.fullName,
        }
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        login: user.login,
        avatarUrl: user.avatarUrl,
        role: user.role?.name ?? user.role?.code ?? 'Usuário',
        roleCode: user.role?.code,
        department: user.department?.name,
        twoFactorEnabled: user.twoFactorEnabled,
        impersonation,
      },
    }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=30' },
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

