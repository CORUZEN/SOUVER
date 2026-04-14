import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'
import { METAS_ALLOWED_SELLERS, normalizeSellerProfileType, type AllowedSeller } from './seller-allowlist'

const LEGACY_ALLOWLIST_FILE = join(process.cwd(), 'src', 'generated', 'metas-sellers-allowlist.json')

function normalizeList(input: AllowedSeller[]): AllowedSeller[] {
  const sanitized = input
    .map((item) => ({
      code: item.code == null ? null : String(item.code).trim() || null,
      partnerCode: item.partnerCode == null ? null : String(item.partnerCode).trim() || null,
      name: String(item.name ?? '').trim(),
      active: Boolean(item.active),
      profileType: normalizeSellerProfileType(item.profileType),
    }))
    .filter((item) => item.name.length > 0)

  const dedup = new Map<string, AllowedSeller>()
  for (const seller of sanitized) {
    const key = seller.name.toUpperCase()
    if (!dedup.has(key)) dedup.set(key, seller)
  }
  return [...dedup.values()]
}

async function readLegacyAllowlistFile(): Promise<AllowedSeller[]> {
  try {
    const raw = await readFile(LEGACY_ALLOWLIST_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as AllowedSeller[]
  } catch {
    return []
  }
}

export async function readSellerAllowlist(): Promise<AllowedSeller[]> {
  try {
    const rows = await prisma.metasSeller.findMany({ orderBy: { name: 'asc' } })
    if (rows.length > 0) {
      return rows.map((r: { code: string | null; partnerCode: string | null; name: string; active: boolean; profileType: string | null }) => ({
        code: r.code,
        partnerCode: r.partnerCode,
        name: r.name,
        active: r.active,
        profileType: normalizeSellerProfileType(r.profileType),
      }))
    }
  } catch {
    // Fallback below keeps local usage resilient when DB is unavailable.
  }

  const legacy = await readLegacyAllowlistFile()
  const normalizedFallback = normalizeList(legacy.length > 0 ? legacy : METAS_ALLOWED_SELLERS)
  if (normalizedFallback.length === 0) return []

  try {
    await writeSellerAllowlist(normalizedFallback)
  } catch {
    // Return fallback list even if DB seeding fails.
  }

  return normalizedFallback
}

export async function writeSellerAllowlist(input: AllowedSeller[]) {
  const normalized = normalizeList(input)
  await prisma.$transaction([
    prisma.metasSeller.deleteMany(),
    prisma.metasSeller.createMany({
      data: normalized.map((s) => ({
        code: s.code ?? null,
        partnerCode: s.partnerCode ?? null,
        name: s.name,
        active: s.active,
        profileType: normalizeSellerProfileType(s.profileType),
      })),
      skipDuplicates: true,
    }),
  ])
  return normalized
}
