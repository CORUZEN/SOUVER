import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/dashboard/trend
 *
 * Retorna dados de tendência dos últimos N dias para o dashboard.
 * Resposta: { days: [{ date, batches, movements, ncs }] }
 *
 * Query params:
 *   days  number  — quantos dias atrás (padrão: 7, máx: 30)
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const days = Math.min(30, Math.max(2, Number(req.nextUrl.searchParams.get('days') ?? 7)))
  const now  = new Date()

  // Gera array de datas dos últimos N dias (hoje incluído)
  const dates: Date[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    dates.push(d)
  }

  const since = dates[0]

  // Fetch paralelo — lotes criados, movimentações e NCs por dia
  const [batches, movements, ncs] = await Promise.all([
    prisma.productionBatch.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { movedAt: { gte: since } },
      select: { movedAt: true },
    }),
    prisma.nonConformance.findMany({
      where: { openedAt: { gte: since } },
      select: { openedAt: true },
    }),
  ])

  function dayKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function bucketize<T extends { [k: string]: Date }>(
    records: T[],
    dateField: keyof T,
  ): Record<string, number> {
    const m: Record<string, number> = {}
    for (const r of records) {
      const k = dayKey(r[dateField] as Date)
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }

  const bMap = bucketize(batches.map(b => ({ d: new Date(b.createdAt) })), 'd')
  const mMap = bucketize(movements.map(m => ({ d: new Date(m.movedAt) })), 'd')
  const nMap = bucketize(ncs.map(n => ({ d: new Date(n.openedAt) })), 'd')

  const result = dates.map(d => {
    const k = dayKey(d)
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return {
      date:       label,
      batches:    bMap[k] ?? 0,
      movements:  mMap[k] ?? 0,
      ncs:        nMap[k] ?? 0,
    }
  })

  return NextResponse.json(
    { days: result },
    {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=60',
      },
    },
  )
}
