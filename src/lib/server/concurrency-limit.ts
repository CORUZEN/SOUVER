type QueueEntry = {
  resolve: () => void
}

type LimiterState = {
  active: number
  queue: QueueEntry[]
}

const limiters = new Map<string, LimiterState>()

function getLimiterState(key: string): LimiterState {
  const existing = limiters.get(key)
  if (existing) return existing
  const created: LimiterState = { active: 0, queue: [] }
  limiters.set(key, created)
  return created
}

async function acquire(poolKey: string, state: LimiterState, maxConcurrent: number): Promise<void> {
  if (state.active < maxConcurrent) {
    state.active += 1
    return
  }
  const queuedAt = Date.now()
  await new Promise<void>((resolve) => {
    state.queue.push({ resolve })
  })
  state.active += 1
}

function release(state: LimiterState) {
  state.active = Math.max(0, state.active - 1)
  const next = state.queue.shift()
  if (next) next.resolve()
}

export async function withConcurrencyLimit<T>(
  key: string,
  maxConcurrent: number,
  task: () => Promise<T>,
): Promise<T> {
  const safeMax = Number.isFinite(maxConcurrent) ? Math.max(1, Math.floor(maxConcurrent)) : 1
  const state = getLimiterState(key)
  await acquire(key, state, safeMax)
  try {
    return await task()
  } finally {
    release(state)
  }
}
