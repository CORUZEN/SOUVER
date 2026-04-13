import { prisma } from '@/lib/prisma'
import type { City } from './city-types'

function normalizeList(input: City[]): City[] {
  const dedup = new Map<string, City>()
  for (const item of input) {
    const name = String(item.name ?? '').trim()
    const code = String(item.code ?? '').trim()
    if (!name || !code) continue
    if (!dedup.has(code)) {
      dedup.set(code, {
        code,
        name,
        ufCode: String(item.ufCode ?? '').trim(),
        uf: String(item.uf ?? '').trim().toUpperCase(),
      })
    }
  }
  return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function readCityList(): Promise<City[]> {
  const rows = await prisma.faturamentoCity.findMany({ orderBy: { name: 'asc' } })
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    ufCode: r.ufCode,
    uf: r.uf,
  }))
}

export async function writeCityList(input: City[]): Promise<City[]> {
  const normalized = normalizeList(input)
  await prisma.$transaction([
    prisma.faturamentoCity.deleteMany(),
    prisma.faturamentoCity.createMany({
      data: normalized.map((c) => ({
        code: c.code,
        name: c.name,
        ufCode: c.ufCode,
        uf: c.uf,
      })),
      skipDuplicates: true,
    }),
  ])
  return normalized
}
