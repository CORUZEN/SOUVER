type RouteStats = {
  requests: number
  statuses: Record<string, number>
  totalDurationMs: number
  maxDurationMs: number
  lastDurationMs: number
  avgDurationMs: number
  errors: number
  updatedAt: string
}

type CacheStats = {
  hit: number
  inflightHit: number
  miss: number
  loadSuccess: number
  loadError: number
  updatedAt: string
}

type ConcurrencyStats = {
  immediate: number
  queued: number
  waitCount: number
  totalWaitMs: number
  avgWaitMs: number
  maxWaitMs: number
  updatedAt: string
}

const routeStats = new Map<string, RouteStats>()
const cacheStats = new Map<string, CacheStats>()
const concurrencyStats = new Map<string, ConcurrencyStats>()
const MAX_SCOPES = 64

function nowIso() {
  return new Date().toISOString()
}

function trimMapSize<T>(map: Map<string, T>) {
  if (map.size <= MAX_SCOPES) return
  const firstKey = map.keys().next().value as string | undefined
  if (firstKey) map.delete(firstKey)
}

function normalizeCacheScope(cacheKey: string): string {
  const parts = String(cacheKey ?? '').split(':').filter(Boolean)
  if (parts.length >= 3 && /^v\d+$/i.test(parts[2])) return `${parts[0]}:${parts[1]}`
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  return parts[0] || 'unknown'
}

function routeScope(routeId: string): RouteStats {
  const key = String(routeId || 'unknown')
  const existing = routeStats.get(key)
  if (existing) return existing
  const created: RouteStats = {
    requests: 0,
    statuses: {},
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastDurationMs: 0,
    avgDurationMs: 0,
    errors: 0,
    updatedAt: nowIso(),
  }
  routeStats.set(key, created)
  trimMapSize(routeStats)
  return created
}

function cacheScope(cacheKey: string): CacheStats {
  const key = normalizeCacheScope(cacheKey)
  const existing = cacheStats.get(key)
  if (existing) return existing
  const created: CacheStats = {
    hit: 0,
    inflightHit: 0,
    miss: 0,
    loadSuccess: 0,
    loadError: 0,
    updatedAt: nowIso(),
  }
  cacheStats.set(key, created)
  trimMapSize(cacheStats)
  return created
}

function concurrencyScope(poolKey: string): ConcurrencyStats {
  const key = String(poolKey || 'unknown')
  const existing = concurrencyStats.get(key)
  if (existing) return existing
  const created: ConcurrencyStats = {
    immediate: 0,
    queued: 0,
    waitCount: 0,
    totalWaitMs: 0,
    avgWaitMs: 0,
    maxWaitMs: 0,
    updatedAt: nowIso(),
  }
  concurrencyStats.set(key, created)
  trimMapSize(concurrencyStats)
  return created
}

export function recordRouteRequest(routeId: string) {
  const stats = routeScope(routeId)
  stats.requests += 1
  stats.updatedAt = nowIso()
}

export function recordRouteStatus(routeId: string, status: number) {
  const stats = routeScope(routeId)
  const key = String(status)
  stats.statuses[key] = (stats.statuses[key] ?? 0) + 1
  if (status >= 500) stats.errors += 1
  stats.updatedAt = nowIso()
}

export function observeRouteDuration(routeId: string, durationMs: number) {
  const stats = routeScope(routeId)
  const ms = Math.max(0, Math.round(durationMs))
  stats.lastDurationMs = ms
  stats.totalDurationMs += ms
  stats.maxDurationMs = Math.max(stats.maxDurationMs, ms)
  stats.avgDurationMs = stats.requests > 0 ? Number((stats.totalDurationMs / stats.requests).toFixed(2)) : 0
  stats.updatedAt = nowIso()
}

export function recordCacheEvent(cacheKey: string, event: 'hit' | 'inflight_hit' | 'miss' | 'load_success' | 'load_error') {
  const stats = cacheScope(cacheKey)
  if (event === 'hit') stats.hit += 1
  if (event === 'inflight_hit') stats.inflightHit += 1
  if (event === 'miss') stats.miss += 1
  if (event === 'load_success') stats.loadSuccess += 1
  if (event === 'load_error') stats.loadError += 1
  stats.updatedAt = nowIso()
}

export function recordConcurrencyImmediate(poolKey: string) {
  const stats = concurrencyScope(poolKey)
  stats.immediate += 1
  stats.updatedAt = nowIso()
}

export function recordConcurrencyQueued(poolKey: string) {
  const stats = concurrencyScope(poolKey)
  stats.queued += 1
  stats.updatedAt = nowIso()
}

export function observeConcurrencyWait(poolKey: string, waitMs: number) {
  const stats = concurrencyScope(poolKey)
  const ms = Math.max(0, Math.round(waitMs))
  stats.waitCount += 1
  stats.totalWaitMs += ms
  stats.maxWaitMs = Math.max(stats.maxWaitMs, ms)
  stats.avgWaitMs = stats.waitCount > 0 ? Number((stats.totalWaitMs / stats.waitCount).toFixed(2)) : 0
  stats.updatedAt = nowIso()
}

export function getTelemetrySnapshot() {
  return {
    generatedAt: nowIso(),
    routes: Object.fromEntries(routeStats.entries()),
    cache: Object.fromEntries(cacheStats.entries()),
    concurrency: Object.fromEntries(concurrencyStats.entries()),
  }
}

export function resetTelemetry() {
  routeStats.clear()
  cacheStats.clear()
  concurrencyStats.clear()
}

