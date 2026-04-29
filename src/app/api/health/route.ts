import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health
 *
 * Health check minimalista — expõe apenas status básico.
 * Dados sensíveis (memória, uptime, versão, environment) foram removidos
 * para prevenir information disclosure.
 */
export async function GET() {
  let dbHealthy = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbHealthy = true
  } catch {
    dbHealthy = false
  }

  const overallStatus = dbHealthy ? 'healthy' : 'degraded'

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
    },
    {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
