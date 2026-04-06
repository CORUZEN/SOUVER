import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AllowedSeller } from './seller-allowlist'
import { METAS_ALLOWED_SELLERS } from './seller-allowlist'

const TARGET_DIR = join(process.cwd(), 'src', 'generated')
const TARGET_FILE = join(TARGET_DIR, 'metas-sellers-allowlist.json')

function normalizeList(input: AllowedSeller[]): AllowedSeller[] {
  const sanitized = input
    .map((item) => ({
      code: item.code == null ? null : String(item.code).trim() || null,
      partnerCode: item.partnerCode == null ? null : String(item.partnerCode).trim() || null,
      name: String(item.name ?? '').trim(),
      active: Boolean(item.active),
    }))
    .filter((item) => item.name.length > 0)

  const dedup = new Map<string, AllowedSeller>()
  for (const seller of sanitized) {
    const key = `${seller.code ?? ''}|${seller.partnerCode ?? ''}|${seller.name.toUpperCase()}`
    if (!dedup.has(key)) dedup.set(key, seller)
  }
  return [...dedup.values()]
}

export async function readSellerAllowlist(): Promise<AllowedSeller[]> {
  try {
    const raw = await readFile(TARGET_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return normalizeList(METAS_ALLOWED_SELLERS)
    return normalizeList(parsed as AllowedSeller[])
  } catch {
    return normalizeList(METAS_ALLOWED_SELLERS)
  }
}

export async function writeSellerAllowlist(input: AllowedSeller[]) {
  const normalized = normalizeList(input)
  await mkdir(TARGET_DIR, { recursive: true })
  await writeFile(TARGET_FILE, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

