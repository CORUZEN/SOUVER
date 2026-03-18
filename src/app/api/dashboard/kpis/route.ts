import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getProductionKPIs } from '@/domains/production/production.service'
import { getInventoryKPIs } from '@/domains/inventory/inventory.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [production, inventory, usersActive] = await Promise.all([
    getProductionKPIs(),
    getInventoryKPIs(),
    prisma.user.count({ where: { isActive: true } }),
  ])

  return NextResponse.json({
    production,
    inventory,
    usersActive,
  })
}
