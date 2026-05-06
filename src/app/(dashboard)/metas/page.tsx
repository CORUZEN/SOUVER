import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getModulePermissions } from '@/lib/auth/permissions'
import MetasWorkspace from '@/components/metas/MetasWorkspace'

export const metadata: Metadata = {
  title: 'Painel de Metas',
}

export default async function MetasPage() {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  const perms = await getModulePermissions(user)
  if (!perms.metas?.interact) redirect('/acesso-negado')

  return <MetasWorkspace />
}
