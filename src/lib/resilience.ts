/**
 * Utilitários de resiliência para chamadas externas (integrações, APIs corporativas).
 */

// ─── Sleep ────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Retry com backoff exponencial ────────────────────────────────────────────

export interface RetryOptions {
  /** Número máximo de tentativas (padrão: 3) */
  maxAttempts?: number
  /** Delay inicial em ms (padrão: 500) */
  initialDelayMs?: number
  /** Fator multiplicador do delay a cada tentativa (padrão: 2) */
  backoffFactor?: number
  /** Delay máximo em ms (padrão: 10_000) */
  maxDelayMs?: number
  /** Callback chamado em cada falha antes de nova tentativa */
  onRetry?: (attempt: number, error: unknown) => void
  /** Se retornar true para o erro, não reenvia (ex: 4xx client errors) */
  shouldAbort?: (error: unknown) => boolean
}

/**
 * Executa `fn` com retries exponenciais.
 * Lança o último erro se todas as tentativas falharem.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts    = 3,
    initialDelayMs = 500,
    backoffFactor  = 2,
    maxDelayMs     = 10_000,
    onRetry,
    shouldAbort,
  } = options

  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts || shouldAbort?.(err)) throw err

      onRetry?.(attempt, err)
      await sleep(Math.min(delay, maxDelayMs))
      delay = Math.round(delay * backoffFactor)
    }
  }

  // unreachable — typescript wants it
  throw new Error('withRetry: unreachable')
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Falhas consecutivas para abrir o circuito (padrão: 5) */
  failureThreshold?: number
  /** Tempo em ms até tentar novamente após OPEN (padrão: 30_000) */
  recoveryTimeMs?: number
  /** Callback ao mudar de estado */
  onStateChange?: (prev: CircuitState, next: CircuitState, name: string) => void
}

export class CircuitBreaker {
  private state:        CircuitState = 'CLOSED'
  private failures:     number       = 0
  private lastFailedAt: number       = 0

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = {},
  ) {}

  get currentState(): CircuitState { return this.state }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const { failureThreshold = 5, recoveryTimeMs = 30_000 } = this.options

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailedAt
      if (elapsed < recoveryTimeMs) {
        throw new CircuitOpenError(this.name, recoveryTimeMs - elapsed)
      }
      this.transition('HALF_OPEN')
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(failureThreshold)
      throw err
    }
  }

  private onSuccess() {
    if (this.state !== 'CLOSED') this.transition('CLOSED')
    this.failures = 0
  }

  private onFailure(threshold: number) {
    this.failures++
    this.lastFailedAt = Date.now()
    if (this.state === 'HALF_OPEN' || this.failures >= threshold) {
      this.transition('OPEN')
    }
  }

  private transition(next: CircuitState) {
    const prev = this.state
    this.state = next
    this.options.onStateChange?.(prev, next, this.name)
  }

  /** Força o reset manual para CLOSED (uso administrativo) */
  reset() {
    this.failures = 0
    this.transition('CLOSED')
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Circuit "${circuitName}" is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`)
    this.name = 'CircuitOpenError'
  }
}

// ─── Wrapper combinado: retry dentro de circuit breaker ───────────────────────

/**
 * Combina Circuit Breaker + Retry.
 * O circuit breaker envolve as chamadas com retry — uma falha persistente
 * (após todos os retries) conta como 1 falha no circuito.
 */
export async function withResiliency<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
): Promise<T> {
  return breaker.execute(() => withRetry(fn, retryOptions))
}

// ─── Instâncias globais para integrações conhecidas ──────────────────────────

export const sankhyaCircuit = new CircuitBreaker('sankhya', {
  failureThreshold: 3,
  recoveryTimeMs:   60_000, // 1 minuto
  onStateChange: (prev, next, name) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CircuitBreaker] ${name}: ${prev} → ${next}`)
    }
  },
})
