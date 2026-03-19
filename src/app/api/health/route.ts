import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jobQueue } from '@/lib/jobs'

const startTime = Date.now()

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // ── Banco de dados ─────────────────────────────────────────
  const dbStart = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'healthy', latency: Math.round(performance.now() - dbStart) }
  } catch (err) {
    checks.database = {
      status: 'unhealthy',
      latency: Math.round(performance.now() - dbStart),
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }

  // ── Job Queue ──────────────────────────────────────────────
  const jobStats = jobQueue.stats()
  checks.jobQueue = {
    status: jobStats.failed > 10 ? 'degraded' : 'healthy',
    ...jobStats as unknown as Record<string, never>,
  }

  // ── Memória ────────────────────────────────────────────────
  const mem = process.memoryUsage()
  const memoryMB = {
    rss:      Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  }

  // ── Status global ──────────────────────────────────────────
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')
  const overallStatus = allHealthy ? 'healthy' : 'degraded'

  return NextResponse.json(
    {
      status:      overallStatus,
      system:      'Sistema Ouro Verde',
      version:     '1.0.0',
      timestamp:   new Date().toISOString(),
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      uptime:      Math.round((Date.now() - startTime) / 1000),
      memory:      memoryMB,
      checks,
    },
    {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
