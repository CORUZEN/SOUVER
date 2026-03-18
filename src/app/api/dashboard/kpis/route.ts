import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getProductionKPIs } from '@/domains/production/production.service'
import { getInventoryKPIs } from '@/domains/inventory/inventory.service'
import { getQualityKPIs } from '@/domains/quality/quality.service'
import { getHRKPIs } from '@/domains/hr/hr.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [production, inventory, quality, hr, activeUsers] = await Promise.all([
    getProductionKPIs(),
    getInventoryKPIs(),
    getQualityKPIs(),
    getHRKPIs(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ])

  return NextResponse.json({ production, inventory, quality, hr, activeUsers })
}
