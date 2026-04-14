import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
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

async function writeLegacyAllowlistFile(input: AllowedSeller[]) {
  try {
    await mkdir(dirname(LEGACY_ALLOWLIST_FILE), { recursive: true })
    await writeFile(LEGACY_ALLOWLIST_FILE, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
  } catch {
    // Legacy file is best-effort only.
  }
}

function isProfileTypeUnsupportedError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = String((error as { message?: unknown }).message ?? '')
  return (
    message.includes('Unknown argument `profileType`') ||
    message.includes('Unknown arg `profileType`') ||
    message.toLowerCase().includes('profile_type') ||
    message.toLowerCase().includes('cannot convert undefined or null to object')
  )
}

export async function readSellerAllowlist(): Promise<AllowedSeller[]> {
  try {
    const rows: Array<{
      code: string | null
      partnerCode: string | null
      name: string
      active: boolean
      profileType?: string | null
    }> = await prisma.metasSeller.findMany({ orderBy: { name: 'asc' } })
    if (rows.length > 0) {
      const fromDb = rows.map((r: { code: string | null; partnerCode: string | null; name: string; active: boolean; profileType?: string | null }) => ({
        code: r.code,
        partnerCode: r.partnerCode,
        name: r.name,
        active: r.active,
        profileType: normalizeSellerProfileType(r.profileType),
      }))

      const legacy = normalizeList(await readLegacyAllowlistFile())
      if (legacy.length === 0) return fromDb

      // Backward compatibility and recovery path:
      // If DB profiles look degraded (all NOVATO) but legacy has richer profile data,
      // reuse legacy profile types by code/name match and self-heal DB best-effort.
      const dbHasNonNovato = fromDb.some((seller: AllowedSeller) => normalizeSellerProfileType(seller.profileType) !== 'NOVATO')
      const legacyHasNonNovato = legacy.some((seller: AllowedSeller) => normalizeSellerProfileType(seller.profileType) !== 'NOVATO')
      const shouldRecoverProfilesFromLegacy = !dbHasNonNovato && legacyHasNonNovato

      const legacyByCode = new Map<string, AllowedSeller>()
      const legacyByName = new Map<string, AllowedSeller>()
      for (const seller of legacy) {
        const codeKey = String(seller.code ?? '').trim()
        if (codeKey) legacyByCode.set(codeKey, seller)
        legacyByName.set(seller.name.trim().toUpperCase(), seller)
      }

      const merged = fromDb.map((seller: AllowedSeller) => {
        const codeKey = String(seller.code ?? '').trim()
        const nameKey = seller.name.trim().toUpperCase()
        const matched = (codeKey ? legacyByCode.get(codeKey) : undefined) ?? legacyByName.get(nameKey)
        if (!matched) return seller
        if (!shouldRecoverProfilesFromLegacy) return seller
        return { ...seller, profileType: normalizeSellerProfileType(matched.profileType) }
      })

      if (shouldRecoverProfilesFromLegacy) {
        try {
          await writeSellerAllowlist(merged)
        } catch {
          // Best-effort DB self-heal only; returning merged already fixes UI rendering.
        }
      }

      return merged
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

  const withProfileType = () =>
    prisma.$transaction([
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

  const withoutProfileType = () =>
    prisma.$transaction([
      prisma.metasSeller.deleteMany(),
      prisma.metasSeller.createMany({
        data: normalized.map((s) => ({
          code: s.code ?? null,
          partnerCode: s.partnerCode ?? null,
          name: s.name,
          active: s.active,
        })),
        skipDuplicates: true,
      }),
    ])

  try {
    await withProfileType()
    await writeLegacyAllowlistFile(normalized)
  } catch (error) {
    if (!isProfileTypeUnsupportedError(error)) throw error
    await withoutProfileType()
    await writeLegacyAllowlistFile(normalized)
  }

  return normalized
}
