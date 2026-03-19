import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getProductionKPIs, KpiDateRange } from '@/domains/production/production.service'
import { getInventoryKPIs } from '@/domains/inventory/inventory.service'
import { getQualityKPIs } from '@/domains/quality/quality.service'
import { getHRKPIs } from '@/domains/hr/hr.service'

// ─── Helper: calcula DateRange a partir do parâmetro period ──────

function buildDateRange(period: string): KpiDateRange | undefined {
  const now = new Date()
  const to  = new Date(now)
  to.setHours(23, 59, 59, 999)

  switch (period) {
    case 'today': {
      const from = new Date(now)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    }
    case 'week': {
      const from = new Date(now)
      from.setDate(from.getDate() - 6)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from, to }
    }
    case 'quarter': {
      const from = new Date(now)
      from.setDate(from.getDate() - 89)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    }
    default:
      return undefined   // 'all' — sem filtro de data
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const period    = req.nextUrl.searchParams.get('period') ?? 'all'
  const dateRange = buildDateRange(period)

  const [production, inventory, quality, hr, activeUsers] = await Promise.all([
    getProductionKPIs(dateRange),
    getInventoryKPIs(dateRange),
    getQualityKPIs(dateRange),
    getHRKPIs(dateRange),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ])

  return NextResponse.json({ production, inventory, quality, hr, activeUsers, period })
}
