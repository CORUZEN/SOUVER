import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from './session'
import { getModulePermissions } from './permissions'

/**
 * Verifica se o usuário autenticado tem permissão para interagir com um módulo.
 * Redireciona para /login se não autenticado, ou /acesso-negado se sem permissão.
 */
export async function requireModuleAccess(moduleKey: string) {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  const perms = await getModulePermissions(user)
  if (!perms[moduleKey]?.interact) redirect('/acesso-negado')

  return user
}

/**
 * Apenas garante que o usuário está autenticado.
 */
export async function requireAuth() {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  return user
}
