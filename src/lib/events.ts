/**
 * Event Bus — Sistema de eventos de domínio
 *
 * Implementação in-process com suporte a handlers assíncronos.
 * Adequado para Vercel serverless (sem dependência de Redis/Bull).
 *
 * Uso:
 *   eventBus.emit('production:batch.finished', { batchId })
 *   eventBus.on('production:batch.finished', async (payload) => { ... })
 */

type EventHandler<T = unknown> = (payload: T) => void | Promise<void>

class EventBus {
  private handlers = new Map<string, EventHandler[]>()

  /** Registra um handler para um evento */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    const list = this.handlers.get(event) ?? []
    list.push(handler as EventHandler)
    this.handlers.set(event, list)

    // Retorna função de unsubscribe
    return () => {
      const current = this.handlers.get(event)
      if (current) {
        this.handlers.set(event, current.filter((h) => h !== handler))
      }
    }
  }

  /** Emite um evento — todos os handlers são executados em paralelo (fire-and-forget) */
  emit<T = unknown>(event: string, payload: T): void {
    const list = this.handlers.get(event)
    if (!list?.length) return

    for (const handler of list) {
      // Fire-and-forget: não bloqueia o caller
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => {
          console.error(`[EventBus] Error in handler for "${event}":`, err)
        })
    }
  }

  /** Emite e aguarda todos os handlers completarem */
  async emitAsync<T = unknown>(event: string, payload: T): Promise<void> {
    const list = this.handlers.get(event)
    if (!list?.length) return

    const results = await Promise.allSettled(
      list.map((handler) => Promise.resolve().then(() => handler(payload)))
    )

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error(`[EventBus] Handler error for "${event}":`, r.reason)
      }
    }
  }

  /** Remove todos os handlers de um evento */
  off(event: string): void {
    this.handlers.delete(event)
  }

  /** Lista todos os eventos registrados */
  events(): string[] {
    return Array.from(this.handlers.keys())
  }
}

/** Instância singleton do event bus */
export const eventBus = new EventBus()

// ─── Tipos de eventos do domínio ─────────────────────────────────

export interface DomainEvents {
  // Produção
  'production:batch.created':    { batchId: string; userId: string }
  'production:batch.finished':   { batchId: string; userId: string }
  'production:batch.cancelled':  { batchId: string; userId: string }
  'production:event.created':    { eventId: string; batchId: string; userId: string }

  // Logística
  'inventory:item.created':      { itemId: string; userId: string }
  'inventory:item.low_stock':    { itemId: string; currentQty: number; minQty: number }
  'inventory:movement.created':  { movementId: string; itemId: string; type: string; userId: string }

  // Qualidade
  'quality:record.created':      { recordId: string; userId: string; result: string }
  'quality:nc.opened':           { ncId: string; severity: string; userId: string }
  'quality:nc.resolved':         { ncId: string; userId: string }

  // Auth
  'auth:login.success':          { userId: string; ip?: string }
  'auth:login.failed':           { login: string; ip?: string }
  'auth:user.created':           { userId: string; createdBy: string }

  // Sistema
  'system:cleanup.completed':    { totalDeleted: number }
  'system:report.generated':     { reportType: string }
  'system:integration.synced':   { integrationId: string; status: string }
}

/** Helper tipado para emitir eventos */
export function emitDomainEvent<K extends keyof DomainEvents>(
  event: K,
  payload: DomainEvents[K]
): void {
  eventBus.emit(event, payload)
}
