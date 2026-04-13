import { prisma } from '@/lib/prisma'
import {
  type AllowedProduct,
  isAllowedProductBrand,
  normalizeBrand,
} from './product-allowlist'

function normalizeList(input: AllowedProduct[]): AllowedProduct[] {
  const sanitized = input
    .map((item) => ({
      code: String(item.code ?? '').trim(),
      description: String(item.description ?? '').trim(),
      brand: normalizeBrand(String(item.brand ?? '')),
      unit: String(item.unit ?? '').trim().toUpperCase(),
      mobility: (String(item.mobility ?? 'NAO').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NAO') as 'SIM' | 'NAO',
      active: Boolean(item.active),
    }))
    .filter((item) => item.code.length > 0 && item.description.length > 0 && item.unit.length > 0)
    .filter((item) => item.mobility === 'SIM')
    .filter((item) => isAllowedProductBrand(item.brand))

  const dedup = new Map<string, AllowedProduct>()
  for (const product of sanitized) {
    const key = product.code
    if (!dedup.has(key)) dedup.set(key, product)
  }
  return [...dedup.values()].sort((a, b) => a.description.localeCompare(b.description))
}

export async function readProductAllowlist(): Promise<AllowedProduct[]> {
  const rows = await prisma.metasProduct.findMany({ orderBy: { description: 'asc' } })
  return rows.map((r) => ({
    code: r.code,
    description: r.description,
    brand: r.brand,
    unit: r.unit,
    mobility: (r.mobility === 'SIM' ? 'SIM' : 'NAO') as 'SIM' | 'NAO',
    active: r.active,
  }))
}

export async function writeProductAllowlist(input: AllowedProduct[]) {
  const normalized = normalizeList(input)
  await prisma.$transaction([
    prisma.metasProduct.deleteMany(),
    prisma.metasProduct.createMany({
      data: normalized.map((p) => ({
        code: p.code,
        description: p.description,
        brand: p.brand,
        unit: p.unit,
        mobility: p.mobility,
        active: p.active,
      })),
      skipDuplicates: true,
    }),
  ])
  return normalized
}
