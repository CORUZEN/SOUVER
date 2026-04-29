/**
 * Wrapper de fetch que tenta renovar a sessão automaticamente
 * quando recebe HTTP 401 (access token expirado).
 *
 * Fluxo:
 * 1. Faz a requisição normal
 * 2. Se receber 401, chama /api/auth/refresh (envia cookie httpOnly automaticamente)
 * 3. Se refresh der 200, repete a requisição original
 * 4. Se refresh der 401, limpa cache de auth e redireciona para login
 */

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' })
    .then((res) => {
      if (res.ok) return true
      // Refresh falhou — sessão realmente expirou
      window.location.href = '/login'
      return false
    })
    .catch(() => {
      window.location.href = '/login'
      return false
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })

  return refreshPromise
}

/**
 * Fetch wrapper com refresh automático de sessão.
 * Recomendado para todas as requisições autenticadas no client-side.
 */
export async function fetchWithRefresh(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status !== 401) {
    return response
  }

  // Tenta renovar a sessão
  const refreshed = await tryRefresh()

  if (refreshed) {
    // Repete a requisição original com o novo access token
    return fetch(input, init)
  }

  return response
}
