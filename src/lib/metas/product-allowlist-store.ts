import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'
import {
  type AllowedProduct,
  METAS_ALLOWED_PRODUCTS,
  isAllowedProductBrand,
  normalizeBrand,
} from './product-allowlist'

const LEGACY_ALLOWLIST_FILE = join(process.cwd(), 'src', 'generated', 'metas-products-allowlist.json')

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

async function readLegacyAllowlistFile(): Promise<AllowedProduct[]> {
  try {
    const raw = await readFile(LEGACY_ALLOWLIST_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as AllowedProduct[]
  } catch {
    return []
  }
}

export async function readProductAllowlist(): Promise<AllowedProduct[]> {
  try {
    const rows = await prisma.metasProduct.findMany({ orderBy: { description: 'asc' } })
    if (rows.length > 0) {
      return rows.map((r: { code: string; description: string; brand: string; unit: string; mobility: string; active: boolean }) => ({
        code: r.code,
        description: r.description,
        brand: r.brand,
        unit: r.unit,
        mobility: (r.mobility === 'SIM' ? 'SIM' : 'NAO') as 'SIM' | 'NAO',
        active: r.active,
      }))
    }
  } catch {
    // Fallback below keeps local usage resilient when DB is unavailable.
  }

  const legacy = await readLegacyAllowlistFile()
  const normalizedFallback = normalizeList(legacy.length > 0 ? legacy : METAS_ALLOWED_PRODUCTS)
  if (normalizedFallback.length === 0) return []

  try {
    await writeProductAllowlist(normalizedFallback)
  } catch {
    // Return fallback list even if DB seeding fails.
  }

  return normalizedFallback
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
