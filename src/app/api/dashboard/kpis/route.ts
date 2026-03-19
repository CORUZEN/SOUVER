import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getProductionKPIs, KpiDateRange } from '@/domains/production/production.service'
import { getInventoryKPIs } from '@/domains/inventory/inventory.service'
import { getQualityKPIs } from '@/domains/quality/quality.service'
import { getHRKPIs } from '@/domains/hr/hr.service'

type DashboardModule = 'production' | 'inventory' | 'quality' | 'hr'

function buildDateRange(period: string): KpiDateRange | undefined {
  const now = new Date()
  const to = new Date(now)
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
      return undefined
  }
}

function buildPreviousDateRange(period: string): KpiDateRange | undefined {
  if (period === 'all') return undefined
  const current = buildDateRange(period)
  if (!current) return undefined

  const durationMs = current.to.getTime() - current.from.getTime()
  return {
    from: new Date(current.from.getTime() - durationMs - 1),
    to: new Date(current.from.getTime() - 1),
  }
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function cacheHeader(period: string): string {
  if (period === 'today') return 'private, max-age=30, stale-while-revalidate=30'
  if (period === 'week') return 'private, max-age=120, stale-while-revalidate=60'
  return 'private, max-age=300, stale-while-revalidate=120'
}

async function getModuleData(moduleName: DashboardModule, dateRange?: KpiDateRange) {
  if (moduleName === 'production') return getProductionKPIs(dateRange)
  if (moduleName === 'inventory') return getInventoryKPIs(dateRange)
  if (moduleName === 'quality') return getQualityKPIs(dateRange)
  return getHRKPIs(dateRange)
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const period = req.nextUrl.searchParams.get('period') ?? 'all'
  const moduleParam = req.nextUrl.searchParams.get('module') as DashboardModule | null
  const variationParam = req.nextUrl.searchParams.get('variation')
  const includeVariation = variationParam == null ? !moduleParam : variationParam === 'true'
  const dateRange = buildDateRange(period)
  const prevDateRange = buildPreviousDateRange(period)

  if (moduleParam) {
    const moduleData = await getModuleData(moduleParam, dateRange)
    let variation: Record<string, number | null> | undefined

    if (includeVariation && prevDateRange) {
      if (moduleParam === 'production') {
        const previous = await getProductionKPIs(prevDateRange)
        const current = moduleData as Awaited<ReturnType<typeof getProductionKPIs>>
        variation = {
          totalBatches: delta(current.totalBatches, previous.totalBatches),
          finished: delta(current.finished, previous.finished),
          totalProducedQty: delta(current.totalProducedQty ?? 0, previous.totalProducedQty ?? 0),
        }
      }
      if (moduleParam === 'inventory') {
        const previous = await getInventoryKPIs(prevDateRange)
        const current = moduleData as Awaited<ReturnType<typeof getInventoryKPIs>>
        variation = {
          totalMovements: delta(current.totalMovements, previous.totalMovements),
          lowStockCount: delta(current.lowStockCount, previous.lowStockCount),
        }
      }
      if (moduleParam === 'quality') {
        const previous = await getQualityKPIs(prevDateRange)
        const current = moduleData as Awaited<ReturnType<typeof getQualityKPIs>>
        variation = {
          openNCs: delta(current.openNCs, previous.openNCs),
          totalRecords: delta(current.totalRecords, previous.totalRecords),
        }
      }
      if (moduleParam === 'hr') {
        const previous = await getHRKPIs(prevDateRange)
        const current = moduleData as Awaited<ReturnType<typeof getHRKPIs>>
        variation = {
          loggedToday: delta(current.loggedToday, previous.loggedToday),
        }
      }
    }

    return NextResponse.json(
      { [moduleParam]: moduleData, period, variation },
      { headers: { 'Cache-Control': cacheHeader(period) } },
    )
  }

  const [production, inventory, quality, hr, activeUsers] = await Promise.all([
    getProductionKPIs(dateRange),
    getInventoryKPIs(dateRange),
    getQualityKPIs(dateRange),
    getHRKPIs(dateRange),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ])

  let variation: Record<string, number | null> | undefined
  if (includeVariation && prevDateRange) {
    const [prevProd, prevInv, prevQuality, prevHr] = await Promise.all([
      getProductionKPIs(prevDateRange),
      getInventoryKPIs(prevDateRange),
      getQualityKPIs(prevDateRange),
      getHRKPIs(prevDateRange),
    ])

    variation = {
      totalBatches: delta(production.totalBatches, prevProd.totalBatches),
      finished: delta(production.finished, prevProd.finished),
      totalProducedQty: delta(production.totalProducedQty ?? 0, prevProd.totalProducedQty ?? 0),
      totalMovements: delta(inventory.totalMovements, prevInv.totalMovements),
      lowStockCount: delta(inventory.lowStockCount, prevInv.lowStockCount),
      openNCs: delta(quality.openNCs, prevQuality.openNCs),
      totalRecords: delta(quality.totalRecords, prevQuality.totalRecords),
      loggedToday: delta(hr.loggedToday, prevHr.loggedToday),
    }
  }

  return NextResponse.json(
    { production, inventory, quality, hr, activeUsers, period, variation },
    { headers: { 'Cache-Control': cacheHeader(period) } },
  )
}
