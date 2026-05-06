import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getModulePermissions } from '@/lib/auth/permissions'
import ClientPage from './client-page'

export default async function Page() {
  const token = (await cookies()).get('souver_token')?.value
  if (token) {
    const user = await getCurrentUser(token)
    if (user) {
      const perms = await getModulePermissions(user)
      if (perms.comunicacao?.interact) return <ClientPage />
    }
  }
  redirect('/acesso-negado')
}
