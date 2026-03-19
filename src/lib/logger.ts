/**
 * Logger estruturado — Monitoramento e observabilidade
 *
 * Níveis: debug, info, warn, error
 * Saída: JSON estruturado para fácil consumo por Vercel Logs, Datadog, etc.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:     LogLevel
  message:   string
  module?:   string
  userId?:   string
  traceId?:  string
  duration?: number
  meta?:     Record<string, unknown>
  timestamp: string
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[MIN_LEVEL]
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function log(level: LogLevel, message: string, context?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  const output = formatEntry(entry)

  switch (level) {
    case 'debug': console.debug(output); break
    case 'info':  console.info(output);  break
    case 'warn':  console.warn(output);  break
    case 'error': console.error(output); break
  }
}

/** Logger principal do sistema */
export const logger = {
  debug: (msg: string, ctx?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) => log('info',  msg, ctx),
  warn:  (msg: string, ctx?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) => log('warn',  msg, ctx),
  error: (msg: string, ctx?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) => log('error', msg, ctx),
}

/** Mede duração de uma operação assíncrona */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  context?: { module?: string; userId?: string }
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = Math.round(performance.now() - start)
    logger.info(`${label} completed`, { ...context, duration })
    return result
  } catch (err) {
    const duration = Math.round(performance.now() - start)
    logger.error(`${label} failed`, {
      ...context,
      duration,
      meta: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}

/** Gera um ID de trace para rastrear requests */
export function generateTraceId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
