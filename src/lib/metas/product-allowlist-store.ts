import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type AllowedProduct,
  METAS_ALLOWED_PRODUCTS,
  isAllowedProductBrand,
  normalizeBrand,
} from './product-allowlist'

const TARGET_DIR = join(process.cwd(), 'src', 'generated')
const TARGET_FILE = join(TARGET_DIR, 'metas-products-allowlist.json')

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
    const key = `${product.code}|${product.description.toUpperCase()}|${product.brand}|${product.unit}`
    if (!dedup.has(key)) dedup.set(key, product)
  }
  return [...dedup.values()].sort((a, b) => a.description.localeCompare(b.description))
}

export async function readProductAllowlist(): Promise<AllowedProduct[]> {
  try {
    const raw = await readFile(TARGET_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return normalizeList(METAS_ALLOWED_PRODUCTS)
    return normalizeList(parsed as AllowedProduct[])
  } catch {
    return normalizeList(METAS_ALLOWED_PRODUCTS)
  }
}

export async function writeProductAllowlist(input: AllowedProduct[]) {
  const normalized = normalizeList(input)
  await mkdir(TARGET_DIR, { recursive: true })
  await writeFile(TARGET_FILE, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}
