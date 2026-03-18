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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        login: user.login,
        role: user.role?.name ?? user.role?.code ?? 'Usuário',
        roleCode: user.role?.code,
        department: user.department?.name,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
