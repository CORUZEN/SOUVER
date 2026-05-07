'use client'

import { useEffect } from 'react'

export default function ServiceWorkerManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const isLocalhost =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1'
    const isProd = process.env.NODE_ENV === 'production'

    window.addEventListener('load', () => {
      if (!isProd || isLocalhost) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {})
        if ('caches' in window) {
          caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((k) => k.indexOf('ov-pwa-') === 0)
                  .map((k) => caches.delete(k))
              )
            )
            .catch(() => {})
        }
        return
      }

      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {})
    })
  }, [])

  return null
}
