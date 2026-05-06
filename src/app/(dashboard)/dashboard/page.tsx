import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getModulePermissions } from '@/lib/auth/permissions'

export const metadata: Metadata = {
  title: 'Módulos em Desenvolvimento',
}

export default async function DashboardPage() {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  const perms = await getModulePermissions(user)

  if (perms.metas?.interact) redirect('/metas')
  if (perms.logistica?.interact) redirect('/previsao')

  redirect('/acesso-negado')
}
