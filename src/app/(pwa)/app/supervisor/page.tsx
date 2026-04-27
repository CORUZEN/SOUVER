'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { clearPwaClientState } from '@/lib/pwa/clear-client-state'
import { fetchAuthMeCached } from '@/lib/client/auth-me-cache'
import PwaFooter from '@/components/pwa/PwaFooter'
import PwaLoadingScreen from '@/components/pwa/PwaLoadingScreen'
import { PwaLogoutConfirmDialog, PwaSigningOutOverlay } from '@/components/pwa/PwaLogoutExperience'
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ShoppingCart,
  DollarSign,
  Weight,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  LogOut,
  CloudOff,
  Package,
  Star,
  RotateCcw,
  Ban,
  LayoutGrid,
  BarChart2,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface SellerRow {
  id: string
  name: string
  login: string
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  baseClientCount: number
  supervisorCode: string | null
  orders: Array<{ orderNumber: string; negotiatedAt: string; totalValue: number; grossWeight: number; clientCode: string }>
  returns: Array<{ negotiatedAt: string; totalValue: number }>
  openTitles: Array<{ titleId: string; dueDate: string; overdueDays: number; totalValue: number }>
}

type BrandWeightRow = {
  sellerCode: string
  brand: string
  totalKg: number
  totalKgW1?: number
  totalKgW2?: number
  totalKgW3?: number
  totalKgClosing?: number
}
type WeightTarget    = { brand: string; targetKg: number }
type FocusTargetMode = 'KG' | 'BASE_CLIENTS'
type SellerDistributionRow = {
  sellerCode: string
  clientCode: string
  productsW1: number
  productsW2: number
  productsW3: number
  productsClosing: number
  productsMonth: number
}
type SellerDistributionItemsRow = {
  sellerCode: string
  itemsW1: number
  itemsW2: number
  itemsW3: number
  itemsClosing: number
  itemsMonth: number
}
type FocusProductRow = {
  sellerCode: string
  soldKg: number
  soldClients: number
}
type FocusConfig = {
  focusProductCode: string
  focusTargetKg: number
  focusTargetMode: FocusTargetMode
  focusTargetBasePct: number
}

interface SellerRule {
  id: string
  stage: string
  kpi: string
  kpiType: string
  targetText: string
  rewardValue: number
  points: number
}

interface CycleWeek {
  key: string
  start: string
  end: string
  businessDays?: string[]
}

interface UserInfo {
  name: string
  role: string
  roleCode: string
  sellerCode?: string | null
}

type LoadState = 'idle' | 'loading' | 'success' | 'error'
type SellerStatus = 'SUPEROU' | 'NO_ALVO' | 'QUASE_LA' | 'ATENCAO' | 'CRITICO'

const STATUS_CONFIG: Record<SellerStatus, { label: string; color: string; pctColor: string; bg: string; border: string; barColor: string; Icon: React.ElementType }> = {
  SUPEROU:  { label: 'Superou',    color: 'text-sky-400',     pctColor: 'bg-linear-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     barColor: 'bg-linear-to-r from-sky-400 via-cyan-300 to-emerald-300 shadow-[0_0_10px_rgba(56,189,248,0.28)]',     Icon: TrendingUp },
  NO_ALVO:  { label: 'Meta Batida', color: 'text-emerald-400', pctColor: 'bg-linear-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', barColor: 'bg-linear-to-r from-emerald-400 to-lime-300 shadow-[0_0_10px_rgba(52,211,153,0.28)]', Icon: CheckCircle2 },
  QUASE_LA: { label: 'Quase Lá',   color: 'text-amber-400',   pctColor: 'bg-linear-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   barColor: 'bg-linear-to-r from-amber-300 to-orange-300 shadow-[0_0_10px_rgba(251,191,36,0.24)]',   Icon: TrendingUp },
  ATENCAO:  { label: 'Atenção',    color: 'text-orange-400',  pctColor: 'bg-linear-to-r from-orange-200 to-rose-300 bg-clip-text text-transparent',    bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  barColor: 'bg-linear-to-r from-orange-300 to-rose-300 shadow-[0_0_10px_rgba(251,146,60,0.24)]',   Icon: Clock },
  CRITICO:  { label: 'Crítico',    color: 'text-red-400',     pctColor: 'bg-linear-to-r from-rose-300 to-red-300 bg-clip-text text-transparent',      bg: 'bg-red-500/10',     border: 'border-red-500/30',     barColor: 'bg-linear-to-r from-rose-400 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.28)]',      Icon: AlertCircle },
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(value: number, decimals = 0) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}
function fmtBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)
}
function fmtKg(value: number) {
  return `${fmt(value, 2)} kg`
}
function parseDecimal(value: string, fallback = 0) {
  if (!value) return fallback
  const normalized = value.trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : fallback
}
function parseFinancialThresholdPercent(targetText: string) {
  const pctMatches = [...targetText.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => parseDecimal(match[1] ?? '0', 0))
    .filter((value) => value > 0)

  if (pctMatches.length > 0) {
    if (targetText.includes('+') && pctMatches.length >= 2) {
      return pctMatches.reduce((sum, value) => sum + value, 0)
    }
    return Math.max(...pctMatches)
  }

  const numericMatches = targetText.match(/(\d+(?:[.,]\d+)?)/g) ?? []
  const numericValues = numericMatches
    .map((value) => parseDecimal(value, 0))
    .filter((value) => value > 0)
  if (numericValues.length > 0) return Math.max(...numericValues)
  return 100
}
function normalizeCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d+$/.test(trimmed)) {
    const normalized = String(Number(trimmed))
    return normalized === 'NaN' ? trimmed : normalized
  }
  return trimmed
}
function parseInadimplenciaTarget(targetText: string) {
  if (targetText.includes('|')) {
    const [pctRaw, daysRaw] = targetText.split('|')
    return {
      pct: Math.max(parseDecimal((pctRaw ?? '').replace('%', ''), 0), 0),
      days: Math.max(Math.floor(parseDecimal(daysRaw ?? '45', 45)), 1),
    }
  }
  const numbers = targetText.match(/(\d+(?:[.,]\d+)?)/g) ?? []
  return {
    pct: Math.max(parseDecimal(numbers[0] ?? '0', 0), 0),
    days: Math.max(Math.floor(parseDecimal(numbers[1] ?? '45', 45)), 1),
  }
}
function parseDistribuicaoTarget(targetText: string, totalActiveProducts: number) {
  const parts = targetText.split('|').map((s) => s.trim())
  const itemsPart = parts[0] ?? '0'
  const itemsIsPercent = itemsPart.includes('%')
  const itemsNum = Math.max(parseDecimal(itemsPart.replace('%', ''), 0), 0)
  const resolvedItems = itemsIsPercent && totalActiveProducts > 0
    ? Math.ceil((totalActiveProducts * itemsNum) / 100)
    : Math.max(Math.floor(itemsNum), 0)
  const clientsPct = Math.max(parseDecimal((parts[1] ?? '0').replace('%', ''), 0), 0)
  return { resolvedItems, clientsPct }
}
function parseItemFocoTarget(targetText: string) {
  if (targetText.includes('|')) {
    const [volRaw, baseRaw] = targetText.split('|')
    return {
      volumePct: Math.max(parseDecimal((volRaw ?? '').replace('%', ''), 0), 0),
      basePct: Math.max(parseDecimal((baseRaw ?? '').replace('%', ''), 0), 0),
    }
  }
  const numbers = targetText.match(/(\d+(?:[.,]\d+)?)/g) ?? []
  return {
    volumePct: Math.max(parseDecimal(numbers[0] ?? '0', 0), 0),
    basePct: Math.max(parseDecimal(numbers[1] ?? '0', 0), 0),
  }
}
function getDistribuicaoProductsByStage(row: SellerDistributionRow, stage: string) {
  if (stage === 'W1') return row.productsW1
  if (stage === 'W2') return row.productsW2
  if (stage === 'W3') return row.productsW3
  if (stage === 'CLOSING') return row.productsClosing
  return row.productsMonth
}
function getDistribuicaoItemsByStage(row: SellerDistributionItemsRow | undefined, stage: string) {
  if (!row) return 0
  if (stage === 'W1') return row.itemsW1
  if (stage === 'W2') return row.itemsW2
  if (stage === 'W3') return row.itemsW3
  if (stage === 'CLOSING') return row.itemsClosing
  return row.itemsMonth
}

function getBrandWeightByStage(row: BrandWeightRow, stage: string) {
  if (stage === 'W1') return Number(row.totalKgW1 ?? row.totalKg ?? 0)
  if (stage === 'W2') return Number(row.totalKgW2 ?? row.totalKg ?? 0)
  if (stage === 'W3') return Number(row.totalKgW3 ?? row.totalKg ?? 0)
  if (stage === 'CLOSING') return Number(row.totalKgClosing ?? row.totalKg ?? 0)
  return Number(row.totalKg ?? 0)
}

function getStageTargetMultiplier(stage: string, cycleWeeks?: CycleWeek[]): number {
  if (!cycleWeeks || cycleWeeks.length === 0) {
    const stageOrder = ['W1', 'W2', 'W3', 'CLOSING']
    const idx = stageOrder.indexOf(stage)
    if (idx < 0) return 1
    return (idx + 1) / stageOrder.length
  }

  const operationalStages = ['W1', 'W2', 'W3', 'CLOSING']
  const operationalWeeks = cycleWeeks
    .filter((w) => operationalStages.includes(w.key))
    .sort((a, b) => operationalStages.indexOf(a.key) - operationalStages.indexOf(b.key))

  let totalBusinessDays = 0
  const cumulativeDaysByStage = new Map<string, number>()

  for (const week of operationalWeeks) {
    const days = Array.isArray(week.businessDays) ? week.businessDays.length : 0
    totalBusinessDays += days
    cumulativeDaysByStage.set(week.key, totalBusinessDays)
  }

  if (totalBusinessDays === 0) return 1

  const cumulativeDays = cumulativeDaysByStage.get(stage) ?? totalBusinessDays
  return cumulativeDays / totalBusinessDays
}

function estimatePremioEarned(profileType: string, _pct: number, earnedReward: number): string {
  if (profileType === 'ANTIGO_1' || profileType === 'ANTIGO_15') {
    return `${fmt(earnedReward, 2)}%`
  }
  return fmtBrl(earnedReward)
}
function estimatePremioMax(profileType: string, maxReward: number): string {
  if (profileType === 'ANTIGO_1' || profileType === 'ANTIGO_15') {
    if (maxReward > 0) return `/ ${fmt(maxReward, 2)}%`
    return profileType === 'ANTIGO_1' ? '/ 1,00%' : '/ 1,50%'
  }
  if (maxReward > 0) return `/ ${fmtBrl(maxReward)}`
  return ''
}

/**
 * Full reward scoring — mirrors MetasWorkspace logic for all computable KPI types.
 * Handles: META_FINANCEIRA, BASE_CLIENTES, VOLUME, DEVOLUCAO, INADIMPLENCIA.
 * Non-computable types (DISTRIBUICAO, ITEM_FOCO, RENTABILIDADE) are skipped.
 */
