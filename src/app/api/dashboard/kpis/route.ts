import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getProductionKPIs, KpiDateRange } from '@/domains/production/production.service'
import { getInventoryKPIs } from '@/domains/inventory/inventory.service'
import { getQualityKPIs } from '@/domains/quality/quality.service'
import { getHRKPIs } from '@/domains/hr/hr.service'

type DashboardModule = 'production' | 'inventory' | 'quality' | 'hr'

// â”€â”€â”€ Cache em memÃ³ria com TTL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CacheEntry<T> { data: T; expiresAt: number }
const kpiCache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = kpiCache.get(key)
  if (!entry || Date.now() > entry.expiresAt) { kpiCache.delete(key); return null }
  return entry.data as T
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  kpiCache.set(key, { data, expiresAt: Date.now() + ttlMs })
  // Limpa entradas expiradas periodicamente
  if (kpiCache.size > 50) {
    const now = Date.now()
    for (const [k, v] of kpiCache) { if (now > v.expiresAt) kpiCache.delete(k) }
  }
}

function cacheTTL(period: string): number {
  if (period === 'today') return 15_000   // 15s
  if (period === 'week')  return 60_000   // 1min
  return 120_000                          // 2min
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if (period === 'today') return 'private, max-age=15, stale-while-revalidate=30'
  if (period === 'week') return 'private, max-age=60, stale-while-revalidate=60'
  return 'private, max-age=120, stale-while-revalidate=120'
}

async function getModuleData(moduleName: DashboardModule, dateRange?: KpiDateRange) {
  if (moduleName === 'production') return getProductionKPIs(dateRange)
  if (moduleName === 'inventory') return getInventoryKPIs(dateRange)
  if (moduleName === 'quality') return getQualityKPIs(dateRange)
  return getHRKPIs(dateRange)
}

async function cachedModuleData(moduleName: DashboardModule, dateRange: KpiDateRange | undefined, period: string) {
  const key = `kpi:${moduleName}:${period}`
  const cached = getCached(key)
  if (cached) return cached
  const data = await getModuleData(moduleName, dateRange)
  setCache(key, data, cacheTTL(period))
  return data
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'painel-executivo')
  if (denied) return denied

  const period = req.nextUrl.searchParams.get('period') ?? 'all'
  const moduleParam = req.nextUrl.searchParams.get('module') as DashboardModule | null
  const variationParam = req.nextUrl.searchParams.get('variation')
  const includeVariation = variationParam == null ? !moduleParam : variationParam === 'true'
  const dateRange = buildDateRange(period)
  const prevDateRange = buildPreviousDateRange(period)

  if (moduleParam) {
    const moduleData = await cachedModuleData(moduleParam, dateRange, period)
    let variation: Record<string, number | null> | undefined

    if (includeVariation && prevDateRange) {
      const prevKey = `kpi:${moduleParam}:prev:${period}`
      let previous = getCached<Awaited<ReturnType<typeof getModuleData>>>(prevKey)
      if (!previous) {
        previous = await getModuleData(moduleParam, prevDateRange)
        setCache(prevKey, previous, cacheTTL(period))
      }

      if (moduleParam === 'production') {
        const current = moduleData as Awaited<ReturnType<typeof getProductionKPIs>>
        const prev = previous as Awaited<ReturnType<typeof getProductionKPIs>>
        variation = {
          totalBatches: delta(current.totalBatches, prev.totalBatches),
          finished: delta(current.finished, prev.finished),
          totalProducedQty: delta(current.totalProducedQty ?? 0, prev.totalProducedQty ?? 0),
        }
      }
      if (moduleParam === 'inventory') {
        const current = moduleData as Awaited<ReturnType<typeof getInventoryKPIs>>
        const prev = previous as Awaited<ReturnType<typeof getInventoryKPIs>>
        variation = {
          totalMovements: delta(current.totalMovements, prev.totalMovements),
          lowStockCount: delta(current.lowStockCount, prev.lowStockCount),
        }
      }
      if (moduleParam === 'quality') {
        const current = moduleData as Awaited<ReturnType<typeof getQualityKPIs>>
        const prev = previous as Awaited<ReturnType<typeof getQualityKPIs>>
        variation = {
          openNCs: delta(current.openNCs, prev.openNCs),
          totalRecords: delta(current.totalRecords, prev.totalRecords),
        }
      }
      if (moduleParam === 'hr') {
        const current = moduleData as Awaited<ReturnType<typeof getHRKPIs>>
        const prev = previous as Awaited<ReturnType<typeof getHRKPIs>>
        variation = {
          loggedToday: delta(current.loggedToday, prev.loggedToday),
        }
      }
    }

    return NextResponse.json(
      { [moduleParam]: moduleData, period, variation },
      { headers: { 'Cache-Control': cacheHeader(period) } },
    )
  }

  const [production, inventory, quality, hr] = await Promise.all([
    cachedModuleData('production', dateRange, period),
    cachedModuleData('inventory', dateRange, period),
    cachedModuleData('quality', dateRange, period),
    cachedModuleData('hr', dateRange, period),
  ]) as [
    Awaited<ReturnType<typeof getProductionKPIs>>,
    Awaited<ReturnType<typeof getInventoryKPIs>>,
    Awaited<ReturnType<typeof getQualityKPIs>>,
    Awaited<ReturnType<typeof getHRKPIs>>,
  ]

  let variation: Record<string, number | null> | undefined
  if (includeVariation && prevDateRange) {
    const [prevProd, prevInv, prevQuality, prevHr] = await Promise.all([
      cachedModuleData('production', prevDateRange, `prev:${period}`),
      cachedModuleData('inventory', prevDateRange, `prev:${period}`),
      cachedModuleData('quality', prevDateRange, `prev:${period}`),
      cachedModuleData('hr', prevDateRange, `prev:${period}`),
    ]) as [
      Awaited<ReturnType<typeof getProductionKPIs>>,
      Awaited<ReturnType<typeof getInventoryKPIs>>,
      Awaited<ReturnType<typeof getQualityKPIs>>,
      Awaited<ReturnType<typeof getHRKPIs>>,
    ]

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

  const activeUsers = await prisma.user.count({ where: { status: 'ACTIVE' } })

  return NextResponse.json(
    { production, inventory, quality, hr, activeUsers, period, variation },
    { headers: { 'Cache-Control': cacheHeader(period) } },
  )
}

