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
      supervisorCode: item.supervisorCode == null ? null : String(item.supervisorCode).trim() || null,
      supervisorName: item.supervisorName == null ? null : String(item.supervisorName).trim() || null,
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

function isSupervisionFieldUnsupportedError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = String((error as { message?: unknown }).message ?? '')
  return (
    message.includes('Unknown argument `supervisorCode`') ||
    message.includes('Unknown arg `supervisorCode`') ||
    message.includes('Unknown argument `supervisorName`') ||
    message.includes('Unknown arg `supervisorName`') ||
    message.toLowerCase().includes('supervisor_code') ||
    message.toLowerCase().includes('supervisor_name')
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
      supervisorCode?: string | null
      supervisorName?: string | null
    }> = await prisma.metasSeller.findMany({ orderBy: { name: 'asc' } })
    if (rows.length > 0) {
      const fromDb = rows.map((r: { code: string | null; partnerCode: string | null; name: string; active: boolean; profileType?: string | null; supervisorCode?: string | null; supervisorName?: string | null }) => ({
        code: r.code,
        partnerCode: r.partnerCode,
        name: r.name,
        active: r.active,
        profileType: normalizeSellerProfileType(r.profileType),
        supervisorCode: r.supervisorCode == null ? null : String(r.supervisorCode),
        supervisorName: r.supervisorName == null ? null : String(r.supervisorName),
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
        return {
          ...seller,
          profileType: shouldRecoverProfilesFromLegacy ? normalizeSellerProfileType(matched.profileType) : normalizeSellerProfileType(seller.profileType),
          supervisorCode: seller.supervisorCode ?? matched.supervisorCode ?? null,
          supervisorName: seller.supervisorName ?? matched.supervisorName ?? null,
        }
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

  const withProfileAndSupervision = () =>
    prisma.$transaction([
      prisma.metasSeller.deleteMany(),
      prisma.metasSeller.createMany({
        data: normalized.map((s) => ({
          code: s.code ?? null,
          partnerCode: s.partnerCode ?? null,
          name: s.name,
          active: s.active,
          profileType: normalizeSellerProfileType(s.profileType),
          supervisorCode: s.supervisorCode ?? null,
          supervisorName: s.supervisorName ?? null,
        })),
        skipDuplicates: true,
      }),
    ])

  const withProfileWithoutSupervision = () =>
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

  const withoutProfileAndSupervision = () =>
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
    await withProfileAndSupervision()
    await writeLegacyAllowlistFile(normalized)
  } catch (error) {
    if (isSupervisionFieldUnsupportedError(error)) {
      try {
        await withProfileWithoutSupervision()
        await writeLegacyAllowlistFile(normalized)
        return normalized
      } catch (fallbackError) {
        if (!isProfileTypeUnsupportedError(fallbackError)) throw fallbackError
        await withoutProfileAndSupervision()
        await writeLegacyAllowlistFile(normalized)
        return normalized
      }
    }

    if (!isProfileTypeUnsupportedError(error)) throw error
    await withoutProfileAndSupervision()
    await writeLegacyAllowlistFile(normalized)
  }

  return normalized
}
