import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { canAccessIntegrations } from '@/lib/auth/permissions'

interface IntegracoesLayoutProps {
  children: ReactNode
}

export default async function IntegracoesLayout({ children }: IntegracoesLayoutProps) {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  const allowed = await canAccessIntegrations(user)
  if (!allowed) redirect('/acesso-negado')

  return <>{children}</>
}

