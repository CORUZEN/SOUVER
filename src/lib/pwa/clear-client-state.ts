import { queryClient } from '@/lib/client/query-client'

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function clearIndexedDbs() {
  if (typeof indexedDB === 'undefined') return
  const idb = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>
  }
  if (typeof idb.databases !== 'function') return

  try {
    const dbs = await idb.databases()
    const names = dbs
      .map((db) => (db?.name ?? '').trim())
      .filter((name) => name.length > 0)
    await Promise.allSettled(names.map((name) => deleteIndexedDb(name)))
  } catch {
    // Ignore indexedDB cleanup failures
  }
}

async function clearCachesStorage() {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.allSettled(keys.map((key) => caches.delete(key)))
  } catch {
    // Ignore cache cleanup failures
  }
}

async function unregisterServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.allSettled(regs.map((reg) => reg.unregister()))
  } catch {
    // Ignore service worker cleanup failures
  }
}

function clearWebStorage() {
  try { localStorage.clear() } catch { /* noop */ }
  try { sessionStorage.clear() } catch { /* noop */ }
}

export async function clearPwaClientState() {
  queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  clearWebStorage()
  await Promise.allSettled([
    clearCachesStorage(),
    unregisterServiceWorkers(),
    clearIndexedDbs(),
  ])
}
