/**
 * Detecta se o aplicativo está rodando como PWA instalado (standalone).
 * Funciona tanto em Android/Chrome quanto em iOS/Safari.
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  )
}

/**
 * Redireciona após login/2FA considerando o contexto PWA.
 * Se estiver em standalone, vai para /app (que redireciona para a rota correta).
 * Caso contrário, vai para a rota web padrão.
 */
export function getPostAuthRedirect(fallbackWebPath: string): string {
  return isPwaStandalone() ? '/app' : fallbackWebPath
}
