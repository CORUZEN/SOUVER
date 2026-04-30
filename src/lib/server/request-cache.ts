type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const valueCache = new Map<string, CacheEntry<unknown>>()
const inFlightCache = new Map<string, Promise<unknown>>()

function cleanupExpired(now: number) {
  if (valueCache.size <= 1000) return
  for (const [key, entry] of valueCache.entries()) {
    if (entry.expiresAt <= now) valueCache.delete(key)
  }
}

export function getRequestCache<T>(key: string): T | null {
  const now = Date.now()
  const entry = valueCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    valueCache.delete(key)
    return null
  }
  return entry.value as T
}

export function setRequestCache<T>(key: string, value: T, ttlMs: number) {
  const now = Date.now()
  valueCache.set(key, { value, expiresAt: now + Math.max(ttlMs, 0) })
  cleanupExpired(now)
}

export async function withRequestCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = getRequestCache<T>(key)
  if (cached !== null) return cached

  const inFlight = inFlightCache.get(key) as Promise<T> | undefined
  if (inFlight) {
    return inFlight
  }

  const promise = (async () => {
      try {
      const value = await loader()
      setRequestCache(key, value, ttlMs)
      return value
    } catch (error) {
      throw error
    }
  })()

  inFlightCache.set(key, promise)
  try {
    return await promise
  } finally {
    if (inFlightCache.get(key) === promise) inFlightCache.delete(key)
  }
}
