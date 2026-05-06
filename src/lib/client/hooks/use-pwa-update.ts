'use client'

import { useEffect, useState } from 'react'

interface PwaUpdateState {
  hasUpdate: boolean
  applyUpdate: () => void
}

export function usePwaUpdate(): PwaUpdateState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined

    const handleUpdateFound = () => {
      const newWorker = registration?.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // A new version is waiting and the page is controlled by an old one
          setWaitingWorker(newWorker)
          setHasUpdate(true)
        }
      })
    }

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg
      reg.addEventListener('updatefound', handleUpdateFound)

      // Check if there's already a waiting worker on mount
      if (reg.waiting) {
        setWaitingWorker(reg.waiting)
        setHasUpdate(true)
      }
    })

    // Also listen for controllerchange to reload after update
    const onControllerChange = () => {
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      registration?.removeEventListener('updatefound', handleUpdateFound)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    // controllerchange listener above will trigger reload
  }

  return { hasUpdate, applyUpdate }
}
