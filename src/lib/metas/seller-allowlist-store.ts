import { prisma } from '@/lib/prisma'
import type { AllowedSeller } from './seller-allowlist'

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
    const key = seller.name.toUpperCase()
    if (!dedup.has(key)) dedup.set(key, seller)
  }
  return [...dedup.values()]
}

export async function readSellerAllowlist(): Promise<AllowedSeller[]> {
  const rows = await prisma.metasSeller.findMany({ orderBy: { name: 'asc' } })
  return rows.map((r) => ({
    code: r.code,
    partnerCode: r.partnerCode,
    name: r.name,
    active: r.active,
  }))
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
      })),
      skipDuplicates: true,
    }),
  ])
  return normalized
}

