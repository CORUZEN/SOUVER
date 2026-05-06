import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/dashboard/trend
 *
 * Retorna dados de tendÃªncia dos Ãºltimos N dias para o dashboard.
 * Resposta: { days: [{ date, batches, movements, ncs }] }
 *
 * Query params:
 *   days  number  â€” quantos dias atrÃ¡s (padrÃ£o: 7, mÃ¡x: 30)
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'painel-executivo')
  if (denied) return denied

  const days = Math.min(30, Math.max(2, Number(req.nextUrl.searchParams.get('days') ?? 7)))
  const now  = new Date()

  // Gera array de datas dos Ãºltimos N dias (hoje incluÃ­do)
  const dates: Date[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    dates.push(d)
  }

  const since = dates[0]

  // AgregaÃ§Ã£o direta no banco via GROUP BY (evita transferir milhares de linhas)
  type DayCount = { day: Date; count: bigint }

  const [batchRows, movementRows, ncRows] = await Promise.all([
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
      FROM production_batches
      WHERE created_at >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', moved_at) AS day, COUNT(*)::bigint AS count
      FROM inventory_movements
      WHERE moved_at >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', opened_at) AS day, COUNT(*)::bigint AS count
      FROM non_conformances
      WHERE opened_at >= ${since}
      GROUP BY 1`,
  ])

  function toMap(rows: DayCount[]): Map<string, number> {
    const m = new Map<string, number>()
    for (const r of rows) m.set(new Date(r.day).toDateString(), Number(r.count))
    return m
  }

  const bMap = toMap(batchRows)
  const mMap = toMap(movementRows)
  const nMap = toMap(ncRows)

  const result = dates.map(d => ({
    date:       d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    batches:    bMap.get(d.toDateString()) ?? 0,
    movements:  mMap.get(d.toDateString()) ?? 0,
    ncs:        nMap.get(d.toDateString()) ?? 0,
  }))

  return NextResponse.json(
    { days: result },
    {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=60',
      },
    },
  )
}

