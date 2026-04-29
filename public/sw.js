// Ouro Verde PWA Service Worker
const CACHE_VERSION = 'ov-pwa-v1.01.496'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`

// Assets to precache on install
const PRECACHE_URLS = [
  '/app',
  '/manifest.json',
  '/branding/ouroverde-badge.webp',
  '/branding/ouroverde.webp',
]

// API routes to cache with network-first strategy (short TTL)
const API_CACHE_PATTERNS = [
  /\/api\/pwa\/summary/,
]

// Cache TTL for API responses (2 minutes)
const API_CACHE_TTL_MS = 2 * 60 * 1000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-fatal if some assets fail to precache
      })
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ov-pwa-') && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // API routes: network-first with short-TTL cache fallback
  if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirstWithTTL(request))
    return
  }

  // Navigation requests: network-first, fall back to cached /app
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/app').then((cached) => cached ?? fetch(request))
      )
    )
    return
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith('/branding/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirstWithTTL(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(15_000) })
    if (response.ok) {
      const clone = response.clone()
      const body = await clone.json().catch(() => null)
      if (body) {
        const stamped = new Response(JSON.stringify({ ...body, _cachedAt: Date.now() }), {
          headers: { 'Content-Type': 'application/json', 'X-SW-Cache': 'hit' },
        })
        cache.put(request, stamped)
      }
    }
    return response
  } catch {
    // Network failed — try cache
    const cached = await cache.match(request)
    if (cached) {
      const body = await cached.clone().json().catch(() => null)
      const cachedAt = body?._cachedAt ?? 0
      if (Date.now() - cachedAt < API_CACHE_TTL_MS) {
        return cached
      }
    }
    return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão com o servidor.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

