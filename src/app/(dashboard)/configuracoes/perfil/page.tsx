import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import ClientPage from './client-page'

export default async function Page() {
  const token = (await cookies()).get('souver_token')?.value
  if (token) {
    const user = await getCurrentUser(token)
    if (user) return <ClientPage />
  }
  redirect('/app/login')
}
