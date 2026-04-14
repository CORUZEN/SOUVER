import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { canAccessIntegrations, getMetasPermissions } from '@/lib/auth/permissions'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Cookie',
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('souver_token')?.value
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    const user = await getCurrentUser(token)
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    const impersonatorToken = req.cookies.get('souver_impersonator_token')?.value
    let impersonation: { active: boolean; developerName: string } | null = null
    let shouldClearImpersonatorCookie = false

    if (impersonatorToken && impersonatorToken !== token) {
      const impersonator = await getCurrentUser(impersonatorToken)
      if (impersonator?.role?.code === 'DEVELOPER' && impersonator.id !== user.id) {
        impersonation = {
          active: true,
          developerName: impersonator.fullName,
        }
      } else {
        // Cookie de locação ficou stale (sessão inválida ou mesmo usuário).
        shouldClearImpersonatorCookie = true
      }
    } else if (impersonatorToken && impersonatorToken === token) {
      shouldClearImpersonatorCookie = true
    }

    const [integrationsAccess, metasPermissions] = await Promise.all([
      canAccessIntegrations(user),
      getMetasPermissions(user),
    ])

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        login: user.login,
        avatarUrl: user.avatarUrl,
        role: user.role?.name ?? user.role?.code ?? 'Usuário',
        roleCode: user.role?.code,
        canAccessIntegrations: integrationsAccess,
        metasPermissions,
        department: user.department?.name,
        twoFactorEnabled: user.twoFactorEnabled,
        impersonation,
      },
    }, {
      headers: NO_CACHE_HEADERS,
    })

    if (shouldClearImpersonatorCookie) {
      response.cookies.delete('souver_impersonator_token')
    }

    return response
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_CACHE_HEADERS })
  }
}


