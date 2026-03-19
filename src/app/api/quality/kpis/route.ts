import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { getQualityKpisSummary } from '@/domains/quality/quality.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const data = await getQualityKpisSummary()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=20' },
  })
}