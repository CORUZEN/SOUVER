import { prisma } from '@/lib/prisma'
import { getCurrentUser } from './session'
import { NextRequest } from 'next/server'

/** Retorna usuário autenticado a partir do request, ou null */
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('souver_token')?.value
  if (!token) return null
  return getCurrentUser(token)
}

/** Verifica se um perfil possui determinada permissão. DEVELOPER tem acesso total. */
export async function hasPermission(
  roleId: string | null | undefined,
  permissionCode: string
): Promise<boolean> {
  if (!roleId) return false
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { code: true } })
  if (!role) return false
  if (role.code === 'DEVELOPER') return true
  const perm = await prisma.rolePermission.findFirst({
    where: { roleId, permission: { code: permissionCode } },
  })
  return !!perm
}

const INTEGRATIONS_ALLOWED_ROLE_CODES = new Set(['DEVELOPER', 'IT_ANALYST'])

export interface AuthzUserLike {
  roleId?: string | null
  role?: {
    code?: string | null
  } | null
}

/** Regra central para acesso ao painel de integrações. */
export async function canAccessIntegrations(user: AuthzUserLike | null | undefined): Promise<boolean> {
  if (!user) return false

  const roleCode = user.role?.code?.toUpperCase() ?? null
  if (!roleCode) return false

  // Diretoria não deve acessar o painel de integrações.
  if (roleCode === 'DIRECTORATE') return false

  if (INTEGRATIONS_ALLOWED_ROLE_CODES.has(roleCode)) return true

  return hasPermission(user.roleId, 'integrations:read')
}
