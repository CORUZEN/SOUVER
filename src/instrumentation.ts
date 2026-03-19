/**
 * Next.js Instrumentation — executado uma vez no boot do servidor.
 * Registra os handlers de eventos de domínio e jobs em segundo plano.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Importação dinâmica para garantir que só roda no servidor Node.js
    await import('./lib/event-handlers')
  }
}
