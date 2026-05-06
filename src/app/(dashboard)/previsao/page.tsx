import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getModulePermissions } from '@/lib/auth/permissions'
import PrevisaoDeEstoque from '@/components/faturamento/PlanejamentoDiario'

export const metadata = {
  title: 'Previsão de Pedidos',
  description: 'Visualize pedidos em aberto por vendedor, cidade e período.',
}

export default async function PrevisaoPage() {
  const token = (await cookies()).get('souver_token')?.value
  if (!token) redirect('/login')

  const user = await getCurrentUser(token)
  if (!user) redirect('/login')

  const perms = await getModulePermissions(user)
  if (!perms.previsao?.interact) redirect('/acesso-negado')

  return <PrevisaoDeEstoque />
}
