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

// ─── Helper: calcula o período anterior equivalente ──────────────

function buildPreviousDateRange(period: string): KpiDateRange | undefined {
  if (period === 'all') return undefined
  const current = buildDateRange(period)
  if (!current) return undefined

  const durationMs = current.to.getTime() - current.from.getTime()
  return {
    from: new Date(current.from.getTime() - durationMs - 1),
    to:   new Date(current.from.getTime() - 1),
  }
}

// ─── Helper: variação percentual ─────────────────────────────────

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const period        = req.nextUrl.searchParams.get('period') ?? 'all'
  const dateRange     = buildDateRange(period)
  const prevDateRange = buildPreviousDateRange(period)

  const [production, inventory, quality, hr, activeUsers] = await Promise.all([
    getProductionKPIs(dateRange),
    getInventoryKPIs(dateRange),
    getQualityKPIs(dateRange),
    getHRKPIs(dateRange),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ])

  // Busca KPIs do período anterior para calcular variação
  let variation: Record<string, number | null> | undefined
  if (prevDateRange) {
    const [prevProd, prevInv, prevQuality, prevHr] = await Promise.all([
      getProductionKPIs(prevDateRange),
      getInventoryKPIs(prevDateRange),
      getQualityKPIs(prevDateRange),
      getHRKPIs(prevDateRange),
    ])

    variation = {
      // Produção
      totalBatches:    delta(production.totalBatches,      prevProd.totalBatches),
      finished:        delta(production.finished,          prevProd.finished),
      totalProducedQty: delta(
        production.totalProducedQty  ?? 0,
        prevProd.totalProducedQty    ?? 0,
      ),
      // Logística
      totalMovements:  delta(inventory.totalMovements,     prevInv.totalMovements),
      lowStockCount:   delta(inventory.lowStockCount,      prevInv.lowStockCount),
      // Qualidade
      openNCs:         delta(quality.openNCs,              prevQuality.openNCs),
      totalRecords:    delta(quality.totalRecords,         prevQuality.totalRecords),
      // RH
      loggedToday:     delta(hr.loggedToday,               prevHr.loggedToday),
    }
  }

  return NextResponse.json({ production, inventory, quality, hr, activeUsers, period, variation })
}
