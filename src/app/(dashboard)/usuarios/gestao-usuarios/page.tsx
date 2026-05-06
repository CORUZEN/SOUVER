import { getModulePermissions } from '@/lib/auth/permissions'
import { getCurrentUser } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function UsuariosGestaoRedirectPage() {
  const token = (await cookies()).get('souver_token')?.value
  if (token) {
    const user = await getCurrentUser(token)
    if (user) {
      const perms = await getModulePermissions(user)
      if (!perms.usuarios?.interact) redirect('/acesso-negado')
    } else {
      redirect('/acesso-negado')
    }
  } else {
    redirect('/acesso-negado')
  }
  redirect('/dev/gestao-usuarios')
}

