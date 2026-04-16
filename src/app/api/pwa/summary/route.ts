import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { readSellerAllowlist } from '@/lib/metas/seller-allowlist-store'
import { getActiveAllowedSellersFromList } from '@/lib/metas/seller-allowlist'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}

/**
 * GET /api/pwa/summary?year=YYYY&month=M
 *
 * Lightweight aggregated summary for the PWA mobile view.
 * Reads from existing sellers-performance and metas/config data already cached/computed.
 * Does NOT call Sankhya directly — relies on the same data the desktop dashboard uses,
 * delivered as a compact payload optimized for mobile rendering.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401, headers: NO_CACHE })
  }

  const roleCode = user.role?.code?.toUpperCase() ?? ''
  const ALLOWED_ROLES = new Set([
    'DEVELOPER',
    'COMMERCIAL_MANAGER',
    'DIRECTORATE',
    'COMMERCIAL_SUPERVISOR',
    'SALES_SUPERVISOR',
    'SELLER',
  ])
  if (!ALLOWED_ROLES.has(roleCode)) {
    return NextResponse.json({ message: 'Sem acesso a este recurso.' }, { status: 403, headers: NO_CACHE })
  }

  const now = new Date()
  const yearRaw = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = Number(req.nextUrl.searchParams.get('month'))
  const year = Number.isFinite(yearRaw) && yearRaw >= 2020 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1

  // ── Load config ────────────────────────────────────────────────────────────
  const configRow = await prisma.metasConfig.findUnique({ where: { scopeKey: '1' } })
  const metaConfigs = (configRow?.metaConfigs as Record<string, unknown> | null) ?? {}
  const monthConfigs = (configRow?.monthConfigs as Record<string, unknown> | null) ?? {}

  // ── Active key ────────────────────────────────────────────────────────────
  const activeKey = `${year}-${String(month).padStart(2, '0')}`
  const metaConfig = (metaConfigs[activeKey] as Record<string, unknown> | null) ?? null
  const monthConfig = (monthConfigs[activeKey] as Record<string, unknown> | null) ?? null

  // ── Allowlist — scoped to supervisor if needed ─────────────────────────────
  const isSupervisor = roleCode === 'SALES_SUPERVISOR'
  const supervisorCode = isSupervisor ? (user.sellerCode ?? null) : null
  const allowlist = await readSellerAllowlist()
  const activeSellers = getActiveAllowedSellersFromList(allowlist)
  const scopedSellers = supervisorCode
    ? activeSellers.filter((s) => String(s.supervisorCode ?? '').trim() === supervisorCode)
    : activeSellers

  // ── Infer KPI type from label (mirrors MetasWorkspace.inferKpiType) ──────
  function inferKpiType(kpi: string): string {
    const lower = (kpi ?? '').toLowerCase()
    if (lower.includes('base de clientes')) return 'BASE_CLIENTES'
    if (lower.includes('volume') || lower.includes('categori')) return 'VOLUME'
    if (lower.includes('meta financeira')) return 'META_FINANCEIRA'
    if (lower.includes('distribui')) return 'DISTRIBUICAO'
    if (lower.includes('devolu')) return 'DEVOLUCAO'
    if (lower.includes('inadimpl')) return 'INADIMPLENCIA'
    if (lower.includes('foco') || lower.includes('item')) return 'ITEM_FOCO'
    if (lower.includes('rentabilidade') || lower.includes('ticket')) return 'RENTABILIDADE'
    return 'VOLUME'
  }

  // ── Extract rule blocks for targets ───────────────────────────────────────
  type RuleBlock = {
    id: string
    name?: string
    monthlyTarget?: number
    profileType?: string
    sellerIds?: string[]
    weightTargets?: Array<{ brand: string; targetKg: number }>
    focusProductCode?: string
    focusTargetKg?: number
    focusTargetMode?: 'KG' | 'BASE_CLIENTS'
    focusTargetBasePct?: number
    rules?: Array<{ id: string; kpi: string; kpiType?: string; points: number; rewardValue: number; stage: string; targetText: string }>
  }

  const ruleBlocks: RuleBlock[] = (() => {
    if (!metaConfig || typeof metaConfig !== 'object') return []
    const rb = (metaConfig as Record<string, unknown>).ruleBlocks
    if (!Array.isArray(rb)) return []
    return rb as RuleBlock[]
  })()

  // ── Sellers with their codes ───────────────────────────────────────────────
  const sellerSummaries = scopedSellers.map((seller) => {
    const code = String(seller.code ?? '').trim()
    // Find the block that covers this seller
    const block = ruleBlocks.find((b) => {
      if (!b.sellerIds || b.sellerIds.length === 0) return false
      return b.sellerIds.includes(code) || b.sellerIds.includes(`sankhya-${code}`)
    }) ?? ruleBlocks[0] ?? null

    const profileType = seller.profileType as string
    void profileType // profileType stored per seller, used by PWA for display formatting
    const maxReward: number = (block?.rules ?? []).reduce((sum: number, r: { rewardValue?: number }) => sum + (r.rewardValue ?? 0), 0)

    return {
      code,
      name: seller.name,
      profileType: seller.profileType,
      supervisorCode: seller.supervisorCode ?? null,
      supervisorName: seller.supervisorName ?? null,
      monthlyTarget: block?.monthlyTarget ?? 0,
      blockId: block?.id ?? null,
      blockName: block?.name ?? null,
      focusProductCode: String(block?.focusProductCode ?? '').trim(),
      focusTargetKg: Number(block?.focusTargetKg ?? 0),
      focusTargetMode: block?.focusTargetMode === 'BASE_CLIENTS' ? 'BASE_CLIENTS' : 'KG',
      focusTargetBasePct: Number(block?.focusTargetBasePct ?? 0),
      maxReward,
      weightTargets: (block?.weightTargets ?? []).map((wt: { brand?: unknown; targetKg?: unknown }) => ({
        brand: String(wt.brand ?? '').toUpperCase(),
        targetKg: Number(wt.targetKg ?? 0),
      })).filter((wt) => wt.brand && wt.targetKg > 0),
      rules: (block?.rules ?? []).map((r) => ({
        id: r.id,
        stage: r.stage,
        kpi: r.kpi ?? '',
        kpiType: r.kpiType || inferKpiType(r.kpi ?? ''),
        targetText: r.targetText,
        rewardValue: r.rewardValue,
        points: r.points,
      })),
    }
  })

  // ── Cycle week dates (W1–CLOSING) ──────────────────────────────────────────
  const cycleWeeks = (() => {
    if (!monthConfig) return null
    const mc = monthConfig as Record<string, unknown>

    // Prefer explicit weekPeriods saved by MetasWorkspace (same source as the web system)
    const weekPeriodsRaw = mc.weekPeriods
    if (weekPeriodsRaw && typeof weekPeriodsRaw === 'object' && !Array.isArray(weekPeriodsRaw)) {
      const wp = weekPeriodsRaw as Record<string, { start?: string; end?: string }>
      const stages = ['W1', 'W2', 'W3', 'CLOSING'] as const
      const result: { key: string; start: string; end: string }[] = []
      for (const key of stages) {
        const p = wp[key]
        if (p?.start && p?.end && p.start <= p.end) {
          result.push({ key, start: p.start, end: p.end })
        }
      }
      if (result.length > 0) return result
    }

    // Fallback: reconstruct from week1StartDate + closingWeekEndDate
    const w1Raw = String(mc.week1StartDate ?? '')
    const closeRaw = String(mc.closingWeekEndDate ?? '')
    if (!w1Raw) return null

    function parseDate(s: string): Date | null {
      if (!s) return null
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) return null
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    }
    function addDays(d: Date, n: number) {
      const r = new Date(d); r.setDate(r.getDate() + n); return r
    }
    function iso(d: Date) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const baseStart = parseDate(w1Raw) ?? monthStart
    const cycleEnd = parseDate(closeRaw) ?? monthEnd

    const stages = ['W1', 'W2', 'W3', 'CLOSING'] as const
    const result: { key: string; start: string; end: string }[] = []
    stages.forEach((key, i) => {
      const stageStart = addDays(baseStart, i * 7)
      if (stageStart > cycleEnd) return
      const rawEnd = key === 'CLOSING' ? cycleEnd : addDays(stageStart, 4)
      const stageEnd = rawEnd > cycleEnd ? cycleEnd : rawEnd
      result.push({ key, start: iso(stageStart), end: iso(stageEnd) })
    })
    return result
  })()

  return NextResponse.json(
    {
      year,
      month,
      roleCode,
      isSupervisor,
      supervisorCode,
      cycleWeeks,
      sellers: sellerSummaries,
      totalMonthlyTarget: sellerSummaries.reduce((sum, s) => sum + s.monthlyTarget, 0),
      sellerCount: sellerSummaries.length,
      blocksConfigured: ruleBlocks.length,
      configuredAt: configRow?.updatedAt ?? null,
    },
    { headers: NO_CACHE }
  )
}