function computeEarnedReward(
  rules: SellerRule[],
  cycleWeeks: CycleWeek[],
  orders: SellerRow['orders'],
  returns: SellerRow['returns'],
  openTitles: SellerRow['openTitles'],
  monthlyTarget: number,
  baseClientCount: number,
  weightTargets: WeightTarget[],
  brandWeightRows: BrandWeightRow[],
  distributionBySellerProduct: Map<string, SellerDistributionRow[]>,
  distributionItemsBySeller: Map<string, SellerDistributionItemsRow>,
  totalActiveProducts: number,
  focusConfig: FocusConfig | null,
  focusRowsByProduct: Record<string, FocusProductRow[]>,
  sellerCode: string,
  todayIso: string,
): number {
  const startedWeeks = cycleWeeks.filter((w) => w.start <= todayIso)
  if (startedWeeks.length === 0 || monthlyTarget <= 0) return 0

  let earned = 0
  for (const rule of rules) {
    const week = cycleWeeks.find((w) => w.key === rule.stage)
    if (!week || week.start > todayIso) continue

    const stageEnd = week.end
    const kpiLabel = (rule.kpi ?? '').toLowerCase()
    const kpiType = rule.kpiType || (
      kpiLabel.includes('meta financeira') ? 'META_FINANCEIRA' :
      kpiLabel.includes('base de clientes') ? 'BASE_CLIENTES' :
      kpiLabel.includes('volume') || kpiLabel.includes('categori') ? 'VOLUME' :
      kpiLabel.includes('devolu') ? 'DEVOLUCAO' :
      kpiLabel.includes('inadimpl') ? 'INADIMPLENCIA' :
      kpiLabel.includes('distribui') ? 'DISTRIBUICAO' :
      (kpiLabel.includes('item foco') || kpiLabel.includes('foco')) ? 'ITEM_FOCO' : ''
    )

    const ordersUpToStage = orders.filter((o) => o.negotiatedAt <= stageEnd)
    let progress = 0

    if (kpiType === 'META_FINANCEIRA') {
      const thresholdPct = parseFinancialThresholdPercent(rule.targetText)
      const threshold = thresholdPct > 0 ? thresholdPct / 100 : 1
      const isExtraFinancialTarget = thresholdPct > 100
      const financialOrders = isExtraFinancialTarget ? orders : ordersUpToStage
      const accumulated = financialOrders.reduce((s, o) => s + o.totalValue, 0)
      progress = accumulated / (monthlyTarget * threshold)
    } else if (kpiType === 'BASE_CLIENTES') {
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const base = Math.max(baseClientCount, 1)
      const clients = new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
      progress = clients / (base * threshold)
    } else if (kpiType === 'VOLUME') {
      const requiredGroups = Math.max(Math.floor(parseFloat(rule.targetText) || 0), 0)
      const stageWeightByBrand = new Map<string, number>()
      for (const row of brandWeightRows) {
        if (row.sellerCode !== sellerCode) continue
        const key = row.brand.toUpperCase()
        stageWeightByBrand.set(key, (stageWeightByBrand.get(key) ?? 0) + getBrandWeightByStage(row, rule.stage))
      }
      const targetMultiplier = getStageTargetMultiplier(rule.stage, cycleWeeks)
      const stageWeightTargetRatios = weightTargets.map((wt) => {
        const sold = stageWeightByBrand.get(wt.brand.toUpperCase()) ?? 0
        return sold / Math.max(wt.targetKg * targetMultiplier, 0.00001)
      })
      if (requiredGroups > 0 && stageWeightTargetRatios.length > 0) {
        const topRatios = [...stageWeightTargetRatios].sort((a, b) => b - a).slice(0, requiredGroups)
        const normalized = Array.from({ length: requiredGroups }, (_, i) => Math.min(topRatios[i] ?? 0, 1))
        progress = normalized.reduce((s, v) => s + v, 0) / requiredGroups
      }
    } else if (kpiType === 'DEVOLUCAO') {
      const rawNum = parseFloat(rule.targetText.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0
      const targetPct = rawNum > 0 ? rawNum / 100 : 0
      const financial = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      const returned = returns.filter((r) => r.negotiatedAt <= stageEnd).reduce((s, r) => s + r.totalValue, 0)
      if (financial > 0 && targetPct > 0) {
        const actualPct = returned / financial
        progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
      }
    } else if (kpiType === 'INADIMPLENCIA') {
      const { pct: inadPct, days: atrasoDias } = parseInadimplenciaTarget(rule.targetText)
      const targetPct = inadPct > 0 ? inadPct / 100 : 0
      const financial = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      const overdueValue = openTitles
        .filter((t) => t.dueDate <= stageEnd && t.overdueDays > atrasoDias)
        .reduce((s, t) => s + t.totalValue, 0)
      if (financial > 0 && targetPct > 0) {
        const actualPct = overdueValue / financial
        progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
      }
    } else if (kpiType === 'DISTRIBUICAO') {
      const { resolvedItems, clientsPct } = parseDistribuicaoTarget(rule.targetText, totalActiveProducts)
      const requiredClients = clientsPct > 0 && baseClientCount > 0
        ? Math.ceil(baseClientCount * (clientsPct / 100))
        : 0
      const sellerRows = distributionBySellerProduct.get(sellerCode) ?? []
      const sellerItemsRow = distributionItemsBySeller.get(sellerCode)
      const soldItemsStage = getDistribuicaoItemsByStage(sellerItemsRow, rule.stage)
      const clientsWithAnyItems = sellerRows.reduce((sum, row) => {
        const productsByStage = getDistribuicaoProductsByStage(row, rule.stage)
        return sum + (productsByStage >= 1 ? 1 : 0)
      }, 0)
      if (resolvedItems > 0 && requiredClients > 0) {
        const itemsProgress = soldItemsStage / Math.max(resolvedItems, 1)
        const clientsProgress = clientsWithAnyItems / Math.max(requiredClients, 1)
        progress = Math.min(itemsProgress, clientsProgress)
      } else if (clientsPct > 0 && baseClientCount > 0) {
        const fallbackRequiredClients = Math.ceil(baseClientCount * (clientsPct / 100))
        const clientsAchieved = new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
        progress = clientsAchieved / Math.max(fallbackRequiredClients, 1)
      } else {
        progress = ordersUpToStage.length > 0 ? 1 : 0
      }
    } else if (kpiType === 'ITEM_FOCO') {
      if (!focusConfig?.focusProductCode) {
        progress = 0
      } else {
        const focusRows = focusRowsByProduct[focusConfig.focusProductCode] ?? []
        const focusRow = focusRows.find((row) => normalizeCode(row.sellerCode) === sellerCode)
        const soldKg = focusRow?.soldKg ?? 0
        const soldClients = focusRow?.soldClients ?? 0
        if (focusConfig.focusTargetMode === 'BASE_CLIENTS') {
          const requiredBaseClients = focusConfig.focusTargetBasePct > 0
            ? Math.ceil(baseClientCount * (focusConfig.focusTargetBasePct / 100))
            : 0
          progress = requiredBaseClients > 0 ? soldClients / Math.max(requiredBaseClients, 1) : 0
        } else {
          const { volumePct } = parseItemFocoTarget(rule.targetText)
          const focusTargetKg = Math.max(focusConfig.focusTargetKg ?? 0, 0)
          if (focusTargetKg > 0 && volumePct > 0) {
            const requiredKg = focusTargetKg * (volumePct / 100)
            progress = requiredKg > 0 ? soldKg / requiredKg : 0
          }
        }
      }
    } else {
      continue
    }

    if (progress >= 1) earned += rule.rewardValue
  }
  return earned
}

type KpiProgress = {
  ruleId: string
  stage: string
  kpi: string
  kpiType: string
  targetText: string
  rewardValue: number
  progress: number
  isComputable: boolean
  stageStarted: boolean
  stageEnded: boolean
  details: {
    rows: Array<{ label: string; value: string }>
    volumeGroups?: Array<{ brand: string; targetKg: number; soldKg: number; progressPct: number }>
    dailyPlan?: Array<{ date: string; value: number }>
  }
}

function computeAllKpiProgress(
  rules: SellerRule[],
  cycleWeeks: CycleWeek[],
  orders: SellerRow['orders'],
  returns: SellerRow['returns'],
  openTitles: SellerRow['openTitles'],
  monthlyTarget: number,
  baseClientCount: number,
  weightTargets: WeightTarget[],
  brandWeightRows: BrandWeightRow[],
  distributionBySellerProduct: Map<string, SellerDistributionRow[]>,
  distributionItemsBySeller: Map<string, SellerDistributionItemsRow>,
  totalActiveProducts: number,
  focusConfig: FocusConfig | null,
  focusRowsByProduct: Record<string, FocusProductRow[]>,
  sellerCode: string,
  todayIso: string,
): KpiProgress[] {
  const stageOrder = ['W1', 'W2', 'W3', 'CLOSING'] as const
  const operationalWeeks = cycleWeeks
    .filter((week) => stageOrder.includes(week.key as (typeof stageOrder)[number]) && week.start && week.end)
    .sort((a, b) => a.start.localeCompare(b.start))

  const stageClients = stageOrder.reduce((acc, stage) => {
    acc[stage] = new Set<string>()
    return acc
  }, {} as Record<(typeof stageOrder)[number], Set<string>>)

  for (const order of orders) {
    const clientCode = String(order.clientCode ?? '').trim()
    if (!clientCode) continue
    const stage = operationalWeeks.find((week) => {
      const days = Array.isArray(week.businessDays) ? week.businessDays : []
      if (days.length > 0) return days.includes(order.negotiatedAt)
      return order.negotiatedAt >= week.start && order.negotiatedAt <= week.end
    })?.key
    if (!stage || !stageOrder.includes(stage as (typeof stageOrder)[number])) continue
    stageClients[stage as (typeof stageOrder)[number]].add(clientCode)
  }

  const cumulativeDistinctClients = stageOrder.reduce((acc, stage) => {
    const previous = stage === 'W1'
      ? new Set<string>()
      : new Set(acc[stageOrder[stageOrder.indexOf(stage) - 1] as (typeof stageOrder)[number]].codes)
    for (const code of stageClients[stage]) previous.add(code)
    acc[stage] = { count: previous.size, codes: previous }
    return acc
  }, {} as Record<(typeof stageOrder)[number], { count: number; codes: Set<string> }>)

  const resolveRemainingBusinessDates = (week: CycleWeek): string[] => {
    const startRef = todayIso > week.start ? todayIso : week.start
    if (startRef > week.end) return []

    const explicitBusiness = Array.isArray(week.businessDays) ? week.businessDays : []
    if (explicitBusiness.length > 0) {
      return explicitBusiness.filter((iso) => iso >= startRef && iso <= week.end).sort()
    }

    const dates: string[] = []
    let cursor = new Date(`${startRef}T00:00:00`)
    const end = new Date(`${week.end}T00:00:00`)
    while (cursor <= end) {
      const day = cursor.getDay()
      if (day >= 1 && day <= 5) {
        dates.push(cursor.toISOString().slice(0, 10))
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return dates
  }

  return rules.map((rule) => {
    const week = cycleWeeks.find((w) => w.key === rule.stage)
    const stageStarted = !!week && week.start <= todayIso
    const stageEnded = !!week && week.end < todayIso

    if (!week) {
      return {
        ruleId: rule.id,
        stage: rule.stage,
        kpi: rule.kpi,
        kpiType: rule.kpiType,
        targetText: rule.targetText,
        rewardValue: rule.rewardValue,
        progress: 0,
        isComputable: false,
        stageStarted: false,
        stageEnded: false,
        details: {
          rows: [
            { label: 'Meta', value: rule.targetText || 'Não parametrizada' },
            { label: 'Status', value: 'Etapa não configurada' },
          ],
        },
      }
    }

    const kpiLabel = (rule.kpi ?? '').toLowerCase()
    const kpiType = rule.kpiType || (
      kpiLabel.includes('meta financeira') ? 'META_FINANCEIRA' :
      kpiLabel.includes('base de clientes') ? 'BASE_CLIENTES' :
      kpiLabel.includes('volume') || kpiLabel.includes('categori') ? 'VOLUME' :
      kpiLabel.includes('devolu') ? 'DEVOLUCAO' :
      kpiLabel.includes('inadimpl') ? 'INADIMPLENCIA' :
      kpiLabel.includes('distribui') ? 'DISTRIBUICAO' :
      (kpiLabel.includes('item foco') || kpiLabel.includes('foco')) ? 'ITEM_FOCO' : ''
    )

    const COMPUTABLE = new Set(['META_FINANCEIRA', 'BASE_CLIENTES', 'VOLUME', 'DEVOLUCAO', 'INADIMPLENCIA', 'DISTRIBUICAO', 'ITEM_FOCO'])
    if (!COMPUTABLE.has(kpiType)) {
      return {
        ruleId: rule.id,
        stage: rule.stage,
        kpi: rule.kpi,
        kpiType,
        targetText: rule.targetText,
        rewardValue: rule.rewardValue,
        progress: 0,
        isComputable: false,
        stageStarted,
        stageEnded,
        details: {
          rows: [
            { label: 'Meta', value: rule.targetText || 'Não parametrizada' },
            { label: 'Status', value: 'Requer dados adicionais' },
          ],
        },
      }
    }

    if (!stageStarted) {
      return {
        ruleId: rule.id,
        stage: rule.stage,
        kpi: rule.kpi,
        kpiType,
        targetText: rule.targetText,
        rewardValue: rule.rewardValue,
        progress: 0,
        isComputable: true,
        stageStarted,
        stageEnded,
        details: {
          rows: [
            { label: 'Meta da etapa', value: rule.targetText || 'Não parametrizada' },
            { label: 'Período', value: `${week.start} até ${week.end}` },
            { label: 'Status', value: 'Aguardando início da etapa' },
          ],
        },
      }
    }

    const stageEnd = week.end
    const ordersUpToStage = orders.filter((o) => o.negotiatedAt <= stageEnd)
    let progress = 0
    let details: KpiProgress['details'] = {
      rows: [{ label: 'Meta da etapa', value: rule.targetText || 'Não parametrizada' }],
    }

    if (kpiType === 'META_FINANCEIRA') {
      const thresholdPct = parseFinancialThresholdPercent(rule.targetText)
      const threshold = thresholdPct > 0 ? thresholdPct / 100 : 1
      const isExtraFinancialTarget = thresholdPct > 100
      const financialOrders = isExtraFinancialTarget ? orders : ordersUpToStage
      const accumulated = financialOrders.reduce((s, o) => s + o.totalValue, 0)
      progress = monthlyTarget > 0 ? accumulated / (monthlyTarget * threshold) : 0
      const stageTargetValue = monthlyTarget > 0 ? monthlyTarget * threshold : 0
      const missingValue = Math.max(stageTargetValue - accumulated, 0)
      const remainingDays = resolveRemainingBusinessDates(week)
      const requiredPerDay = remainingDays.length > 0 ? missingValue / remainingDays.length : missingValue
      details = isExtraFinancialTarget
        ? {
            rows: [
              { label: 'Meta 120%', value: fmtBrl(stageTargetValue) },
              { label: 'Atingido total', value: fmtBrl(accumulated) },
              {
                label: accumulated >= stageTargetValue ? 'Excedente da meta' : 'Falta para meta extra',
                value: fmtBrl(Math.abs(accumulated - stageTargetValue)),
              },
            ],
          }
        : {
            rows: [
              { label: 'Meta da etapa', value: fmtBrl(stageTargetValue) },
              { label: 'Realizado', value: fmtBrl(accumulated) },
              { label: 'Falta para bater', value: fmtBrl(missingValue) },
              { label: 'Dias úteis restantes', value: fmt(remainingDays.length) },
              { label: 'Recomendado para vender hoje', value: fmtBrl(requiredPerDay) },
            ],
            dailyPlan: remainingDays.map((date) => ({ date, value: requiredPerDay })),
          }
    } else if (kpiType === 'BASE_CLIENTES') {
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const base = Math.max(baseClientCount, 1)
      const stageKey = (rule.stage as (typeof stageOrder)[number])
      const clients = stageOrder.includes(stageKey)
        ? cumulativeDistinctClients[stageKey]?.count ?? 0
        : new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
      progress = clients / (base * threshold)
      const requiredClients = Math.ceil(base * threshold)
      details = {
        rows: [
          { label: 'Base total', value: fmt(base) },
          { label: 'Meta de clientes', value: fmt(requiredClients) },
          { label: 'Clientes atendidos', value: fmt(clients) },
          { label: 'Faltantes', value: fmt(Math.max(requiredClients - clients, 0)) },
        ],
      }
    } else if (kpiType === 'VOLUME') {
      const requiredGroups = Math.max(Math.floor(parseFloat(rule.targetText) || 0), 0)
      const stageWeightByBrand = new Map<string, number>()
      for (const row of brandWeightRows) {
        if (row.sellerCode !== sellerCode) continue
        const key = row.brand.toUpperCase()
        stageWeightByBrand.set(key, (stageWeightByBrand.get(key) ?? 0) + getBrandWeightByStage(row, rule.stage))
      }
      const targetMultiplier = getStageTargetMultiplier(rule.stage, cycleWeeks)
      const stageWeightTargetRatios = weightTargets.map((wt) => {
        const sold = stageWeightByBrand.get(wt.brand.toUpperCase()) ?? 0
        return sold / Math.max(wt.targetKg * targetMultiplier, 0.00001)
      })
      const volumeGroups = weightTargets.map((wt) => {
        const soldKg = stageWeightByBrand.get(wt.brand.toUpperCase()) ?? 0
        const stageTargetKg = wt.targetKg * targetMultiplier
        const progressPct = stageTargetKg > 0 ? (soldKg / stageTargetKg) * 100 : 0
        return {
          brand: wt.brand,
          targetKg: stageTargetKg,
          soldKg,
          progressPct,
        }
      }).sort((a, b) => b.progressPct - a.progressPct)
      if (requiredGroups > 0 && stageWeightTargetRatios.length > 0) {
        const topRatios = [...stageWeightTargetRatios].sort((a, b) => b - a).slice(0, requiredGroups)
        const normalized = Array.from({ length: requiredGroups }, (_, i) => Math.min(topRatios[i] ?? 0, 1))
        progress = normalized.reduce((s, v) => s + v, 0) / requiredGroups
      }
      const groupsHit = volumeGroups.filter((row) => row.progressPct >= 100).length
      details = {
        rows: [
          { label: 'Meta definida', value: fmt(requiredGroups) },
          { label: 'Quantidade atingida', value: fmt(groupsHit) },
        ],
        volumeGroups,
      }
    } else if (kpiType === 'DEVOLUCAO') {
      const rawNum = parseFloat(rule.targetText.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0
      const targetPct = rawNum > 0 ? rawNum / 100 : 0
      const financial = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      const returned = returns.filter((r) => r.negotiatedAt <= stageEnd).reduce((s, r) => s + r.totalValue, 0)
      if (financial > 0 && targetPct > 0) {
        const actualPct = returned / financial
        progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
        details = {
          rows: [
            { label: 'Limite da etapa', value: fmtPct(targetPct * 100, 2) },
            { label: 'Taxa atual', value: fmtPct(actualPct * 100, 2) },
            { label: 'Valor devolvido', value: fmtBrl(returned) },
            { label: 'Base faturada', value: fmtBrl(financial) },
          ],
        }
      }
    } else if (kpiType === 'INADIMPLENCIA') {
      const { pct: inadPct, days: atrasoDias } = parseInadimplenciaTarget(rule.targetText)
      const targetPct = inadPct > 0 ? inadPct / 100 : 0
      const financial = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      const overdueValue = openTitles
        .filter((t) => t.dueDate <= stageEnd && t.overdueDays > atrasoDias)
        .reduce((s, t) => s + t.totalValue, 0)
      if (financial > 0 && targetPct > 0) {
        const actualPct = overdueValue / financial
        progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
        details = {
          rows: [
            { label: 'Limite da etapa', value: `${fmtPct(targetPct * 100, 2)} até ${fmt(atrasoDias)} dias` },
            { label: 'Taxa atual', value: fmtPct(actualPct * 100, 2) },
            { label: 'Valor em atraso', value: fmtBrl(overdueValue) },
            { label: 'Base faturada', value: fmtBrl(financial) },
          ],
        }
      }
    } else if (kpiType === 'DISTRIBUICAO') {
      const { resolvedItems, clientsPct } = parseDistribuicaoTarget(rule.targetText, totalActiveProducts)
      const requiredClients = clientsPct > 0 && baseClientCount > 0
        ? Math.ceil(baseClientCount * (clientsPct / 100))
        : 0
      const sellerRows = distributionBySellerProduct.get(sellerCode) ?? []
      const sellerItemsRow = distributionItemsBySeller.get(sellerCode)
      const soldItemsStage = getDistribuicaoItemsByStage(sellerItemsRow, rule.stage)
      const clientsWithAnyItems = sellerRows.reduce((sum, row) => {
        const productsByStage = getDistribuicaoProductsByStage(row, rule.stage)
        return sum + (productsByStage >= 1 ? 1 : 0)
      }, 0)
      if (resolvedItems > 0 && requiredClients > 0) {
        const itemsProgress = soldItemsStage / Math.max(resolvedItems, 1)
        const clientsProgress = clientsWithAnyItems / Math.max(requiredClients, 1)
        progress = Math.min(itemsProgress, clientsProgress)
      } else if (clientsPct > 0 && baseClientCount > 0) {
        const fallbackRequiredClients = Math.ceil(baseClientCount * (clientsPct / 100))
        const stageKey = (rule.stage as (typeof stageOrder)[number])
        const clientsAchieved = stageOrder.includes(stageKey)
          ? cumulativeDistinctClients[stageKey]?.count ?? 0
          : new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
        progress = clientsAchieved / Math.max(fallbackRequiredClients, 1)
      } else {
        progress = ordersUpToStage.length > 0 ? 1 : 0
      }
      details = {
        rows: [
          { label: 'Itens exigidos', value: fmt(resolvedItems) },
          { label: 'Itens vendidos', value: fmt(soldItemsStage) },
          { label: 'Clientes exigidos', value: fmt(requiredClients) },
          { label: 'Clientes com item', value: fmt(clientsWithAnyItems) },
        ],
      }
    } else if (kpiType === 'ITEM_FOCO') {
      if (!focusConfig?.focusProductCode) {
        progress = 0
        details = {
          rows: [
            { label: 'Status', value: 'Item foco não configurado' },
          ],
        }
      } else {
        const focusRows = focusRowsByProduct[focusConfig.focusProductCode] ?? []
        const focusRow = focusRows.find((row) => normalizeCode(row.sellerCode) === sellerCode)
        const soldKg = focusRow?.soldKg ?? 0
        const soldClients = focusRow?.soldClients ?? 0
        if (focusConfig.focusTargetMode === 'BASE_CLIENTS') {
          const requiredBaseClients = focusConfig.focusTargetBasePct > 0
            ? Math.ceil(baseClientCount * (focusConfig.focusTargetBasePct / 100))
            : 0
          progress = requiredBaseClients > 0 ? soldClients / Math.max(requiredBaseClients, 1) : 0
          details = {
            rows: [
              { label: 'Critério', value: 'Base de clientes' },
              { label: 'Meta da base', value: `${fmt(focusConfig.focusTargetBasePct, 1)}% (${fmt(requiredBaseClients)} clientes)` },
              { label: 'Realizado', value: `${fmt(soldClients)} clientes` },
              { label: 'Faltantes', value: fmt(Math.max(requiredBaseClients - soldClients, 0)) },
            ],
          }
        } else {
          const { volumePct } = parseItemFocoTarget(rule.targetText)
          const focusTargetKg = Math.max(focusConfig.focusTargetKg ?? 0, 0)
          if (focusTargetKg > 0 && volumePct > 0) {
            const requiredKg = focusTargetKg * (volumePct / 100)
            progress = requiredKg > 0 ? soldKg / requiredKg : 0
            details = {
              rows: [
                { label: 'Critério', value: 'Volume do item foco' },
                { label: 'Meta do item', value: `${fmt(focusTargetKg, 2)} kg` },
                { label: 'Volume exigido', value: `${fmt(requiredKg, 2)} kg` },
                { label: 'Realizado', value: `${fmt(soldKg, 2)} kg` },
              ],
            }
          }
        }
      }
    }

    return {
      ruleId: rule.id,
      stage: rule.stage,
      kpi: rule.kpi,
      kpiType,
      targetText: rule.targetText,
      rewardValue: rule.rewardValue,
      progress: Math.min(progress, 1.4),
      isComputable: true,
      stageStarted,
      stageEnded,
      details,
    }
  })
}

function fmtPct(value: number, decimals = 1) {
  return `${fmt(value, decimals)}%`
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatHeaderIdentity(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].toUpperCase()
  return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase()
}

function getPreviousPeriod(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function countOrdersUpToDay(sellers: SellerRow[], year: number, month: number, dayLimit: number) {
  let total = 0
  for (const seller of sellers) {
    for (const order of seller.orders ?? []) {
      const dateRaw = String(order.negotiatedAt ?? '').trim()
      if (!dateRaw) continue
      const dt = new Date(`${dateRaw}T00:00:00`)
      if (Number.isNaN(dt.getTime())) continue
      const y = dt.getFullYear()
      const m = dt.getMonth() + 1
      const d = dt.getDate()
      if (y === year && m === month && d <= dayLimit) total += 1
    }
  }
  return total
}

function sumOrderValueUpToDay(sellers: SellerRow[], year: number, month: number, dayLimit: number) {
  let total = 0
  for (const seller of sellers) {
    for (const order of seller.orders ?? []) {
      const dateRaw = String(order.negotiatedAt ?? '').trim()
      if (!dateRaw) continue
      const dt = new Date(`${dateRaw}T00:00:00`)
      if (Number.isNaN(dt.getTime())) continue
      const y = dt.getFullYear()
      const m = dt.getMonth() + 1
      const d = dt.getDate()
      if (y === year && m === month && d <= dayLimit) {
        total += Number(order.totalValue ?? 0)
      }
    }
  }
  return total
}

function inferStatus(pct: number): SellerStatus {
  if (pct >= 107) return 'SUPEROU'
  if (pct >= 100) return 'NO_ALVO'
  if (pct >= 75)  return 'QUASE_LA'
  if (pct >= 25)  return 'ATENCAO'
  return 'CRITICO'
}

function countDistinctClients(seller: SellerRow): number {
  const set = new Set<string>()
  for (const order of seller.orders) {
    if (order.clientCode) set.add(order.clientCode)
  }
  return set.size
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function SupervisorPwaDashboard() {
  const router = useRouter()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [user, setUser] = useState<UserInfo | null>(null)
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>({})
  const [profileTypes, setProfileTypes] = useState<Record<string, string>>({})
  const [maxRewards, setMaxRewards] = useState<Record<string, number>>({})
  const [sellerRules, setSellerRules] = useState<Record<string, SellerRule[]>>({})
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState('')
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [brandWeightRows, setBrandWeightRows] = useState<BrandWeightRow[]>([])
  const [weightTargetsBySeller, setWeightTargetsBySeller] = useState<Record<string, WeightTarget[]>>({})
  const [distributionRows, setDistributionRows] = useState<SellerDistributionRow[]>([])
  const [distributionSellerItemsRows, setDistributionSellerItemsRows] = useState<SellerDistributionItemsRow[]>([])
  const [distributionProductCount, setDistributionProductCount] = useState(0)
  const [focusConfigBySeller, setFocusConfigBySeller] = useState<Record<string, FocusConfig>>({})
  const [focusRowsByProduct, setFocusRowsByProduct] = useState<Record<string, FocusProductRow[]>>({})
  const [previousMonthSellers, setPreviousMonthSellers] = useState<SellerRow[]>([])
  const [previousMonthTotalTarget, setPreviousMonthTotalTarget] = useState(0)
  const [bootProgress, setBootProgress] = useState(0)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)
  const hasLoadedInitialDataRef = useRef(false)
  const authCheckStartedRef = useRef(false)
  const activeLoadIdRef = useRef(0)
  const inFlightKeyRef = useRef<string | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const distributionBySellerProduct = useMemo(() => {
    const bySeller = new Map<string, SellerDistributionRow[]>()
    for (const row of distributionRows) {
      const sellerCode = normalizeCode(String(row.sellerCode ?? ''))
      if (!sellerCode) continue
      if (!bySeller.has(sellerCode)) bySeller.set(sellerCode, [])
      bySeller.get(sellerCode)!.push(row)
    }
    return bySeller
  }, [distributionRows])

  const distributionItemsBySeller = useMemo(() => {
    const bySeller = new Map<string, SellerDistributionItemsRow>()
    for (const row of distributionSellerItemsRows) {
      const sellerCode = normalizeCode(String(row.sellerCode ?? ''))
      if (!sellerCode) continue
      bySeller.set(sellerCode, row)
    }
    return bySeller
  }, [distributionSellerItemsRows])

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authCheckStartedRef.current) return
    authCheckStartedRef.current = true
    setBootProgress(5)
    fetchAuthMeCached({ force: false })
      .then((data) => {
        if (!data?.user) { router.replace('/app/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        const ALLOWED_SUPERVISOR_ROLES = new Set(['COMMERCIAL_SUPERVISOR', 'SALES_SUPERVISOR', 'SELLER', 'DIRECTORATE', 'COMMERCIAL_MANAGER', 'DEVELOPER'])
        if (!ALLOWED_SUPERVISOR_ROLES.has(roleCode)) { router.replace('/app'); return }
        // Keep continuity between "Validando acesso" and "Carregando sistema".
        setBootProgress(15)
        setUser({
          name: data.user.name,
          role: typeof data.user.role === 'string' ? data.user.role : data.user.role?.name ?? '',
          roleCode,
          sellerCode: data.user.sellerCode,
        })
      })
      .catch(() => router.replace('/app/login'))
  }, [router])

  // ── Online status ────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ── Load performance data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const loggedSellerCode = normalizeCode(String(user?.sellerCode ?? ''))
    const isSellerUser = user?.roleCode === 'SELLER'
    if (isSellerUser && !loggedSellerCode) {
      setLoadState('error')
      setError('Usuário vendedor sem vínculo com código de vendedor. Solicite ao Desenvolvedor para vincular a conta a um vendedor da lista liberada.')
      setSellers([])
      setHasLoadedInitialData(true)
      hasLoadedInitialDataRef.current = true
      return
    }
    const loadKey = `${year}-${month}-${user?.roleCode ?? ''}-${loggedSellerCode}`
    if (inFlightKeyRef.current === loadKey) return
    inFlightKeyRef.current = loadKey
    const loadId = ++activeLoadIdRef.current

    setLoadState('loading')
    setError('')
    if (!hasLoadedInitialDataRef.current) setBootProgress((prev) => Math.max(prev, 15))
    // Clear visible data immediately when period changes to avoid stale numbers during loading.
    setSellers([])
    setMonthlyTargets({})
    setProfileTypes({})
    setMaxRewards({})
    setSellerRules({})
    setBrandWeightRows([])
    setWeightTargetsBySeller({})
    setDistributionRows([])
    setDistributionSellerItemsRows([])
    setDistributionProductCount(0)
    setFocusConfigBySeller({})
    setFocusRowsByProduct({})
    setPreviousMonthSellers([])
    setPreviousMonthTotalTarget(0)
    setExpandedSeller(null)
    setLastUpdated(null)
    try {
      let completed = 0
      let total = 0
      let displayedProgress = hasLoadedInitialDataRef.current ? 0 : 15
      const pushProgress = (rawValue: number) => {
        if (loadId !== activeLoadIdRef.current) return
        const clamped = Math.min(Math.max(rawValue, 0), 95)
        const next = Math.max(displayedProgress, clamped)
        if (next !== displayedProgress) {
          displayedProgress = next
          setBootProgress(next)
        }
      }
      const markTotal = (stepCount = 1) => {
        total += stepCount
        const next = total > 0 ? Math.round((completed / total) * 100) : 0
        pushProgress(next)
      }
      const markDone = () => {
        completed += 1
        const next = total > 0 ? Math.round((completed / total) * 100) : 0
        pushProgress(next)
      }
      const trackedFetch = (url: string) => {
        markTotal(1)
        return fetch(url, { cache: 'no-store' }).finally(markDone)
      }

      const prevPeriod = getPreviousPeriod(year, month)
      const [perfRes, summaryRes, prevPerfRes, prevSummaryRes] = await Promise.all([
        trackedFetch(`/api/metas/sellers-performance?year=${year}&month=${month}&companyScope=all`),
        trackedFetch(`/api/pwa/summary?year=${year}&month=${month}`),
        trackedFetch(`/api/metas/sellers-performance?year=${prevPeriod.year}&month=${prevPeriod.month}&companyScope=all`),
        trackedFetch(`/api/pwa/summary?year=${prevPeriod.year}&month=${prevPeriod.month}`),
      ])

      if (!perfRes.ok) {
        const d = await perfRes.json().catch(() => ({}))
        throw new Error(d.message ?? `Erro ${perfRes.status}`)
      }

      const [perfData, summaryData, prevPerfData, prevSummaryData] = await Promise.all([
        perfRes.json(),
        summaryRes.ok ? summaryRes.json() : Promise.resolve(null),
        prevPerfRes.ok ? prevPerfRes.json() : Promise.resolve(null),
        prevSummaryRes.ok ? prevSummaryRes.json() : Promise.resolve(null),
      ])

      const cycleWeeksFromSummary: CycleWeek[] = Array.isArray(summaryData?.cycleWeeks)
        ? (summaryData.cycleWeeks as CycleWeek[])
        : []
      const stageParams = new URLSearchParams({
        year: String(year),
        month: String(month),
        companyScope: 'all',
      })
      const cycleWeekByKey = new Map(cycleWeeksFromSummary.map((w) => [String(w.key).toUpperCase(), w]))
      const stageW1 = cycleWeekByKey.get('W1')?.end
      const stageW2 = cycleWeekByKey.get('W2')?.end
      const stageW3 = cycleWeekByKey.get('W3')?.end
      const stageClosing = cycleWeekByKey.get('CLOSING')?.end
      if (stageW1) stageParams.set('w1End', stageW1)
      if (stageW2) stageParams.set('w2End', stageW2)
      if (stageW3) stageParams.set('w3End', stageW3)
      if (stageClosing) stageParams.set('closingEnd', stageClosing)
      const brandWeightRes = await trackedFetch(`/api/metas/sellers-performance/brand-weight?${stageParams.toString()}`)
      const brandWeightData = brandWeightRes.ok ? await brandWeightRes.json() : null

      // Build summary maps first so dependent requests can run in parallel.
      const targets: Record<string, number> = {}
      const ptypes: Record<string, string> = {}
      const mrewards: Record<string, number> = {}
      const srules: Record<string, SellerRule[]> = {}
      const swtargets: Record<string, WeightTarget[]> = {}
      const sfocus: Record<string, FocusConfig> = {}
      const focusCodes = new Set<string>()
      if (summaryData?.sellers) {
        for (const s of summaryData.sellers) {
          if (s.code) {
            const normalizedSellerCode = normalizeCode(String(s.code))
            if (s.monthlyTarget > 0) {
              targets[s.code] = s.monthlyTarget
              if (normalizedSellerCode) targets[normalizedSellerCode] = s.monthlyTarget
            }
            ptypes[s.code] = s.profileType ?? 'NOVATO'
            if (normalizedSellerCode) ptypes[normalizedSellerCode] = s.profileType ?? 'NOVATO'
            if (s.maxReward > 0) {
              mrewards[s.code] = s.maxReward
              if (normalizedSellerCode) mrewards[normalizedSellerCode] = s.maxReward
            }
            if (Array.isArray(s.rules)) {
              srules[s.code] = s.rules
              if (normalizedSellerCode) srules[normalizedSellerCode] = s.rules
            }
            if (Array.isArray(s.weightTargets)) {
              swtargets[s.code] = s.weightTargets
              if (normalizedSellerCode) swtargets[normalizedSellerCode] = s.weightTargets
            }
          }
          if (s.code) {
            const normalizedSellerCode = normalizeCode(String(s.code))
            const focusProductCode = String(s.focusProductCode ?? '').trim()
            const focusCfg: FocusConfig = {
              focusProductCode,
              focusTargetKg: Number(s.focusTargetKg ?? 0),
              focusTargetMode: s.focusTargetMode === 'BASE_CLIENTS' ? 'BASE_CLIENTS' : 'KG',
              focusTargetBasePct: Number(s.focusTargetBasePct ?? 0),
            }
            sfocus[s.code] = focusCfg
            if (normalizedSellerCode) sfocus[normalizedSellerCode] = focusCfg
            if (focusProductCode) focusCodes.add(focusProductCode)
          }
        }
      }

      // Keep item-distribution in sync with web calculations by sending stage closing dates.
      const distParams = new URLSearchParams({
        year: String(year),
        month: String(month),
        companyScope: 'all',
      })
      const weekByKey = new Map(cycleWeeksFromSummary.map((w) => [String(w.key).toUpperCase(), w]))
      const w1 = weekByKey.get('W1')?.end
      const w2 = weekByKey.get('W2')?.end
      const w3 = weekByKey.get('W3')?.end
      const closing = weekByKey.get('CLOSING')?.end
      if (w1) distParams.set('w1End', w1)
      if (w2) distParams.set('w2End', w2)
      if (w3) distParams.set('w3End', w3)
      if (closing) distParams.set('closingEnd', closing)

      const distributionPromise = (async () => {
        try {
          const distributionRes = await trackedFetch(`/api/metas/sellers-performance/item-distribution?${distParams.toString()}`)
          return distributionRes.ok ? await distributionRes.json() : null
        } catch {
          return null
        }
      })()

      const focusRowsPromise = (async () => {
        if (focusCodes.size === 0) return {} as Record<string, FocusProductRow[]>
        markTotal(focusCodes.size)
        const entries = await Promise.all(
          [...focusCodes].map(async (code) => {
            const res = await fetch(`/api/metas/sellers-performance/product-focus?year=${year}&month=${month}&companyScope=all&productCode=${encodeURIComponent(code)}`, { cache: 'no-store' }).finally(markDone)
            if (!res.ok) return [code, []] as const
            const payload = await res.json().catch(() => ({}))
            const rows = Array.isArray(payload?.rows) ? payload.rows : []
            const normalizedRows: FocusProductRow[] = rows.map((row: Record<string, unknown>) => ({
              sellerCode: normalizeCode(String(row.sellerCode ?? '')),
              soldKg: Number(row.soldKg ?? 0),
              soldClients: Number(row.soldClients ?? 0),
            }))
            return [code, normalizedRows] as const
          })
        )
        return Object.fromEntries(entries)
      })()

      const [distributionData, focusRowsByProductData] = await Promise.all([distributionPromise, focusRowsPromise])
      if (loadId !== activeLoadIdRef.current) return

      const allCurrentSellers = (perfData.sellers ?? []) as SellerRow[]
      const allPreviousSellers = (prevPerfData?.sellers ?? []) as SellerRow[]
      const scopedCurrentSellers = isSellerUser && loggedSellerCode
        ? allCurrentSellers.filter((seller) => normalizeCode(seller.id.replace(/^sankhya-/, '')) === loggedSellerCode)
        : allCurrentSellers
      const scopedPreviousSellers = isSellerUser && loggedSellerCode
        ? allPreviousSellers.filter((seller) => normalizeCode(seller.id.replace(/^sankhya-/, '')) === loggedSellerCode)
        : allPreviousSellers

      if (isSellerUser && loggedSellerCode && scopedCurrentSellers.length === 0) {
        throw new Error('Vínculo de vendedor não encontrado no período selecionado. Verifique se o código vinculado está correto na gestão de usuários.')
      }

      const scopedPreviousTarget = (() => {
        if (!isSellerUser || !loggedSellerCode) return Number(prevSummaryData?.totalMonthlyTarget ?? 0)
        const previousSellersSummary = Array.isArray(prevSummaryData?.sellers) ? prevSummaryData.sellers : []
        const targetRow = previousSellersSummary.find((row: { code?: string; monthlyTarget?: number }) =>
          normalizeCode(String(row.code ?? '')) === loggedSellerCode
        )
        return Number(targetRow?.monthlyTarget ?? 0)
      })()

      const scopedBrandWeightRows = ((brandWeightData?.rows ?? []) as BrandWeightRow[]).filter((row) => {
        if (!isSellerUser || !loggedSellerCode) return true
        return normalizeCode(String(row.sellerCode ?? '')) === loggedSellerCode
      })

      const scopedDistributionRows = ((distributionData?.rows ?? []) as SellerDistributionRow[]).filter((row) => {
        if (!isSellerUser || !loggedSellerCode) return true
        return normalizeCode(String(row.sellerCode ?? '')) === loggedSellerCode
      })

      const scopedDistributionSellerItemsRows = ((distributionData?.sellerItems ?? []) as SellerDistributionItemsRow[]).filter((row) => {
        if (!isSellerUser || !loggedSellerCode) return true
        return normalizeCode(String(row.sellerCode ?? '')) === loggedSellerCode
      })

      const scopedFocusRowsByProductData = Object.fromEntries(
        Object.entries(focusRowsByProductData).map(([productCode, rows]) => {
          if (!isSellerUser || !loggedSellerCode) return [productCode, rows]
          const filteredRows = (rows as FocusProductRow[]).filter((row) => normalizeCode(String(row.sellerCode ?? '')) === loggedSellerCode)
          return [productCode, filteredRows]
        })
      )

      setSellers(scopedCurrentSellers)
      setPreviousMonthSellers(scopedPreviousSellers)
      setPreviousMonthTotalTarget(scopedPreviousTarget)
      setBrandWeightRows(scopedBrandWeightRows)
      setMonthlyTargets(targets)
      setProfileTypes(ptypes)
      setMaxRewards(mrewards)
      setSellerRules(srules)
      setWeightTargetsBySeller(swtargets)
      setFocusConfigBySeller(sfocus)
      setDistributionRows(scopedDistributionRows)
      setDistributionSellerItemsRows(scopedDistributionSellerItemsRows)
      setDistributionProductCount(Number(distributionData?.diagnostics?.productCodesRequested ?? 0))
      setFocusRowsByProduct(scopedFocusRowsByProductData as Record<string, FocusProductRow[]>)
      if (cycleWeeksFromSummary.length > 0) setCycleWeeks(cycleWeeksFromSummary)
      setBootProgress(100)
      setLastUpdated(new Date())
      hasLoadedInitialDataRef.current = true
      setHasLoadedInitialData(true)
      setLoadState('success')
    } catch (err) {
      if (loadId !== activeLoadIdRef.current) return
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.')
      hasLoadedInitialDataRef.current = true
      setHasLoadedInitialData(true)
      setLoadState('error')
    } finally {
      if (inFlightKeyRef.current === loadKey) inFlightKeyRef.current = null
    }
  }, [year, month, user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    if (isSigningOut) return
    try {
      setShowSignOutConfirm(false)
      setIsSigningOut(true)
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {})
    } finally {
      await clearPwaClientState()
      window.location.replace('/app/login')
    }
  }

  // ── Period navigation ─────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    const maxYear = now.getFullYear()
    const maxMonth = now.getMonth() + 1
    if (year > maxYear || (year === maxYear && month >= maxMonth)) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalRevenue = sellers.reduce((s, r) => s + r.totalValue, 0)
  const totalOrders = sellers.reduce((s, r) => s + r.totalOrders, 0)
  const totalWeight = sellers.reduce((s, r) => s + r.totalGrossWeight, 0)
  const totalTarget = sellers.reduce((s, r) => {
    const code = r.id.replace(/^sankhya-/, '')
    const normalizedCode = normalizeCode(code)
    return s + (monthlyTargets[code] ?? monthlyTargets[normalizedCode] ?? 0)
  }, 0)
  const overallPct = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0
  const overallPctDisplay = Math.min(Math.max(overallPct, 0), 100)
  const overallPctDisplayRounded = Math.min(Math.max(Number(overallPctDisplay.toFixed(1)), 0), 100)
  const overallPctDisplayLabel = overallPctDisplayRounded >= 100 ? '100%' : fmtPct(overallPctDisplayRounded)
  const targetGapValue = totalRevenue - totalTarget
  const targetGapPct = totalTarget > 0 ? (targetGapValue / totalTarget) * 100 : 0
  const metaFinancialTrendLabel = totalTarget <= 0
    ? 'Meta não configurada'
    : targetGapPct >= 0
      ? `+${fmt(targetGapPct, 1)}% acima da meta ↑`
      : `${fmt(Math.abs(targetGapPct), 1)}% para meta`
  const valueGapLabel = totalTarget <= 0
    ? 'Meta não configurada'
    : targetGapValue >= 0
      ? `+${fmtBrl(Math.abs(targetGapValue))} ↑`
      : `-${fmtBrl(Math.abs(targetGapValue))} ↓`

  const ordersComparison = useMemo(() => {
    const cutoffCurrentDay = isCurrentMonth ? now.getDate() : daysInMonth(year, month)
    const previousPeriod = getPreviousPeriod(year, month)
    const cutoffPreviousDay = Math.min(cutoffCurrentDay, daysInMonth(previousPeriod.year, previousPeriod.month))

    const currentSamePeriodOrders = countOrdersUpToDay(sellers, year, month, cutoffCurrentDay)
    const previousSamePeriodOrders = countOrdersUpToDay(previousMonthSellers, previousPeriod.year, previousPeriod.month, cutoffPreviousDay)
    const delta = currentSamePeriodOrders - previousSamePeriodOrders
    const deltaPct = previousSamePeriodOrders > 0 ? (delta / previousSamePeriodOrders) * 100 : currentSamePeriodOrders > 0 ? 100 : 0
    const trend: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

    return {
      currentSamePeriodOrders,
      previousSamePeriodOrders,
      deltaPct,
      trend,
      hasBaseline: previousSamePeriodOrders > 0,
    }
  }, [isCurrentMonth, month, now, previousMonthSellers, sellers, year])

  const valueComparison = useMemo(() => {
    const cutoffCurrentDay = isCurrentMonth ? now.getDate() : daysInMonth(year, month)
    const previousPeriod = getPreviousPeriod(year, month)
    const cutoffPreviousDay = Math.min(cutoffCurrentDay, daysInMonth(previousPeriod.year, previousPeriod.month))

    const currentSamePeriodValue = sumOrderValueUpToDay(sellers, year, month, cutoffCurrentDay)
    const previousSamePeriodValue = sumOrderValueUpToDay(previousMonthSellers, previousPeriod.year, previousPeriod.month, cutoffPreviousDay)
    const delta = currentSamePeriodValue - previousSamePeriodValue
    const deltaPct = previousSamePeriodValue > 0 ? (delta / previousSamePeriodValue) * 100 : currentSamePeriodValue > 0 ? 100 : 0
    const trend: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

    return {
      currentSamePeriodValue,
      previousSamePeriodValue,
      deltaPct,
      trend,
      hasBaseline: previousSamePeriodValue > 0,
    }
  }, [isCurrentMonth, month, now, previousMonthSellers, sellers, year])

  const metaComparison = useMemo(() => {
    const cutoffCurrentDay = isCurrentMonth ? now.getDate() : daysInMonth(year, month)
    const previousPeriod = getPreviousPeriod(year, month)
    const cutoffPreviousDay = Math.min(cutoffCurrentDay, daysInMonth(previousPeriod.year, previousPeriod.month))

    const currentSamePeriodValue = sumOrderValueUpToDay(sellers, year, month, cutoffCurrentDay)
    const previousSamePeriodValue = sumOrderValueUpToDay(previousMonthSellers, previousPeriod.year, previousPeriod.month, cutoffPreviousDay)
    const currentPct = totalTarget > 0 ? (currentSamePeriodValue / totalTarget) * 100 : 0
    const previousPct = previousMonthTotalTarget > 0 ? (previousSamePeriodValue / previousMonthTotalTarget) * 100 : 0
    const delta = currentPct - previousPct
    const deltaPct = previousPct > 0 ? (delta / previousPct) * 100 : currentPct > 0 ? 100 : 0
    const trend: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

    return {
      currentPct,
      previousPct,
      deltaPct,
      trend,
      hasBaseline: previousMonthTotalTarget > 0,
    }
  }, [isCurrentMonth, month, now, previousMonthSellers, sellers, totalTarget, previousMonthTotalTarget, year])

  const todayIso = new Date().toISOString().slice(0, 10)

  const sellerCards = useMemo(() => {
    return sellers.map((seller) => {
      const code = seller.id.replace(/^sankhya-/, '')
      const normalizedCode = normalizeCode(code)
      const target = monthlyTargets[code] ?? monthlyTargets[normalizedCode] ?? 0
      const financialPct = target > 0 ? (seller.totalValue / target) * 100 : 0
      const clients = countDistinctClients(seller)
      const wTargets = weightTargetsBySeller[code] ?? weightTargetsBySeller[normalizedCode] ?? []
      const weightTargetKg = wTargets.reduce((sum, row) => sum + Math.max(row.targetKg ?? 0, 0), 0)
      const focusConfig = focusConfigBySeller[code] ?? focusConfigBySeller[normalizedCode] ?? null
      const kpiProgress = computeAllKpiProgress(
        sellerRules[code] ?? sellerRules[normalizedCode] ?? [],
        cycleWeeks,
        seller.orders,
        seller.returns ?? [],
        seller.openTitles ?? [],
        target,
        seller.baseClientCount,
        wTargets,
        brandWeightRows,
        distributionBySellerProduct,
        distributionItemsBySeller,
        distributionProductCount,
        focusConfig,
        focusRowsByProduct,
        normalizedCode,
        todayIso,
      )
      const rulesForSeller = sellerRules[code] ?? sellerRules[normalizedCode] ?? []
      const pointsAchieved = rulesForSeller.reduce((sum, rule) => {
        const progress = kpiProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
        return sum + rule.points * Math.min(Math.max(progress, 0), 1)
      }, 0)
      const pointsTarget = rulesForSeller.reduce((sum, rule) => sum + Math.max(rule.points ?? 0, 0), 0)
      const cyclePct = pointsTarget > 0 ? (pointsAchieved / pointsTarget) * 100 : 0
      const status = inferStatus(cyclePct)

      return { seller, code, target, financialPct, cyclePct, status, clients, kpiProgress, pointsAchieved, weightTargetKg }
    }).sort((a, b) => {
      if (b.cyclePct !== a.cyclePct) return b.cyclePct - a.cyclePct
      if (b.pointsAchieved !== a.pointsAchieved) return b.pointsAchieved - a.pointsAchieved
      return a.seller.name.localeCompare(b.seller.name, 'pt-BR')
    })
  }, [
    sellers,
    monthlyTargets,
    weightTargetsBySeller,
    focusConfigBySeller,
    sellerRules,
    cycleWeeks,
    brandWeightRows,
    distributionBySellerProduct,
    distributionItemsBySeller,
    distributionProductCount,
    focusRowsByProduct,
    todayIso,
  ])

  /* ── Render ─────────────────────────────────────────────────────────────── */
  if (!user) {
    return <PwaLoadingScreen label="Validando acesso" progress={bootProgress} />
  }

  if (!hasLoadedInitialData && (loadState === 'idle' || loadState === 'loading')) {
    return <PwaLoadingScreen label="Carregando sistema" progress={bootProgress} />
  }

  return (
    <div className="pwa-shell flex h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain bg-surface-950 text-white [touch-action:pan-y] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="pwa-topbar sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <Image src="/branding/ouroverde.webp" alt="Ouro Verde" fill sizes="48px" className="object-contain" priority />
            </div>
            <div className="h-9 w-px bg-surface-700/60" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold leading-tight text-white">{formatHeaderIdentity(user.name)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-300 leading-tight">
                {user.roleCode === 'SELLER'
                  ? 'VENDEDOR'
                  : user.roleCode === 'SALES_SUPERVISOR'
                    ? 'SUPERVISOR DE VENDAS'
                    : user.roleCode === 'DIRECTORATE'
                      ? 'DIRETORIA'
                      : user.roleCode === 'COMMERCIAL_MANAGER'
                        ? 'GERÊNCIA COMERCIAL'
                        : 'SUPERVISOR COMERCIAL'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="pwa-offline-indicator flex h-9 w-9 items-center justify-center rounded-lg" title="Sem conexão com a internet" aria-label="Sem conexão com a internet">
                <CloudOff className="h-4.5 w-4.5" />
              </div>
            )}
            {user?.roleCode === 'DIRECTORATE' && (
              <button
                type="button"
                onClick={() => router.push('/app/diretoria')}
                className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95"
                title="Voltar para Central de Comando"
                aria-label="Voltar"
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
            )}
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loadState === 'loading'}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loadState === 'loading' ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              disabled={isSigningOut}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-rose-400 active:scale-95"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Month selector ────────────────────────────────────────────────── */}
      <div className="pwa-monthbar flex items-center justify-between border-b border-surface-800 bg-surface-900/60 px-4 py-2">
        <button
          type="button"
          onClick={prevMonth}
          className="pwa-icon-btn flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95"
        >
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-white">{monthLabel(year, month)}</p>
          {lastUpdated && (
            <p className="text-[10px] text-surface-500">
              Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="pwa-icon-btn flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pb-8 pt-4 space-y-4">

        {/* Error */}
        {loadState === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <XCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-300">Falha ao carregar dados</p>
            <p className="mt-1 text-xs text-red-400/80">{error}</p>
            <button
              type="button"
              onClick={() => loadData()}
              className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30 active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading state */}
        {hasLoadedInitialData && loadState === 'loading' && sellers.length === 0 && (
          <div className="flex min-h-80 items-center justify-center">
            <div className="inline-flex items-center gap-2 px-2 py-1">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-300/90" />
              <span className="text-sm font-semibold tracking-[0.01em] text-surface-200/95">Carregando...</span>
            </div>
          </div>
        )}

        {loadState !== 'error' && (sellers.length > 0 || loadState === 'success') && (
          <>
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Meta de Faturamento */}
              <div className="pwa-card pwa-card-hero col-span-2 rounded-2xl border border-surface-700/50 bg-surface-900 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Meta Financeira</p>
                  <span className={`max-w-42.5 text-right text-[11px] font-semibold leading-tight tabular-nums ${
                    totalTarget <= 0
                      ? 'text-surface-300'
                      : targetGapPct >= 0
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                  }`}>
                    {metaFinancialTrendLabel}
                  </span>
                </div>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                    overallPct >= 100
                      ? 'bg-linear-to-r from-emerald-200 to-lime-200 bg-clip-text text-transparent'
                      : overallPct >= 80
                      ? 'text-lime-300'
                      : overallPct >= 50
                      ? 'text-amber-300'
                      : 'text-rose-300'
                  }`}>
                    {overallPctDisplayLabel}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-800/95 ring-1 ring-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      overallPct >= 100
                        ? 'bg-emerald-300'
                        : overallPct >= 80
                        ? 'bg-lime-400'
                        : overallPct >= 50
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{ width: `${Math.min(overallPct, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-surface-500">
                  <span>Realizado: {fmtBrl(totalRevenue)}</span>
                  <span>Meta: {fmtBrl(totalTarget)}</span>
                </div>
              </div>

              {/* Pedidos */}
              <div className="pwa-card rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <ShoppingCart className="h-3 w-3" />
                  Pedidos no mês
                </div>
                <p className="mt-1 inline-flex items-baseline gap-2 whitespace-nowrap text-base font-bold text-white">
                  <span>{fmt(totalOrders)}</span>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums"
                    title={`Comparação no mesmo período do mês anterior: ${fmt(ordersComparison.currentSamePeriodOrders)} vs ${fmt(ordersComparison.previousSamePeriodOrders)}`}
                  >
                    {ordersComparison.hasBaseline ? (
                      <>
                        {ordersComparison.trend === 'up' ? (
                          <TrendingUp className="h-3 w-3 text-emerald-300" />
                        ) : ordersComparison.trend === 'down' ? (
                          <TrendingDown className="h-3 w-3 text-amber-300" />
                        ) : (
                          <Minus className="h-3 w-3 text-surface-300" />
                        )}
                        <span
                          className={
                            ordersComparison.trend === 'up'
                              ? 'text-emerald-300'
                              : ordersComparison.trend === 'down'
                              ? 'text-amber-300'
                              : 'text-surface-300'
                          }
                        >
                          {`${ordersComparison.deltaPct >= 0 ? '+' : ''}${fmt(ordersComparison.deltaPct, 1)}%`}
                        </span>
                      </>
                    ) : (
                      <span>sem base</span>
                    )}
                  </span>
                </p>
              </div>

              {/* Peso */}
              <div className="pwa-card rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <Weight className="h-3 w-3" />
                  Peso total bruto
                </div>
                <p className="mt-1 text-base font-bold text-white whitespace-nowrap">
                  {fmt(totalWeight, 2)}
                  <span className="ml-1 text-xs font-semibold text-surface-400">kg</span>
                </p>
              </div>

              {/* Valor */}
              <div className="pwa-card col-span-2 rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                    <DollarSign className="h-3 w-3" />
                    Valor Total dos Pedidos
                  </div>
                  <span className={`max-w-45 text-right text-[11px] font-semibold leading-tight tabular-nums ${
                    totalTarget <= 0
                      ? 'text-surface-300'
                      : targetGapValue >= 0
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                  }`}>
                    {valueGapLabel}
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold text-white">{fmtBrl(totalRevenue)}</p>
              </div>
            </div>

            {/* ── Seller cards ───────────────────────────────────────────── */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                <Users className="h-4 w-4 text-surface-500" />
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Vendedores</p>
                <span className="ml-auto text-xs font-semibold tabular-nums text-surface-300">{sellers.length}</span>
              </div>

              {sellerCards.map(({ seller, target, cyclePct, financialPct, status, clients, kpiProgress, weightTargetKg }, idx) => {
                const cfg = STATUS_CONFIG[status]
                const isExpanded = expandedSeller === seller.id

                return (
                  <div
                    key={seller.id}
                    className={`pwa-seller-card overflow-hidden rounded-2xl border transition-all duration-200 ${cfg.border} ${cfg.bg}`}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {/* Seller header row */}
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left active:opacity-80"
                      style={{ touchAction: 'pan-y' }}
                      onClick={() => setExpandedSeller(isExpanded ? null : seller.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-800 text-xs font-bold text-surface-300">
                          {idx + 1}
                        </div>

                        {/* Name */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{seller.name.split(' ').slice(0, 3).join(' ')}</p>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-800/95 ring-1 ring-white/10">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
                              style={{ width: `${Math.min(cyclePct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* PCT + chevron */}
                        <div className="shrink-0 text-right">
                          <p className={`text-base font-extrabold tabular-nums tracking-tight ${cfg.pctColor}`}>{fmtPct(cyclePct)}</p>
                          {isExpanded ? (
                            <ChevronUp className="ml-auto h-3.5 w-3.5 text-surface-500" />
                          ) : (
                            <ChevronDown className="ml-auto h-3.5 w-3.5 text-surface-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded stats */}
                    {isExpanded && (
                      <div className="border-t border-surface-700/40 px-4 pb-4 pt-3" style={{ touchAction: 'pan-y' }}>
                        <div className="grid grid-cols-2 gap-2">
                          <MetricCell
                            icon={<DollarSign className="h-3.5 w-3.5" />}
                            label="Vlr. dos Pedidos"
                            value={fmtBrl(seller.totalValue)}
                            highlight={getProgressHighlight(financialPct)}
                          />
                          <MetricCell icon={<Target className="h-3.5 w-3.5" />} label="Meta" value={target > 0 ? fmtBrl(target) : '—'} />
                          <MetricCell icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Pedidos" value={fmt(seller.totalOrders)} />
                          <MetricCell icon={<Users className="h-3.5 w-3.5" />} label="Clientes" value={`${fmt(clients)}/${fmt(seller.baseClientCount)}`} />
                          <MetricCell
                            icon={<Weight className="h-3.5 w-3.5" />}
                            label="Peso Bruto"
                            value={fmtKg(seller.totalGrossWeight)}
                            highlight={getProgressHighlight(weightTargetKg > 0 ? (seller.totalGrossWeight / weightTargetKg) * 100 : 0)}
                          />
                          <MetricCell
                            icon={<Weight className="h-3.5 w-3.5" />}
                            label="Meta de Peso"
                            value={weightTargetKg > 0 ? fmtKg(weightTargetKg) : '—'}
                            highlight="none"
                          />
                        </div>

                        {/* Gap info */}
                        {target > 0 && financialPct < 100 && (
                          <div className="mt-2 rounded-lg bg-surface-800/60 px-3 py-2">
                            <p className="text-[10px] text-surface-400">
                              Faltam{' '}
                              <span className="font-semibold text-white">{fmtBrl(target - seller.totalValue)}</span>
                              {' '}para bater a meta financeira
                            </p>
                          </div>
                        )}
                        {financialPct > 100 && (
                          <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                            <p className="text-[10px] text-emerald-300">
                              <span className="font-semibold">{fmtBrl(seller.totalValue - target)}</span>
                              {' '}acima da meta
                            </p>
                          </div>
                        )}

                        {/* Weight gap info */}
                        {weightTargetKg > 0 && seller.totalGrossWeight < weightTargetKg && (
                          <div className="mt-2 rounded-lg bg-surface-800/60 px-3 py-2">
                            <p className="text-[10px] text-surface-400">
                              Faltam{' '}
                              <span className="font-semibold text-white">{fmtKg(weightTargetKg - seller.totalGrossWeight)}</span>
                              {' '}para bater a meta de peso
                            </p>
                          </div>
                        )}
                        {weightTargetKg > 0 && seller.totalGrossWeight >= weightTargetKg && (
                          <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                            <p className="text-[10px] text-emerald-300">
                              <span className="font-semibold">{fmtKg(seller.totalGrossWeight - weightTargetKg)}</span>
                              {' '}acima da meta de peso
                            </p>
                          </div>
                        )}

                        {/* ── KPI progress section ──────────────────────── */}
                        {kpiProgress.length > 0 && (
                          <KpiStagesPanel kpiProgress={kpiProgress} cycleWeeks={cycleWeeks} todayIso={todayIso} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {sellers.length === 0 && loadState === 'success' && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users className="h-10 w-10 text-surface-700" />
                <p className="text-sm text-surface-500">Nenhum vendedor encontrado para este período.</p>
              </div>
            )}
          </>
        )}
        {/* Footer */}
        <PwaFooter />
      </main>

      <PwaLogoutConfirmDialog
        open={showSignOutConfirm}
        busy={isSigningOut}
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={signOut}
      />
      <PwaSigningOutOverlay visible={isSigningOut} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
type MetricHighlight = 'success' | 'warn' | 'danger' | 'attention' | 'none'

function getProgressHighlight(pct: number): MetricHighlight {
  if (pct >= 100) return 'success'
  if (pct >= 75) return 'warn'
  if (pct >= 25) return 'attention'
  return 'danger'
}

function MetricCell({ icon, label, value, highlight = 'none' }: { icon: React.ReactNode; label: string; value: string; highlight?: MetricHighlight }) {
  const valueColor =
    highlight === 'success'   ? 'text-emerald-400' :
    highlight === 'warn'      ? 'text-amber-400'   :
    highlight === 'attention' ? 'text-orange-400'  :
    highlight === 'danger'    ? 'text-red-400'     :
    'text-white'
  const borderAccent = 'border border-surface-700/50 bg-surface-800/60'
  return (
    <div className={`rounded-lg px-2.5 py-2 ${borderAccent}`}>
      <div className="flex items-center gap-1 text-surface-400">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-0.5 text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

function PremioCell({ pct, profileType, earnedReward, maxReward }: { pct: number; profileType: string; earnedReward: number; maxReward: number }) {
  const highlight: MetricHighlight = pct >= 100 ? 'success' : pct >= 75 ? 'warn' : 'none'
  const valueColor =
    highlight === 'success' ? 'text-emerald-400' :
    highlight === 'warn'    ? 'text-amber-400'   :
    'text-white'
  const borderAccent =
    highlight === 'success' ? 'border border-emerald-500/25 bg-emerald-500/5' :
    highlight === 'warn'    ? 'border border-amber-500/25 bg-amber-500/5'     :
    'bg-surface-800/60'
  const earned = estimatePremioEarned(profileType, pct, earnedReward)
  const max = estimatePremioMax(profileType, maxReward)
  return (
    <div className={`rounded-lg px-2.5 py-2 ${borderAccent}`}>
      <div className="flex items-center gap-1 text-surface-400">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">Est. Premiação</span>
      </div>
      <p className={`mt-0.5 text-sm font-semibold ${valueColor}`}>
        {earned}
        {max && <span className="ml-1 text-[10px] font-normal text-surface-500">{max}</span>}
      </p>
    </div>
  )
}

/* ── KPI Stages Panel ────────────────────────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  W1: '1ª Semana',
  W2: '2ª Semana',
  W3: '3ª Semana',
  CLOSING: 'Fechamento',
}

const KPI_TYPE_ICON: Record<string, React.ElementType> = {
  META_FINANCEIRA: DollarSign,
  BASE_CLIENTES:  Users,
  VOLUME:         Package,
  DISTRIBUICAO:   LayoutGrid,
  ITEM_FOCO:      Star,
  DEVOLUCAO:      RotateCcw,
  INADIMPLENCIA:  Ban,
  RENTABILIDADE:  BarChart2,
}

function KpiStagesPanel({ kpiProgress, cycleWeeks, todayIso }: {
  kpiProgress: KpiProgress[]
  cycleWeeks: CycleWeek[]
  todayIso: string
}) {
  const [expandedKpiIds, setExpandedKpiIds] = useState<Record<string, boolean>>({})
  const stages = ['W1', 'W2', 'W3', 'CLOSING'] as const
  const grouped = stages
    .map((key) => ({
      key,
      label: STAGE_LABELS[key],
      week: cycleWeeks.find((w) => w.key === key) ?? null,
      items: kpiProgress.filter((k) => k.stage === key),
    }))
    .filter((s) => s.items.length > 0)

  if (grouped.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-surface-700/60" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-500">Metas do Ciclo</span>
        <div className="h-px flex-1 bg-surface-700/60" />
      </div>

      {grouped.map(({ key, label, week, items }) => {
        const isActive = !!week && week.start <= todayIso && week.end >= todayIso
        const isEnded  = !!week && week.end < todayIso
        const isPending = !!week && week.start > todayIso
        const paletteByStage: Record<string, {
          container: string
          badge: string
          status: string
          statusDot: string
          row: string
          count: string
        }> = {
          W1: {
            container: 'rounded-xl border border-emerald-300/35 bg-linear-to-br from-emerald-500/18 via-teal-500/10 to-cyan-500/8 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(6,78,59,0.22)]',
            badge: 'bg-linear-to-r from-emerald-500/32 to-teal-500/24 text-emerald-100 ring-1 ring-emerald-200/20',
            status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200',
            statusDot: 'h-1.5 w-1.5 rounded-full bg-emerald-300/95',
            row: 'rounded-lg border border-emerald-300/22 bg-surface-950/36 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            count: 'text-emerald-100',
          },
          W2: {
            container: 'rounded-xl border border-cyan-300/34 bg-linear-to-br from-cyan-500/16 via-sky-500/10 to-blue-500/8 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(12,74,110,0.24)]',
            badge: 'bg-linear-to-r from-cyan-500/30 to-sky-500/24 text-cyan-100 ring-1 ring-cyan-200/20',
            status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-200',
            statusDot: 'h-1.5 w-1.5 rounded-full bg-cyan-300/95',
            row: 'rounded-lg border border-cyan-300/20 bg-surface-950/36 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            count: 'text-cyan-100',
          },
          W3: {
            container: 'rounded-xl border border-lime-300/30 bg-linear-to-br from-lime-500/16 via-emerald-500/10 to-amber-500/8 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(77,124,15,0.24)]',
            badge: 'bg-linear-to-r from-lime-500/28 to-emerald-500/22 text-lime-100 ring-1 ring-lime-200/20',
            status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-200',
            statusDot: 'h-1.5 w-1.5 rounded-full bg-lime-300/95',
            row: 'rounded-lg border border-lime-300/18 bg-surface-950/36 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            count: 'text-lime-100',
          },
          CLOSING: {
            container: 'rounded-xl border border-amber-300/32 bg-linear-to-br from-amber-500/18 via-yellow-500/10 to-orange-500/8 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(146,64,14,0.24)]',
            badge: 'bg-linear-to-r from-amber-500/30 to-orange-500/24 text-amber-100 ring-1 ring-amber-200/20',
            status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200',
            statusDot: 'h-1.5 w-1.5 rounded-full bg-amber-300/95',
            row: 'rounded-lg border border-amber-300/20 bg-surface-950/36 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            count: 'text-amber-100',
          },
        }
        const baseStageStyle = paletteByStage[key] ?? {
          container: 'rounded-xl border border-surface-700/60 bg-surface-800/30 p-2.5',
          badge: 'bg-surface-700 text-surface-300',
          status: 'inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-surface-300',
          statusDot: 'h-1.5 w-1.5 rounded-full bg-surface-400',
          row: 'rounded-lg border border-surface-700/30 bg-surface-900/55 px-3 py-2',
          count: 'text-surface-200',
        }
        const stageStateTone = isPending ? 'opacity-82 saturate-75' : isEnded ? 'opacity-94 saturate-90' : isActive ? 'ring-1 ring-white/10' : ''
        const stageStyle = {
          ...baseStageStyle,
          container: `${baseStageStyle.container} ${stageStateTone}`.trim(),
          row: `${baseStageStyle.row} ${isPending ? 'opacity-88' : ''}`.trim(),
        }

        const hitCount = items.filter((i) => i.isComputable && i.progress >= 1).length
        const computableCount = items.filter((i) => i.isComputable).length

        return (
          <div key={key} className={stageStyle.container}>
            {/* Stage header */}
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${stageStyle.badge}`}>
                  {label}
                </span>
                {isActive && (
                  <span className={stageStyle.status}>
                    <span className={stageStyle.statusDot} aria-hidden="true" />
                    Em andamento
                  </span>
                )}
                {isEnded && (
                  <span className={stageStyle.status}>
                    <span className={stageStyle.statusDot} aria-hidden="true" />
                    Etapa encerrada
                  </span>
                )}
                {isPending && (
                  <span className={stageStyle.status}>
                    <span className={stageStyle.statusDot} aria-hidden="true" />
                    Aguardando
                  </span>
                )}
              </div>
              {computableCount > 0 && (
                <span className={`text-[10px] font-semibold ${hitCount === computableCount ? 'text-emerald-300' : stageStyle.count}`}>
                  {hitCount}/{computableCount}
                </span>
              )}
            </div>

            {/* KPI rows */}
            <div className="space-y-1.5">
              {items.map((kpi) => {
                const Icon = KPI_TYPE_ICON[kpi.kpiType] ?? Target
                const pctDisplay = Math.min(kpi.progress * 100, 100)
                const isHit = kpi.isComputable && kpi.progress >= 1
                const isDetailOpen = Boolean(expandedKpiIds[kpi.ruleId])
                const volumeMetaDefinida = kpi.kpiType === 'VOLUME'
                  ? kpi.details.rows.find((row) => row.label === 'Meta definida')?.value
                  : null
                const volumeQuantidadeAtingida = kpi.kpiType === 'VOLUME'
                  ? kpi.details.rows.find((row) => row.label === 'Quantidade atingida')?.value
                  : null
                const distribuicaoItensExigidos = kpi.kpiType === 'DISTRIBUICAO'
                  ? kpi.details.rows.find((row) => row.label === 'Itens exigidos')?.value
                  : null
                const distribuicaoItensVendidos = kpi.kpiType === 'DISTRIBUICAO'
                  ? kpi.details.rows.find((row) => row.label === 'Itens vendidos')?.value
                  : null
                const distribuicaoClientesExigidos = kpi.kpiType === 'DISTRIBUICAO'
                  ? kpi.details.rows.find((row) => row.label === 'Clientes exigidos')?.value
                  : null
                const distribuicaoClientesComItem = kpi.kpiType === 'DISTRIBUICAO'
                  ? kpi.details.rows.find((row) => row.label === 'Clientes com item')?.value
                  : null
                const baseTotal = kpi.kpiType === 'BASE_CLIENTES'
                  ? kpi.details.rows.find((row) => row.label === 'Base total')?.value
                  : null
                const baseMetaClientes = kpi.kpiType === 'BASE_CLIENTES'
                  ? kpi.details.rows.find((row) => row.label === 'Meta de clientes')?.value
                  : null
                const baseClientesAtendidos = kpi.kpiType === 'BASE_CLIENTES'
                  ? kpi.details.rows.find((row) => row.label === 'Clientes atendidos')?.value
                  : null
                const financeiroMetaEtapa = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Meta da etapa')?.value
                    ?? kpi.details.rows.find((row) => row.label === 'Meta total')?.value
                    ?? kpi.details.rows.find((row) => row.label === 'Meta 120%')?.value)
                  : null
                const financeiroMetaLabel = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Meta 120%')
                    ? 'Meta 120%'
                    : kpi.details.rows.find((row) => row.label === 'Meta total')
                      ? 'Meta total'
                      : 'Meta da etapa')
                  : 'Meta da etapa'
                const financeiroRealizado = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Realizado')?.value
                    ?? kpi.details.rows.find((row) => row.label === 'Atingido')?.value
                    ?? kpi.details.rows.find((row) => row.label === 'Atingido total')?.value)
                  : null
                const financeiroRealizadoLabel = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Atingido total')
                    ? 'Atingido total'
                    : kpi.details.rows.find((row) => row.label === 'Atingido')
                      ? 'Atingido'
                      : 'Realizado')
                  : 'Realizado'
                const financeiroExtraDelta = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Excedente da meta')?.value
                    ?? kpi.details.rows.find((row) => row.label === 'Falta para meta extra')?.value)
                  : null
                const financeiroExtraDeltaLabel = kpi.kpiType === 'META_FINANCEIRA'
                  ? (kpi.details.rows.find((row) => row.label === 'Excedente da meta')
                    ? 'Excedente da meta'
                    : kpi.details.rows.find((row) => row.label === 'Falta para meta extra')
                      ? 'Falta para meta extra'
                      : null)
                  : null
                const financeiroFalta = kpi.kpiType === 'META_FINANCEIRA'
                  ? kpi.details.rows.find((row) => row.label === 'Falta para bater')?.value
                  : null
                const financeiroDiasRestantes = kpi.kpiType === 'META_FINANCEIRA'
                  ? kpi.details.rows.find((row) => row.label === 'Dias úteis restantes')?.value
                  : null
                const financeiroMediaDia = kpi.kpiType === 'META_FINANCEIRA'
                  ? kpi.details.rows.find((row) => row.label === 'Recomendado para vender hoje')?.value
                  : null
                const parseLocaleNumber = (value: string | null | undefined) => {
                  if (!value) return 0
                  const normalized = value
                    .replace(/[^\d,.-]/g, '')
                    .replace(/\./g, '')
                    .replace(',', '.')
                  const parsed = Number(normalized)
                  return Number.isFinite(parsed) ? parsed : 0
                }
                const showFinanceFalta = parseLocaleNumber(financeiroFalta) > 0
                const showFinanceDiasRestantes = parseLocaleNumber(financeiroDiasRestantes) > 0
                const showFinanceMediaDia = parseLocaleNumber(financeiroMediaDia) > 0 && isActive
                const detailRows = kpi.details.rows.filter((row) => {
                  if (kpi.kpiType === 'VOLUME') {
                    return row.label !== 'Meta definida' && row.label !== 'Quantidade atingida'
                  }
                  if (kpi.kpiType === 'DISTRIBUICAO') {
                    return !['Itens exigidos', 'Itens vendidos', 'Clientes exigidos', 'Clientes com item'].includes(row.label)
                  }
                  if (kpi.kpiType === 'BASE_CLIENTES') {
                    return !['Base total', 'Meta de clientes', 'Clientes atendidos', 'Faltantes'].includes(row.label)
                  }
                  if (kpi.kpiType === 'META_FINANCEIRA') {
                    return ![
                      'Meta da etapa',
                      'Meta total',
                      'Meta 120%',
                      'Realizado',
                      'Atingido',
                      'Atingido total',
                      'Excedente da meta',
                      'Falta para meta extra',
                      'Falta para bater',
                      'Dias úteis restantes',
                      'Recomendado para vender hoje',
                    ].includes(row.label)
                  }
                  return true
                })
                const detailPairs: Array<Array<{ label: string; value: string }>> = []
                for (let i = 0; i < detailRows.length; i += 2) {
                  detailPairs.push(detailRows.slice(i, i + 2))
                }

                const barColor = !kpi.isComputable || isPending
                  ? 'bg-linear-to-r from-surface-500 to-surface-400'
                  : isHit
                  ? 'bg-linear-to-r from-emerald-400 to-lime-300 shadow-[0_0_8px_rgba(52,211,153,0.28)]'
                  : pctDisplay >= 70
                  ? 'bg-linear-to-r from-amber-300 to-orange-300 shadow-[0_0_8px_rgba(251,191,36,0.24)]'
                  : 'bg-linear-to-r from-rose-400 to-red-400 shadow-[0_0_8px_rgba(251,113,133,0.24)]'

                const pctColor = !kpi.isComputable || isPending
                  ? 'text-surface-500'
                  : isHit
                  ? 'bg-linear-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent'
                  : pctDisplay >= 70
                  ? 'bg-linear-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent'
                  : 'bg-linear-to-r from-rose-300 to-red-300 bg-clip-text text-transparent'

                return (
                  <div key={kpi.ruleId} className={stageStyle.row}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedKpiIds((prev) => ({
                          ...prev,
                          [kpi.ruleId]: !prev[kpi.ruleId],
                        }))
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Icon className="h-3 w-3 shrink-0 text-surface-400" />
                          <span className="truncate text-[11px] font-medium text-surface-200">{kpi.kpi}</span>
                          <span className="shrink-0 text-[10px] text-surface-500">({kpi.targetText})</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isHit && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                          <span className={`text-[11px] font-bold ${pctColor}`}>
                            {kpi.isComputable && !isPending
                              ? `${fmt(pctDisplay, 0)}%`
                              : isPending ? '-' : '?'
                            }
                          </span>
                          {isDetailOpen ? (
                            <ChevronUp className="h-3.5 w-3.5 text-surface-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-800/95 ring-1 ring-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: kpi.isComputable && !isPending ? `${pctDisplay}%` : '0%' }}
                      />
                    </div>
                    {!kpi.isComputable && !isPending && (
                      <p className="mt-0.5 text-[9px] text-surface-600">Requer dados adicionais</p>
                    )}
                    {isDetailOpen && (
                      <div className="mt-2 space-y-2">
                        {kpi.kpiType === 'VOLUME' && volumeMetaDefinida !== null && volumeQuantidadeAtingida !== null && (
                          <div className="rounded-md border border-emerald-500/25 bg-linear-to-r from-emerald-500/12 via-cyan-500/10 to-emerald-500/12 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">Meta definida</p>
                                <p className="text-sm font-bold text-white">{volumeMetaDefinida}</p>
                              </div>
                              <div className="h-7 w-px shrink-0 bg-emerald-300/25" />
                              <div className="min-w-0 text-right">
                                <p className="text-[9px] uppercase tracking-wider text-cyan-100/90">Quantidade atingida</p>
                                <p className="text-sm font-bold text-cyan-200">{volumeQuantidadeAtingida}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {kpi.kpiType === 'DISTRIBUICAO' &&
                          distribuicaoItensExigidos !== null &&
                          distribuicaoItensVendidos !== null &&
                          distribuicaoClientesExigidos !== null &&
                          distribuicaoClientesComItem !== null && (
                          <div className="space-y-1.5">
                            <div className="rounded-md border border-cyan-500/25 bg-linear-to-r from-cyan-500/12 via-sky-500/10 to-cyan-500/12 px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Itens exigidos</p>
                                  <p className="text-sm font-bold text-white">{distribuicaoItensExigidos}</p>
                                </div>
                                <div className="h-7 w-px shrink-0 bg-cyan-300/25" />
                                <div className="min-w-0 text-right">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Itens positivados</p>
                                  <p className="text-sm font-bold text-cyan-200">{distribuicaoItensVendidos}</p>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-md border border-cyan-500/25 bg-linear-to-r from-cyan-500/12 via-sky-500/10 to-cyan-500/12 px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Clientes exigidos</p>
                                  <p className="text-sm font-bold text-white">{distribuicaoClientesExigidos}</p>
                                </div>
                                <div className="h-7 w-px shrink-0 bg-cyan-300/25" />
                                <div className="min-w-0 text-right">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Clientes com item positivado</p>
                                  <p className="text-sm font-bold text-cyan-200">{distribuicaoClientesComItem}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {kpi.kpiType === 'BASE_CLIENTES' && baseTotal !== null && baseMetaClientes !== null && baseClientesAtendidos !== null && (
                          <div className="space-y-1.5">
                            <div className="rounded-md border border-cyan-500/25 bg-linear-to-r from-cyan-500/12 via-sky-500/10 to-cyan-500/12 px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Base total</p>
                                  <p className="text-sm font-bold text-white">{baseTotal}</p>
                                </div>
                                <div className="h-7 w-px shrink-0 bg-cyan-300/25" />
                                <div className="min-w-0 text-right">
                                  <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Meta de clientes</p>
                                  <p className="text-sm font-bold text-cyan-200">{baseMetaClientes}</p>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-md border border-cyan-500/25 bg-linear-to-r from-cyan-500/12 via-sky-500/10 to-cyan-500/12 px-2 py-1.5">
                              <p className="text-[9px] uppercase tracking-wider text-cyan-200/90">Clientes atendidos</p>
                              <p className="text-sm font-bold text-cyan-100">{baseClientesAtendidos}</p>
                            </div>
                          </div>
                        )}

                        {kpi.kpiType === 'META_FINANCEIRA' && financeiroMetaEtapa !== null && financeiroRealizado !== null && financeiroFalta !== null && financeiroDiasRestantes !== null && financeiroMediaDia !== null && (
                          <div className="space-y-1.5">
                            <div className="rounded-md border border-emerald-500/25 bg-linear-to-r from-emerald-500/12 via-teal-500/10 to-emerald-500/12 px-2.5 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">{financeiroMetaLabel}</p>
                                  <p className="text-sm font-bold text-white">{financeiroMetaEtapa}</p>
                                </div>
                                <div className="h-7 w-px shrink-0 bg-emerald-300/25" />
                                <div className="min-w-0 text-right">
                                  <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">{financeiroRealizadoLabel}</p>
                                  <p className="text-sm font-bold text-cyan-200">{financeiroRealizado}</p>
                                </div>
                              </div>
                            </div>
                            {financeiroExtraDelta && financeiroExtraDeltaLabel && (
                              <div className="rounded-md border border-emerald-500/25 bg-linear-to-r from-emerald-500/12 via-teal-500/10 to-emerald-500/12 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">{financeiroExtraDeltaLabel}</p>
                                <p className="text-sm font-bold text-emerald-100">{financeiroExtraDelta}</p>
                              </div>
                            )}
                            {showFinanceFalta && (
                              <div className="rounded-md border border-emerald-500/20 bg-linear-to-r from-emerald-500/10 via-teal-500/9 to-emerald-500/10 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">Falta para bater</p>
                                <p className="text-sm font-bold text-amber-200">{financeiroFalta}</p>
                              </div>
                            )}
                            {showFinanceMediaDia && (
                              <div className="rounded-md border border-emerald-500/25 bg-linear-to-r from-emerald-500/12 via-teal-500/10 to-emerald-500/12 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">Recomendado para vender hoje</p>
                                <p className="text-sm font-bold text-emerald-100">{financeiroMediaDia}</p>
                              </div>
                            )}
                            {showFinanceDiasRestantes && (
                              <div className="rounded-md border border-emerald-500/20 bg-linear-to-r from-emerald-500/9 via-teal-500/8 to-emerald-500/9 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-200/90">Dias úteis restantes</p>
                                <p className="text-sm font-bold text-white">{financeiroDiasRestantes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {detailRows.length > 0 && (
                          <div className="space-y-1.5">
                            {detailPairs.map((pair, pairIndex) => (
                              <div
                                key={`${kpi.ruleId}-detail-pair-${pairIndex}`}
                                className="rounded-md border border-emerald-400/25 bg-linear-to-r from-emerald-500/11 via-teal-500/10 to-emerald-500/11 px-2 py-1.5"
                              >
                                {pair.length === 2 ? (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[9px] uppercase tracking-wider text-emerald-100/80">{pair[0]?.label}</p>
                                      <p className="text-sm font-bold text-white">{pair[0]?.value}</p>
                                    </div>
                                    <div className="h-7 w-px shrink-0 bg-emerald-300/25" />
                                    <div className="min-w-0 text-right">
                                      <p className="text-[9px] uppercase tracking-wider text-emerald-100/80">{pair[1]?.label}</p>
                                      <p className="text-sm font-bold text-emerald-100">{pair[1]?.value}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="min-w-0">
                                    <p className="text-[9px] uppercase tracking-wider text-emerald-100/80">{pair[0]?.label}</p>
                                    <p className="text-sm font-bold text-emerald-100">{pair[0]?.value}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {kpi.details.volumeGroups && kpi.details.volumeGroups.length > 0 && (
                          <div className="rounded-md border border-cyan-500/20 bg-cyan-500/7 p-2">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Progresso por grupo de produto</p>
                            <div className="mt-1.5 space-y-1.5">
                              {kpi.details.volumeGroups.map((group) => (
                                <div key={`${kpi.ruleId}-group-${group.brand}`} className="rounded-md bg-surface-800/55 px-2 py-1.5">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="truncate text-[10px] font-semibold text-surface-100">{group.brand}</span>
                                    <span className="text-[10px] font-semibold text-cyan-200">{fmt(group.progressPct, 1)}%</span>
                                  </div>
                                  <div className="h-1 overflow-hidden rounded-full bg-surface-700/70">
                                    <div
                                      className={`h-full rounded-full ${group.progressPct >= 100 ? 'bg-emerald-400' : group.progressPct >= 75 ? 'bg-cyan-400' : 'bg-amber-300'}`}
                                      style={{ width: `${Math.max(0, Math.min(group.progressPct, 100))}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-[9px] text-surface-400">
                                    <span>Meta: {fmt(group.targetKg, 2)} kg</span>
                                    <span>Vendido: {fmt(group.soldKg, 2)} kg</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
