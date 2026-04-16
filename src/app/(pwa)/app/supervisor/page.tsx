'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { clearPwaClientState } from '@/lib/pwa/clear-client-state'
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

type BrandWeightRow = { sellerCode: string; brand: string; totalKg: number }
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
  SUPEROU:  { label: 'Superou',    color: 'text-sky-400',     pctColor: 'bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     barColor: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 shadow-[0_0_10px_rgba(56,189,248,0.28)]',     Icon: TrendingUp },
  NO_ALVO:  { label: 'Meta Batida', color: 'text-emerald-400', pctColor: 'bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', barColor: 'bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_10px_rgba(52,211,153,0.28)]', Icon: CheckCircle2 },
  QUASE_LA: { label: 'Quase Lá',   color: 'text-cyan-400',    pctColor: 'bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    barColor: 'bg-gradient-to-r from-cyan-400 to-teal-300 shadow-[0_0_10px_rgba(34,211,238,0.26)]',    Icon: TrendingUp },
  ATENCAO:  { label: 'Atenção',    color: 'text-amber-400',   pctColor: 'bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   barColor: 'bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_0_10px_rgba(251,191,36,0.24)]',   Icon: Clock },
  CRITICO:  { label: 'Crítico',    color: 'text-rose-400',    pctColor: 'bg-gradient-to-r from-rose-300 to-red-300 bg-clip-text text-transparent',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    barColor: 'bg-gradient-to-r from-rose-400 to-red-400 shadow-[0_0_10px_rgba(251,113,133,0.26)]',    Icon: AlertCircle },
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

  const brandWeightMap = new Map<string, number>()
  for (const row of brandWeightRows) {
    if (row.sellerCode === sellerCode) {
      const key = row.brand.toUpperCase()
      brandWeightMap.set(key, (brandWeightMap.get(key) ?? 0) + row.totalKg)
    }
  }
  const weightTargetRatios = weightTargets.map((wt) => {
    const sold = brandWeightMap.get(wt.brand.toUpperCase()) ?? 0
    return sold / Math.max(wt.targetKg, 0.00001)
  })

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
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const accumulated = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      progress = accumulated / (monthlyTarget * threshold)
    } else if (kpiType === 'BASE_CLIENTES') {
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const base = Math.max(baseClientCount, 1)
      const clients = new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
      progress = clients / (base * threshold)
    } else if (kpiType === 'VOLUME') {
      const requiredGroups = Math.max(Math.floor(parseFloat(rule.targetText) || 0), 0)
      if (requiredGroups > 0 && weightTargetRatios.length > 0) {
        const topRatios = [...weightTargetRatios].sort((a, b) => b - a).slice(0, requiredGroups)
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
  const brandWeightMap = new Map<string, number>()
  for (const row of brandWeightRows) {
    if (row.sellerCode === sellerCode) {
      const key = row.brand.toUpperCase()
      brandWeightMap.set(key, (brandWeightMap.get(key) ?? 0) + row.totalKg)
    }
  }
  const weightTargetRatios = weightTargets.map((wt) => {
    const sold = brandWeightMap.get(wt.brand.toUpperCase()) ?? 0
    return sold / Math.max(wt.targetKg, 0.00001)
  })

  return rules.map((rule) => {
    const week = cycleWeeks.find((w) => w.key === rule.stage)
    const stageStarted = !!week && week.start <= todayIso
    const stageEnded = !!week && week.end < todayIso

    if (!week) return { ruleId: rule.id, stage: rule.stage, kpi: rule.kpi, kpiType: rule.kpiType, targetText: rule.targetText, rewardValue: rule.rewardValue, progress: 0, isComputable: false, stageStarted: false, stageEnded: false }

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
      return { ruleId: rule.id, stage: rule.stage, kpi: rule.kpi, kpiType, targetText: rule.targetText, rewardValue: rule.rewardValue, progress: 0, isComputable: false, stageStarted, stageEnded }
    }

    if (!stageStarted) {
      return { ruleId: rule.id, stage: rule.stage, kpi: rule.kpi, kpiType, targetText: rule.targetText, rewardValue: rule.rewardValue, progress: 0, isComputable: true, stageStarted, stageEnded }
    }

    const stageEnd = week.end
    const ordersUpToStage = orders.filter((o) => o.negotiatedAt <= stageEnd)
    let progress = 0

    if (kpiType === 'META_FINANCEIRA') {
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const accumulated = ordersUpToStage.reduce((s, o) => s + o.totalValue, 0)
      progress = monthlyTarget > 0 ? accumulated / (monthlyTarget * threshold) : 0
    } else if (kpiType === 'BASE_CLIENTES') {
      const rawNum = parseFloat(rule.targetText.replace('%', '').replace(',', '.')) || 0
      const threshold = rawNum > 0 ? rawNum / 100 : 1
      const base = Math.max(baseClientCount, 1)
      const clients = new Set(ordersUpToStage.map((o) => o.clientCode).filter(Boolean)).size
      progress = clients / (base * threshold)
    } else if (kpiType === 'VOLUME') {
      const requiredGroups = Math.max(Math.floor(parseFloat(rule.targetText) || 0), 0)
      if (requiredGroups > 0 && weightTargetRatios.length > 0) {
        const topRatios = [...weightTargetRatios].sort((a, b) => b - a).slice(0, requiredGroups)
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
    }

    return { ruleId: rule.id, stage: rule.stage, kpi: rule.kpi, kpiType, targetText: rule.targetText, rewardValue: rule.rewardValue, progress: Math.min(progress, 1.4), isComputable: true, stageStarted, stageEnded }
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
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) { router.replace('/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        if (roleCode !== 'COMMERCIAL_SUPERVISOR') { router.replace('/app'); return }
        setUser({
          name: data.user.name,
          role: data.user.role,
          roleCode,
          sellerCode: data.user.sellerCode,
        })
      })
      .catch(() => router.replace('/login'))
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
    setLoadState('loading')
    setError('')
    try {
      const prevPeriod = getPreviousPeriod(year, month)
      const [perfRes, summaryRes, brandWeightRes, distributionRes, prevPerfRes] = await Promise.all([
        fetch(`/api/metas/sellers-performance?year=${year}&month=${month}&companyScope=all`, { cache: 'no-store' }),
        fetch(`/api/pwa/summary?year=${year}&month=${month}`, { cache: 'no-store' }),
        fetch(`/api/metas/sellers-performance/brand-weight?year=${year}&month=${month}&companyScope=all`, { cache: 'no-store' }),
        fetch(`/api/metas/sellers-performance/item-distribution?year=${year}&month=${month}&companyScope=all`, { cache: 'no-store' }),
        fetch(`/api/metas/sellers-performance?year=${prevPeriod.year}&month=${prevPeriod.month}&companyScope=all`, { cache: 'no-store' }),
      ])

      if (!perfRes.ok) {
        const d = await perfRes.json().catch(() => ({}))
        throw new Error(d.message ?? `Erro ${perfRes.status}`)
      }

      const [perfData, summaryData, brandWeightData, distributionData, prevPerfData] = await Promise.all([
        perfRes.json(),
        summaryRes.ok ? summaryRes.json() : Promise.resolve(null),
        brandWeightRes.ok ? brandWeightRes.json() : Promise.resolve(null),
        distributionRes.ok ? distributionRes.json() : Promise.resolve(null),
        prevPerfRes.ok ? prevPerfRes.json() : Promise.resolve(null),
      ])

      setSellers(perfData.sellers ?? [])
      setPreviousMonthSellers((prevPerfData?.sellers ?? []) as SellerRow[])
      setBrandWeightRows(brandWeightData?.rows ?? [])

      // Build monthly targets map from summary
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
      setMonthlyTargets(targets)
      setProfileTypes(ptypes)
      setMaxRewards(mrewards)
      setSellerRules(srules)
      setWeightTargetsBySeller(swtargets)
      setFocusConfigBySeller(sfocus)
      setDistributionRows((distributionData?.rows ?? []) as SellerDistributionRow[])
      setDistributionSellerItemsRows((distributionData?.sellerItems ?? []) as SellerDistributionItemsRow[])
      setDistributionProductCount(Number(distributionData?.diagnostics?.productCodesRequested ?? 0))

      if (focusCodes.size > 0) {
        const entries = await Promise.all(
          [...focusCodes].map(async (code) => {
            const res = await fetch(`/api/metas/sellers-performance/product-focus?year=${year}&month=${month}&companyScope=all&productCode=${encodeURIComponent(code)}`, { cache: 'no-store' })
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
        setFocusRowsByProduct(Object.fromEntries(entries))
      } else {
        setFocusRowsByProduct({})
      }
      if (Array.isArray(summaryData?.cycleWeeks)) setCycleWeeks(summaryData.cycleWeeks)
      setLastUpdated(new Date())
      setLoadState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.')
      setLoadState('error')
    }
  }, [year, month])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {})
    } finally {
      await clearPwaClientState()
      window.location.replace('/login')
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

  const todayIso = new Date().toISOString().slice(0, 10)

  const sellerCards = sellers.map((seller) => {
    const code = seller.id.replace(/^sankhya-/, '')
    const normalizedCode = normalizeCode(code)
    const target = monthlyTargets[code] ?? monthlyTargets[normalizedCode] ?? 0
    const pct = target > 0 ? (seller.totalValue / target) * 100 : 0
    const status = inferStatus(pct)
    const clients = countDistinctClients(seller)
    const profileType = profileTypes[code] ?? profileTypes[normalizedCode] ?? 'NOVATO'
    const maxReward = maxRewards[code] ?? maxRewards[normalizedCode] ?? 0
    const wTargets = weightTargetsBySeller[code] ?? weightTargetsBySeller[normalizedCode] ?? []
    const focusConfig = focusConfigBySeller[code] ?? focusConfigBySeller[normalizedCode] ?? null
    const earnedReward = computeEarnedReward(
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
    return { seller, code, target, pct, status, clients, profileType, maxReward, earnedReward, kpiProgress }
  }).sort((a, b) => b.pct - a.pct)

  const metaHit = sellerCards.filter((s) => s.status === 'SUPEROU' || s.status === 'NO_ALVO').length

  /* ── Render ─────────────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="pwa-shell flex min-h-dvh flex-col bg-surface-950 text-white">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="pwa-topbar sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <Image src="/branding/ouroverde.png" alt="Ouro Verde" fill sizes="48px" className="object-contain" />
            </div>
            <div className="h-9 w-px bg-surface-700/60" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold leading-tight text-white">{formatHeaderIdentity(user.name)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-300 leading-tight">SUPERVISOR COMERCIAL</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="pwa-offline-indicator flex h-9 w-9 items-center justify-center rounded-lg" title="Sem conexão com a internet" aria-label="Sem conexão com a internet">
                <CloudOff className="h-4.5 w-4.5" />
              </div>
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
              onClick={signOut}
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
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-8 pt-4 space-y-4">

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

        {/* Loading skeleton */}
        {loadState === 'loading' && sellers.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-800" />
            ))}
          </div>
        )}

        {loadState !== 'error' && (sellers.length > 0 || loadState === 'success') && (
          <>
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Meta de Faturamento */}
              <div className="pwa-card pwa-card-hero col-span-2 rounded-2xl border border-surface-700/50 bg-surface-900 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Meta Financeira</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                    overallPct >= 100
                      ? 'bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent'
                      : overallPct >= 75
                      ? 'bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent'
                      : overallPct >= 25
                      ? 'bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-rose-300 to-red-300 bg-clip-text text-transparent'
                  }`}>
                    {fmtPct(overallPct)}
                  </p>
                  <p className="text-xs text-surface-400">{metaHit}/{sellers.length} vendedores</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-800/95 ring-1 ring-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      overallPct >= 100
                        ? 'bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_10px_rgba(52,211,153,0.30)]'
                        : overallPct >= 75
                        ? 'bg-gradient-to-r from-cyan-400 to-teal-300 shadow-[0_0_10px_rgba(34,211,238,0.28)]'
                        : overallPct >= 25
                        ? 'bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_0_10px_rgba(251,191,36,0.26)]'
                        : 'bg-gradient-to-r from-rose-400 to-red-400 shadow-[0_0_10px_rgba(251,113,133,0.28)]'
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
                              ? 'bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent'
                              : ordersComparison.trend === 'down'
                              ? 'bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent'
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
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <DollarSign className="h-3 w-3" />
                  Valor Total dos Pedidos
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

              {sellerCards.map(({ seller, target, pct, status, clients, profileType, maxReward, earnedReward, kpiProgress }, idx) => {
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
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* PCT + chevron */}
                        <div className="shrink-0 text-right">
                          <p className={`text-base font-extrabold tabular-nums tracking-tight ${cfg.pctColor}`}>{fmtPct(pct)}</p>
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
                            highlight={pct >= 100 ? 'success' : 'none'}
                          />
                          <MetricCell icon={<Target className="h-3.5 w-3.5" />} label="Meta" value={target > 0 ? fmtBrl(target) : '—'} />
                          <MetricCell icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Pedidos" value={fmt(seller.totalOrders)} />
                          <MetricCell icon={<Users className="h-3.5 w-3.5" />} label="Clientes" value={`${fmt(clients)}/${fmt(seller.baseClientCount)}`} />
                          <MetricCell icon={<Weight className="h-3.5 w-3.5" />} label="Peso Bruto" value={fmtKg(seller.totalGrossWeight)} />
                          <PremioCell
                            pct={pct}
                            profileType={profileType}
                            earnedReward={earnedReward}
                            maxReward={maxReward}
                          />
                        </div>

                        {/* Gap info */}
                        {target > 0 && pct < 100 && (
                          <div className="mt-2 rounded-lg bg-surface-800/60 px-3 py-2">
                            <p className="text-[10px] text-surface-400">
                              Faltam{' '}
                              <span className="font-semibold text-white">{fmtBrl(target - seller.totalValue)}</span>
                              {' '}para bater a meta financeira
                            </p>
                          </div>
                        )}
                        {pct > 100 && (
                          <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                            <p className="text-[10px] text-emerald-300">
                              <span className="font-semibold">{fmtBrl(seller.totalValue - target)}</span>
                              {' '}acima da meta 🎯
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
      </main>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
type MetricHighlight = 'success' | 'warn' | 'none'

function MetricCell({ icon, label, value, highlight = 'none' }: { icon: React.ReactNode; label: string; value: string; highlight?: MetricHighlight }) {
  const valueColor =
    highlight === 'success' ? 'text-emerald-400' :
    highlight === 'warn'    ? 'text-amber-400'   :
    'text-white'
  const borderAccent =
    highlight === 'success' ? 'border border-emerald-500/25 bg-emerald-500/5' :
    highlight === 'warn'    ? 'border border-amber-500/25 bg-amber-500/5'     :
    'bg-surface-800/60'
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
        const stageStyle = isEnded
          ? {
              container: 'rounded-xl border border-slate-500/30 bg-slate-500/6 p-2.5',
              accent: 'bg-slate-300/70',
              badge: 'bg-slate-500/20 text-slate-200',
              status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300',
              statusDot: 'h-1.5 w-1.5 rounded-full bg-slate-300/80',
              row: 'rounded-lg border border-slate-500/20 bg-slate-950/35 px-3 py-2',
              count: 'text-slate-300',
            }
          : isActive
          ? {
              container: 'rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5',
              accent: 'bg-emerald-300/85',
              badge: 'bg-emerald-500/20 text-emerald-300',
              status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300',
              statusDot: 'h-1.5 w-1.5 rounded-full bg-emerald-300/90',
              row: 'rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2',
              count: 'text-emerald-300',
            }
          : isPending
          ? {
              container: 'rounded-xl border border-amber-500/30 bg-amber-500/8 p-2.5',
              accent: 'bg-amber-300/85',
              badge: 'bg-amber-500/20 text-amber-300',
              status: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300',
              statusDot: 'h-1.5 w-1.5 rounded-full bg-amber-300/90',
              row: 'rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2',
              count: 'text-amber-300',
            }
          : {
              container: 'rounded-xl border border-surface-700/60 bg-surface-800/30 p-2.5',
              accent: 'bg-surface-500/80',
              badge: 'bg-surface-700 text-surface-400',
              status: 'inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-surface-400',
              statusDot: 'h-1.5 w-1.5 rounded-full bg-surface-500',
              row: 'rounded-lg bg-surface-800/50 px-3 py-2',
              count: 'text-surface-400',
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

                const barColor = !kpi.isComputable || isPending
                  ? 'bg-gradient-to-r from-surface-500 to-surface-400'
                  : isHit
                  ? 'bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_8px_rgba(52,211,153,0.28)]'
                  : pctDisplay >= 70
                  ? 'bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_0_8px_rgba(251,191,36,0.24)]'
                  : 'bg-gradient-to-r from-rose-400 to-red-400 shadow-[0_0_8px_rgba(251,113,133,0.24)]'

                const pctColor = !kpi.isComputable || isPending
                  ? 'text-surface-500'
                  : isHit
                  ? 'bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent'
                  : pctDisplay >= 70
                  ? 'bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-rose-300 to-red-300 bg-clip-text text-transparent'

                return (
                  <div key={kpi.ruleId} className={stageStyle.row}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Icon className="h-3 w-3 shrink-0 text-surface-400" />
                        <span className="truncate text-[11px] font-medium text-surface-200">{kpi.kpi}</span>
                        <span className="shrink-0 text-[10px] text-surface-500">({kpi.targetText})</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isHit && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                        <span className={`text-[11px] font-bold ${pctColor}`}>
                          {kpi.isComputable && !isPending
                            ? `${fmt(pctDisplay, 0)}%`
                            : isPending ? '-' : '?'
                          }
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-800/95 ring-1 ring-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: kpi.isComputable && !isPending ? `${pctDisplay}%` : '0%' }}
                      />
                    </div>
                    {!kpi.isComputable && !isPending && (
                      <p className="mt-0.5 text-[9px] text-surface-600">Requer dados adicionais</p>
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


