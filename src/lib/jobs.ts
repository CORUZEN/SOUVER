/**
 * Job Queue — Processamento assíncrono em segundo plano
 *
 * Implementação in-process baseada em fila FIFO com concorrência controlada.
 * Adequado para Vercel serverless: jobs são processados dentro da mesma request
 * ou disparados fire-and-forget para tarefas que podem ser perdidas se o
 * processo morrer (não-críticas: notificações, logs, etc.)
 *
 * Para tarefas críticas de longa duração, usa-se o padrão de "Vercel Cron"
 * com polling de uma tabela de jobs no banco.
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job<T = unknown> {
  id:        string
  type:      string
  payload:   T
  status:    JobStatus
  createdAt: Date
  startedAt?: Date
  finishedAt?: Date
  error?:    string
  attempts:  number
  maxAttempts: number
}

type JobHandler<T = unknown> = (payload: T) => Promise<void>

let jobCounter = 0

class JobQueue {
  private queue: Job[] = []
  private handlers = new Map<string, JobHandler>()
  private processing = false
  private concurrency: number

  constructor(concurrency = 3) {
    this.concurrency = concurrency
  }

  /** Registra um handler para um tipo de job */
  register<T = unknown>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler)
  }

  /** Enfileira um novo job */
  enqueue<T = unknown>(type: string, payload: T, options?: { maxAttempts?: number }): string {
    const id = `job_${Date.now()}_${++jobCounter}`
    const job: Job<T> = {
      id,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
    }
    this.queue.push(job as Job)
    this.processNext()
    return id
  }

  /** Processa a fila respeitando a concorrência */
  private processNext(): void {
    if (this.processing) return
    this.processing = true

    const runningCount = this.queue.filter((j) => j.status === 'running').length
    const available = this.concurrency - runningCount
    const pending = this.queue.filter((j) => j.status === 'pending').slice(0, available)

    for (const job of pending) {
      this.executeJob(job)
    }

    this.processing = false
  }

  private async executeJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      job.status = 'failed'
      job.error = `No handler registered for job type: ${job.type}`
      return
    }

    job.status = 'running'
    job.startedAt = new Date()
    job.attempts++

    try {
      await handler(job.payload)
      job.status = 'completed'
      job.finishedAt = new Date()
    } catch (err) {
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending'
        // Retry com delay exponencial
        const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30_000)
        setTimeout(() => this.processNext(), delay)
      } else {
        job.status = 'failed'
        job.error = err instanceof Error ? err.message : String(err)
        job.finishedAt = new Date()
      }
      console.error(`[JobQueue] Job ${job.id} (${job.type}) failed attempt ${job.attempts}:`, err)
    }

    // Limpa jobs completados antigos (mantém últimos 100)
    const completed = this.queue.filter((j) => j.status === 'completed' || j.status === 'failed')
    if (completed.length > 100) {
      const toRemove = completed.slice(0, completed.length - 100)
      this.queue = this.queue.filter((j) => !toRemove.includes(j))
    }

    this.processNext()
  }

  /** Retorna status da fila */
  stats(): { pending: number; running: number; completed: number; failed: number; total: number } {
    const pending   = this.queue.filter((j) => j.status === 'pending').length
    const running   = this.queue.filter((j) => j.status === 'running').length
    const completed = this.queue.filter((j) => j.status === 'completed').length
    const failed    = this.queue.filter((j) => j.status === 'failed').length
    return { pending, running, completed, failed, total: this.queue.length }
  }

  /** Lista jobs recentes */
  recent(limit = 20): Job[] {
    return this.queue.slice(-limit).reverse()
  }
}

/** Instância singleton da job queue */
export const jobQueue = new JobQueue(3)

// ─── Tipos de jobs do sistema ────────────────────────────────────

export const JOB_TYPES = {
  EXPORT_REPORT:        'export:report',
  GENERATE_PDF:         'generate:pdf',
  BULK_NOTIFICATION:    'notification:bulk',
  INTEGRATION_SYNC:     'integration:sync',
  CLEANUP:              'system:cleanup',
  AUDIT_ARCHIVE:        'audit:archive',
} as const
