import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { getHRKPIs, getLoginActivity } from '@/domains/hr/hr.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'rh')
  if (denied) return denied

  const [kpis, loginActivity] = await Promise.all([getHRKPIs(), getLoginActivity()])
  return NextResponse.json({ ...kpis, loginActivity })
}

