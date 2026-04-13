'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleDollarSign,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'

type StageKey = 'W1' | 'W2' | 'W3' | 'CLOSING' | 'FULL'
type RuleFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
type PrizeType = 'CASH' | 'BENEFIT'
type CashCalcMode = 'PERCENT' | 'FIXED'
type KpiType = 'BASE_CLIENTES' | 'VOLUME' | 'META_FINANCEIRA' | 'DISTRIBUICAO' | 'DEVOLUCAO' | 'INADIMPLENCIA' | 'ITEM_FOCO' | 'RENTABILIDADE' | 'CUSTOM'

interface GoalRule {
  id: string
  stage: StageKey
  frequency: RuleFrequency
  kpiType: KpiType
  kpi: string
  description: string
  targetText: string
  rewardValue: number
  points: number
}

interface WeightTarget {
  id: string
  brand: string        // product brand (MARCA from Sankhya / product allowlist)
  targetKg: number    // monthly weight target in kg
}

interface CampaignPrize {
  id: string
  title: string
  frequency: 'MONTHLY' | 'QUARTERLY'
  type: PrizeType
  cashMode?: CashCalcMode
  rewardValue: number
  benefitDescription: string
  minPoints: number
  active: boolean
}

interface MonthConfig {
  week1StartDate: string
  closingWeekEndDate?: string
  customOffDates: string[]
}

interface MetaConfig {
  ruleBlocks: RuleBlock[]
  prizes: CampaignPrize[]
  includeNational: boolean
  salaryBase: number
  basePremiation: number
  extraBonus: number
  extraMinPoints: number
}

interface SellerOrder {
  orderNumber: string
  negotiatedAt: string
  totalValue: number
  grossWeight: number
  clientCode: string
}

interface SellerReturnEntry {
  negotiatedAt: string
  totalValue: number
}

interface SellerOpenTitleEntry {
  titleId: string
  dueDate: string
  overdueDays: number
  totalValue: number
}

interface Salesperson {
  id: string
  name: string
  login: string
  orders: SellerOrder[]
  returns: SellerReturnEntry[]
  openTitles: SellerOpenTitleEntry[]
  totalValue: number
  totalReturnedValue: number
  totalOpenTitlesValue: number
  totalGrossWeight: number
  totalOrders: number
  baseClientCount: number
}

interface SellerAllowlistEntry {
  code: string | null
  partnerCode: string | null
  name: string
  active: boolean
}

interface ProductAllowlistEntry {
  code: string
  description: string
  brand: string
  unit: string
  mobility: 'SIM' | 'NAO'
  active: boolean
}

type CompanyScopeFilter = '1' | '2' | 'all'

interface PerformanceDiagnostics {
  selectedMonthOrders: number
  queryMode?: string
  companyScope?: string | null
  byStatus?: Record<string, number>
  byCompany?: Record<string, number>
  openTitlesFetched?: number
  openTitlesMappedToSeller?: number
  openTitlePartners?: number
  openTitlesQueryMode?: string
  openTitlesErrors?: string[]
  sellerBaseFetched?: number
  sellerBaseQueryMode?: string
  sellerBaseErrors?: string[]
}

interface RuleProgress {
  ruleId: string
  progress: number
}

interface SellerSnapshot {
  seller: Salesperson
  totalOrders: number
  uniqueClients: number
  totalValue: number
  totalGrossWeight: number
  averageTicket: number
  pointsAchieved: number
  pointsTarget: number
  kpiRewardAchieved: number
  rewardAchieved: number
  rewardTarget: number
  status: 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'
  gapToTarget: number
  ruleProgress: RuleProgress[]
  blockId: string
}

interface RuleBlock {
  id: string
  title: string
  monthlyTarget: number
  sellerIds: string[]
  rules: GoalRule[]
  weightTargets: WeightTarget[]
  focusProductCode?: string
  focusTargetKg?: number
}

interface CycleWeek {
  key: StageKey
  label: string
  start: string | null
  end: string | null
  businessDays: string[]
}

const STORAGE_KEY = 'metas-workspace-v2'

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const STAGES: Array<{ key: StageKey; label: string }> = [
  { key: 'W1', label: '1ª Semana' },
  { key: 'W2', label: '2ª Semana' },
  { key: 'W3', label: '3ª Semana' },
  { key: 'CLOSING', label: 'Fechamento' },
  { key: 'FULL', label: 'Todo o período' },
]

const KPI_CATALOG: Array<{ type: KpiType; label: string; defaultDescription: string }> = [
  { type: 'BASE_CLIENTES', label: 'Base de clientes', defaultDescription: 'Cobertura da base de clientes no período.' },
  { type: 'VOLUME', label: 'Volume', defaultDescription: 'Quantidade mínima de grupos de produto com meta de peso (kg) atingida no período.' },
  { type: 'META_FINANCEIRA', label: 'Meta financeira', defaultDescription: 'Atingir a meta financeira no fechamento do período.' },
  { type: 'DISTRIBUICAO', label: 'Distribuição de itens', defaultDescription: 'Positivação de itens na base de clientes.' },
  { type: 'DEVOLUCAO', label: 'Devolução', defaultDescription: 'Racional sobre os valores devolvidos x valores faturados.' },
  { type: 'INADIMPLENCIA', label: 'Inadimplência acumulativa', defaultDescription: 'Racional sobre o percentual x valores faturados.' },
  { type: 'ITEM_FOCO', label: 'Item foco do mês', defaultDescription: 'Entrega do volume do item foco com positivação mínima da base de clientes.' },
  { type: 'RENTABILIDADE', label: 'Rentabilidade', defaultDescription: 'Margem de contribuição dentro do percentual parametrizado.' },
  { type: 'CUSTOM', label: 'Personalizado', defaultDescription: '' },
]

function inferKpiType(kpi: string): KpiType {
  const lower = kpi.toLowerCase()
  if (lower.includes('base de clientes')) return 'BASE_CLIENTES'
  if (lower.includes('volume') || lower.includes('categori')) return 'VOLUME'
  if (lower.includes('meta financeira')) return 'META_FINANCEIRA'
  if (lower.includes('distribuição') || lower.includes('distribuicao') || lower.includes('distribuição de itens')) return 'DISTRIBUICAO'
  if (lower.includes('devolução') || lower.includes('devolucao')) return 'DEVOLUCAO'
  if (lower.includes('inadimplência') || lower.includes('inadimplencia')) return 'INADIMPLENCIA'
  if (lower.includes('item foco')) return 'ITEM_FOCO'
  if (lower.includes('rentabilidade')) return 'RENTABILIDADE'
  return 'CUSTOM'
}

function getSellerShortName(fullName: string) {
  const PREPS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  const parts = fullName.trim().split(/\s+/)
  const toTitle = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  const meaningful = parts.filter((word) => !PREPS.has(word.toLowerCase()))
  return meaningful.slice(0, 2).map(toTitle).join(' ')
}

const DEFAULT_RULES: GoalRule[] = [
  // ── 1ª Semana ──
  { id: 'w1-base', stage: 'W1', frequency: 'WEEKLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento da 1ª semana.', targetText: '40%', rewardValue: 193.49, points: 0.04 },
  { id: 'w1-volume', stage: 'W1', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Grupos de produto com meta de peso atingida até o fechamento da 1ª semana.', targetText: '2', rewardValue: 145.12, points: 0.03 },
  { id: 'w1-fin', stage: 'W1', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 1ª semana.', targetText: '30%', rewardValue: 96.75, points: 0.02 },
  // ── 2ª Semana ──
  { id: 'w2-base', stage: 'W2', frequency: 'WEEKLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento da 2ª semana.', targetText: '80%', rewardValue: 193.49, points: 0.04 },
  { id: 'w2-volume', stage: 'W2', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Grupos de produto com meta de peso atingida até o fechamento da 2ª semana.', targetText: '3', rewardValue: 145.12, points: 0.03 },
  { id: 'w2-fin', stage: 'W2', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 2ª semana.', targetText: '60%', rewardValue: 96.75, points: 0.02 },
  // ── 3ª Semana ──
  { id: 'w3-volume', stage: 'W3', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Grupos de produto com meta de peso atingida até o fechamento da 3ª semana.', targetText: '4', rewardValue: 145.12, points: 0.03 },
  { id: 'w3-dist', stage: 'W3', frequency: 'WEEKLY', kpiType: 'DISTRIBUICAO', kpi: 'Distribuição de itens', description: 'Ter 50% dos itens positivados em 30% da base de clientes.', targetText: '50%|30', rewardValue: 483.73, points: 0.1 },
  { id: 'w3-fin', stage: 'W3', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 3ª semana.', targetText: '80%', rewardValue: 241.87, points: 0.05 },
  // ── Fechamento ──
  { id: 'closing-base', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento do mês.', targetText: '85%', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-volume', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Grupos de produto com meta de peso atingida até o fechamento do mês.', targetText: '6', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-dist', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'DISTRIBUICAO', kpi: 'Distribuição de itens', description: 'Ter 80% dos itens positivados em 40% da base de clientes.', targetText: '80%|40', rewardValue: 241.87, points: 0.04 },
  { id: 'closing-devol', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'DEVOLUCAO', kpi: 'Devolução', description: 'Racional sobre os valores devolvidos x valores faturados no mês.', targetText: 'Até 0,5%', rewardValue: 241.87, points: 0.05 },
  { id: 'closing-inadimp', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'INADIMPLENCIA', kpi: 'Inadimplência acumulativa', description: 'Racional sobre o percentual x valores faturados no mês.', targetText: '3|45', rewardValue: 241.87, points: 0.05 },
  { id: 'closing-foco', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'ITEM_FOCO', kpi: 'Item foco do mês', description: 'Entrega do volume do item foco com positivação mínima da base de clientes.', targetText: '100|40', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-fin', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento do mês (faturado) — bônus de superação.', targetText: '120%', rewardValue: 96.75, points: 0 },
  { id: 'closing-rentab', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'RENTABILIDADE', kpi: 'Rentabilidade', description: 'Apresentar margem de contribuição dentro do percentual parametrizado.', targetText: '33%', rewardValue: 967.46, points: 0.2 },
]

const DEFAULT_RULE_BLOCKS: RuleBlock[] = [
  { id: 'default', title: 'Bloco padrão', monthlyTarget: 0, sellerIds: [], rules: DEFAULT_RULES, weightTargets: [], focusProductCode: '', focusTargetKg: 0 },
]

function findBlockForSeller(sellerId: string, blocks: RuleBlock[]): RuleBlock {
  const specific = blocks.find((b) => b.sellerIds.includes(sellerId))
  if (specific) return specific
  return blocks.find((b) => b.sellerIds.length === 0) ?? blocks[0]
}

const DEFAULT_PRIZES: CampaignPrize[] = [
  { id: 'month', title: 'Campanha VDD do mês', frequency: 'MONTHLY', type: 'CASH', cashMode: 'PERCENT', rewardValue: 0, benefitDescription: '', minPoints: 0.6, active: true },
  { id: 'quarter', title: 'Campanha VDD do trimestre', frequency: 'QUARTERLY', type: 'BENEFIT', rewardValue: 0, benefitDescription: '', minPoints: 18, active: true },
]

function normalizePrize(prize: CampaignPrize): CampaignPrize {
  if (prize.type !== 'CASH') return { ...prize, cashMode: undefined }
  return { ...prize, cashMode: prize.cashMode ?? 'PERCENT' }
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseIsoDate(raw: string) {
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function firstMonday(year: number, month: number) {
  for (let day = 1; day <= 7; day += 1) {
    const date = new Date(year, month, day)
    if (date.getDay() === 1) return toIsoDate(date)
  }
  return toIsoDate(new Date(year, month, 1))
}

function formatDateBr(iso: string | null) {
  if (!iso) return '--'
  const date = parseIsoDate(iso)
  if (!date) return '--'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function num(value: number, max = 2) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(value)
}

function parseDecimal(input: string, fallback = 0) {
  const parsed = Number(input.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveClosingEndDate(raw: string | undefined, year: number, month: number) {
  if (!raw) return null
  const parsed = parseIsoDate(raw)
  if (!parsed) return null
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  if (parsed < start || parsed > end) return null
  return toIsoDate(parsed)
}

function getSellerWeightTargetRatios(
  weightTargets: WeightTarget[],
  brandWeightRows: Array<{ sellerCode: string; brand: string; totalKg: number }>,
  sellerCode: string
) {
  return weightTargets
    .filter((target) => target.brand && target.targetKg > 0)
    .map((target) => {
      const soldKg = brandWeightRows
        .filter((row) => row.sellerCode === sellerCode && row.brand === target.brand.toUpperCase())
        .reduce((sum, row) => sum + row.totalKg, 0)
      return soldKg / Math.max(target.targetKg, 0.00001)
    })
}

function getVolumeProgressByClosestTargets(ratios: number[], requiredGroups: number) {
  if (requiredGroups <= 0) return 0
  const topRatios = [...ratios]
    .sort((a, b) => b - a)
    .slice(0, requiredGroups)
  const normalized = Array.from({ length: requiredGroups }, (_, index) =>
    Math.max(0, Math.min(topRatios[index] ?? 0, 1))
  )
  const sum = normalized.reduce((acc, value) => acc + value, 0)
  return sum / requiredGroups
}

function formatBrlNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(value, 0))
}

function parseBrlNumber(input: string) {
  const digits = input.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

function parsePointsInput(input: string) {
  const cleaned = input.replace(/[^\d.,]/g, '')
  if (!cleaned) return 0
  if (cleaned.includes(',') || cleaned.includes('.')) {
    return parseDecimal(cleaned, 0)
  }
  if (cleaned.length === 1) {
    return Number(cleaned) / 10
  }
  const whole = cleaned.slice(0, -1)
  const frac = cleaned.slice(-1)
  return parseDecimal(`${whole}.${frac}`, 0)
}

function parseTargetNumber(targetText: string) {
  const match = targetText.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return parseDecimal(match[1], 0)
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

function formatItemFocoTarget(volumePct: number, basePct: number) {
  const v = Math.max(volumePct, 0)
  const b = Math.max(basePct, 0)
  return `${v}|${b}`
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

function formatInadimplenciaTarget(pct: number, days: number) {
  return `${Math.max(pct, 0)}|${Math.max(Math.floor(days), 1)}`
}

type ChartPoint = { x: number; y: number }

function smoothLinePath(points: ChartPoint[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function isDateWithinRange(isoDate: string, startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return false
  return isoDate >= startIso && isoDate <= endIso
}

function findStageForDate(isoDate: string, weeks: CycleWeek[]): StageKey | null {
  const withWindow = weeks.find((week) => isDateWithinRange(isoDate, week.start, week.end))
  return withWindow?.key ?? null
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nationalHolidays(year: number) {
  const fixed = [
    [1, 1],
    [4, 21],
    [5, 1],
    [9, 7],
    [10, 12],
    [11, 2],
    [11, 15],
    [11, 20],
    [12, 25],
  ]
  const movable = [addDays(easterSunday(year), -2)]
  return [...fixed.map(([m, d]) => toIsoDate(new Date(year, m - 1, d))), ...movable.map((date) => toIsoDate(date))]
}

function buildCycle(startIso: string, closingEndIso: string, year: number, month: number, blocked: Set<string>) {
  const start = parseIsoDate(startIso)
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const weeks: CycleWeek[] = []

  if (!start) {
    return {
      weeks,
      totalBusinessDays: 0,
      lastBusinessDate: null as string | null,
    }
  }

  const baseStart = start < monthStart ? monthStart : start
  const configuredEnd = resolveClosingEndDate(closingEndIso, year, month)
  const cycleEndBase = configuredEnd ? parseIsoDate(configuredEnd) ?? monthEnd : monthEnd
  const cycleEnd = cycleEndBase < baseStart ? baseStart : cycleEndBase
  const weekStages = STAGES.filter((s) => s.key !== 'FULL')

  weekStages.forEach((stage, index) => {
    const stageStart = addDays(baseStart, index * 7)
    if (stageStart > cycleEnd) {
      weeks.push({
        key: stage.key,
        label: stage.label,
        start: null,
        end: null,
        businessDays: [],
      })
      return
    }

    const rawStageEnd = stage.key === 'CLOSING' ? cycleEnd : addDays(stageStart, 4)
    const stageEnd = rawStageEnd > cycleEnd ? cycleEnd : rawStageEnd
    const visibleStart = stageStart < monthStart ? monthStart : stageStart

    const business: string[] = []
    for (let cursor = new Date(visibleStart); cursor <= stageEnd; cursor = addDays(cursor, 1)) {
      const weekday = cursor.getDay()
      const iso = toIsoDate(cursor)
      if (weekday >= 1 && weekday <= 5 && !blocked.has(iso)) business.push(iso)
    }

    weeks.push({
      key: stage.key,
      label: stage.label,
      start: toIsoDate(visibleStart),
      end: toIsoDate(stageEnd),
      businessDays: business,
    })
  })

  // FULL stage: entire month
  const fullBusiness: string[] = []
  for (let cursor = new Date(baseStart); cursor <= cycleEnd; cursor = addDays(cursor, 1)) {
    const weekday = cursor.getDay()
    const iso = toIsoDate(cursor)
    if (weekday >= 1 && weekday <= 5 && !blocked.has(iso)) fullBusiness.push(iso)
  }
  weeks.push({
    key: 'FULL',
    label: 'Todo o período',
    start: toIsoDate(baseStart),
    end: toIsoDate(cycleEnd),
    businessDays: fullBusiness,
  })

  let lastBusinessDate: string | null = null
  for (let d = new Date(cycleEnd); d >= baseStart; d = addDays(d, -1)) {
    const wd = d.getDay()
    const iso = toIsoDate(d)
    if (wd >= 1 && wd <= 5 && !blocked.has(iso)) {
      lastBusinessDate = iso
      break
    }
  }

  const totalBusinessDays = weeks.filter((w) => w.key !== 'FULL').reduce((sum, week) => sum + week.businessDays.length, 0)
  return { weeks, totalBusinessDays, lastBusinessDate }
}

function hasMonthEnded(year: number, month: number, closingEndIso: string) {
  const resolved = resolveClosingEndDate(closingEndIso, year, month)
  const [closingYear, closingMonth, closingDay] = (resolved ?? toIsoDate(new Date(year, month + 1, 0))).split('-').map(Number)
  const cycleEnd = new Date(closingYear, closingMonth - 1, closingDay, 23, 59, 59, 999)
  return new Date().getTime() > cycleEnd.getTime()
}

export default function MetasWorkspace() {
  const now = new Date()
  const [view, setView] = useState<'dashboard' | 'config' | 'sellers' | 'products'>('dashboard')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [includeNational, setIncludeNational] = useState(true)
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthConfig>>({})
  const [metaConfigs, setMetaConfigs] = useState<Record<string, MetaConfig>>({})
  const [ruleBlocks, setRuleBlocks] = useState<RuleBlock[]>(DEFAULT_RULE_BLOCKS)
  const [selectedBlockId, setSelectedBlockId] = useState<string>(DEFAULT_RULE_BLOCKS[0].id)
  const rules = useMemo(() => ruleBlocks.flatMap((b) => b.rules), [ruleBlocks])
  const [prizes, setPrizes] = useState<CampaignPrize[]>(DEFAULT_PRIZES)
  const [salaryBase, setSalaryBase] = useState(1612.44)
  const [basePremiation, setBasePremiation] = useState(4837.32)
  const [extraBonus, setExtraBonus] = useState(400)
  const [extraMinPoints, setExtraMinPoints] = useState(0.6)
  const [extraMinPointsInput, setExtraMinPointsInput] = useState('0,60')
  const [customDate, setCustomDate] = useState('')
  const [sellers, setSellers] = useState<Salesperson[]>([])
  const [selectedSellerId, setSelectedSellerId] = useState('')
  const [sellersLoading, setSellersLoading] = useState(true)
  const [sellersError, setSellersError] = useState('')
  const [performanceDiagnostics, setPerformanceDiagnostics] = useState<PerformanceDiagnostics | null>(null)
  const [allowlist, setAllowlist] = useState<SellerAllowlistEntry[]>([])
  const [allowlistLoading, setAllowlistLoading] = useState(false)
  const [allowlistSaving, setAllowlistSaving] = useState(false)
  const [allowlistSyncing, setAllowlistSyncing] = useState(false)
  const [allowlistError, setAllowlistError] = useState('')
  const [allowlistSuccess, setAllowlistSuccess] = useState('')
  const [productAllowlist, setProductAllowlist] = useState<ProductAllowlistEntry[]>([])
  const [productAllowlistLoading, setProductAllowlistLoading] = useState(false)
  const [productAllowlistSaving, setProductAllowlistSaving] = useState(false)
  const [productAllowlistSyncing, setProductAllowlistSyncing] = useState(false)
  const [productAllowlistError, setProductAllowlistError] = useState('')
  const [productAllowlistSuccess, setProductAllowlistSuccess] = useState('')
  const [productCodeFilter, setProductCodeFilter] = useState('')
  const [productDescriptionFilter, setProductDescriptionFilter] = useState('')
  const [productBrandFilter, setProductBrandFilter] = useState('')
  const [companyScopeFilter, setCompanyScopeFilter] = useState<CompanyScopeFilter>('all')
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    confirmLabel: string
    variant: 'danger' | 'primary'
    onConfirm: () => void
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirmar', variant: 'primary', onConfirm: () => {} })
  const [sellerPickerBlockId, setSellerPickerBlockId] = useState<string | null>(null)
  const [sellerPickerSearch, setSellerPickerSearch] = useState('')
  const [addGroupModal, setAddGroupModal] = useState<{ open: boolean; search: string; selectedSellerId: string }>({ open: false, search: '', selectedSellerId: '' })
  // Brand weight data fetched from Sankhya (seller × brand → total kg for the selected month)
  const [brandWeightRows, setBrandWeightRows] = useState<Array<{ sellerCode: string; sellerName: string; brand: string; totalKg: number }>>([])
  const [brandWeightBrands, setBrandWeightBrands] = useState<string[]>([])
  const [brandWeightLoading, setBrandWeightLoading] = useState(false)
  const [brandWeightError, setBrandWeightError] = useState('')
  const [focusProductRows, setFocusProductRows] = useState<Record<string, Array<{ sellerCode: string; sellerName: string; soldKg: number; returnKg: number; soldClients: number }>>>({})
  const [focusProductLoading, setFocusProductLoading] = useState<Record<string, boolean>>({})
  const [focusProductError, setFocusProductError] = useState<Record<string, string>>({})
  const [kpiInspectorOpenKey, setKpiInspectorOpenKey] = useState<string | null>(null)
  const [kpiInspectorSellerId, setKpiInspectorSellerId] = useState('')
  const [kpiInspectorAnchor, setKpiInspectorAnchor] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const periodPickerRef = useRef<HTMLDivElement>(null)

  const activeKey = monthKey(year, month)
  const activeMonth = monthConfigs[activeKey]
  const prevActiveKeyRef = useRef(activeKey)
  const [isConfigLoaded, setIsConfigLoaded] = useState(false)
  const input = 'mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (periodPickerRef.current && !periodPickerRef.current.contains(e.target as Node)) {
        setShowPeriodPicker(false)
      }
    }
    if (showPeriodPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPeriodPicker])

  useEffect(() => {
    function handleViewportChange() {
      setKpiInspectorOpenKey(null)
      setKpiInspectorAnchor(null)
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [])

  useEffect(() => {
    // ── Load config from API (database) ──────────────────────────────────
    const migrateBlocks = (raw: unknown): RuleBlock[] => {
      if (Array.isArray(raw)) return (raw as RuleBlock[]).map((b) => ({
        ...b,
        monthlyTarget: b.monthlyTarget ?? 0,
        sellerIds: b.sellerIds ?? [],
        weightTargets: b.weightTargets ?? [],
        focusProductCode: b.focusProductCode ?? '',
        focusTargetKg: b.focusTargetKg ?? 0,
        rules: (b.rules ?? []).map((r: GoalRule) => ({ ...r, kpiType: r.kpiType ?? inferKpiType(r.kpi) })),
      }))
      return DEFAULT_RULE_BLOCKS
    }

    fetch('/api/metas/config?scope=1')
      .then((r) => r.json())
      .then((data: { metaConfigs?: unknown; monthConfigs?: unknown }) => {
        if (data.monthConfigs && typeof data.monthConfigs === 'object' && !Array.isArray(data.monthConfigs)) {
          setMonthConfigs(data.monthConfigs as Record<string, MonthConfig>)
        }
        if (data.metaConfigs && typeof data.metaConfigs === 'object' && !Array.isArray(data.metaConfigs)) {
          const mc = data.metaConfigs as Record<string, MetaConfig>
          const normalized = Object.fromEntries(
            Object.entries(mc).map(([k, v]) => [k, { ...v, ruleBlocks: migrateBlocks(v.ruleBlocks) }])
          )
          setMetaConfigs(normalized)
          const key = monthKey(year, month)
          const cfg = normalized[key]
          if (cfg) {
            setRuleBlocks(cfg.ruleBlocks)
            setPrizes((cfg.prizes ?? DEFAULT_PRIZES).map(normalizePrize))
            setIncludeNational(cfg.includeNational ?? true)
            setSalaryBase(cfg.salaryBase ?? 1612.44)
            setBasePremiation(cfg.basePremiation ?? 4837.32)
            setExtraBonus(cfg.extraBonus ?? 400)
            setExtraMinPoints(cfg.extraMinPoints ?? 0.6)
            setExtraMinPointsInput(num(cfg.extraMinPoints ?? 0.6, 2))
          } else {
            // Inherit from closest previous month that has config
            const source = Object.keys(normalized).sort().reverse().find((k) => k < monthKey(year, month))
            if (source) {
              const src = normalized[source]
              setRuleBlocks(src.ruleBlocks)
              setPrizes((src.prizes ?? DEFAULT_PRIZES).map(normalizePrize))
              setIncludeNational(src.includeNational ?? true)
              setSalaryBase(src.salaryBase ?? 1612.44)
              setBasePremiation(src.basePremiation ?? 4837.32)
              setExtraBonus(src.extraBonus ?? 400)
              setExtraMinPoints(src.extraMinPoints ?? 0.6)
              setExtraMinPointsInput(num(src.extraMinPoints ?? 0.6, 2))
            }
          }
        }
      })
      .catch((err: unknown) => {
        console.error('[Metas] Falha ao carregar configuração da API:', err)
      })
      .finally(() => {
        setIsConfigLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeMonth) return
    setMonthConfigs((prev) => ({
      ...prev,
      [activeKey]: {
        week1StartDate: firstMonday(year, month),
        closingWeekEndDate: '',
        customOffDates: [],
      },
    }))
  }, [activeKey, activeMonth, month, year])

  // ── Month-switch: save old month config, load new month (or inherit from previous) ──
  useEffect(() => {
    if (prevActiveKeyRef.current === activeKey) return
    const oldKey = prevActiveKeyRef.current
    prevActiveKeyRef.current = activeKey

    // Save current working state into the old month
    setMetaConfigs((prev) => {
      const updated = {
        ...prev,
        [oldKey]: { ruleBlocks, prizes, includeNational, salaryBase, basePremiation, extraBonus, extraMinPoints },
      }

      // Load new month's config
      const cfg = updated[activeKey]
      if (cfg) {
        setRuleBlocks(cfg.ruleBlocks)
        setPrizes((cfg.prizes ?? DEFAULT_PRIZES).map(normalizePrize))
        setIncludeNational(cfg.includeNational)
        setSalaryBase(cfg.salaryBase)
        setBasePremiation(cfg.basePremiation)
        setExtraBonus(cfg.extraBonus)
        setExtraMinPoints(cfg.extraMinPoints)
        setExtraMinPointsInput(num(cfg.extraMinPoints, 2))
      } else {
        // Inherit from closest previous month that has config
        const source = Object.keys(updated).sort().reverse().find((k) => k < activeKey)
        if (source) {
          const src = updated[source]
          setRuleBlocks(src.ruleBlocks)
          setPrizes((src.prizes ?? DEFAULT_PRIZES).map(normalizePrize))
          setIncludeNational(src.includeNational)
          setSalaryBase(src.salaryBase)
          setBasePremiation(src.basePremiation)
          setExtraBonus(src.extraBonus)
          setExtraMinPoints(src.extraMinPoints)
          setExtraMinPointsInput(num(src.extraMinPoints, 2))
        }
        // If no previous month exists, keep current defaults
      }

      return updated
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  // ── Debounced save to API (database) ────────────────────────────────────
  useEffect(() => {
    if (!isConfigLoaded) return
    const merged: Record<string, MetaConfig> = {
      ...metaConfigs,
      [activeKey]: { ruleBlocks, prizes, includeNational, salaryBase, basePremiation, extraBonus, extraMinPoints },
    }
    const timer = setTimeout(() => {
      fetch('/api/metas/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: '1', metaConfigs: merged, monthConfigs }),
      }).catch((err: unknown) => {
        console.error('[Metas] Falha ao salvar configuração na API:', err)
      })
    }, 1200)
    return () => clearTimeout(timer)
  }, [activeKey, basePremiation, extraBonus, extraMinPoints, includeNational, isConfigLoaded, metaConfigs, month, monthConfigs, prizes, ruleBlocks, salaryBase])

  useEffect(() => {
    const controller = new AbortController()
    setSellersLoading(true)
    setSellersError('')

    fetch(`/api/metas/sellers-performance?year=${year}&month=${month + 1}&companyScope=${companyScopeFilter}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao carregar desempenho por vendedor.')
        }
        return payload
      })
      .then((data) => {
        const remoteSellers = (data?.sellers ?? []) as Array<{
          id: string
          name: string
          login: string
          baseClientCount?: number
          totalValue?: number
          totalReturnedValue?: number
          totalOpenTitlesValue?: number
          totalGrossWeight?: number
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number; grossWeight?: number; clientCode?: string }>
          returns?: Array<{ negotiatedAt?: string; totalValue?: number }>
          openTitles?: Array<{ titleId?: string; dueDate?: string; overdueDays?: number; totalValue?: number }>
        }>

        const mapped = remoteSellers.map((seller) => {
          const normalizedOrders = (seller.orders ?? [])
            .filter((order) => typeof order.negotiatedAt === 'string' && order.negotiatedAt.length >= 10)
            .map((order) => ({
              orderNumber: String(order.orderNumber ?? ''),
              negotiatedAt: String(order.negotiatedAt).slice(0, 10),
              totalValue: Number(order.totalValue ?? 0),
              grossWeight: Number(order.grossWeight ?? 0),
              clientCode: String(order.clientCode ?? ''),
            }))
          const normalizedReturns = (seller.returns ?? [])
            .filter((item) => typeof item.negotiatedAt === 'string' && item.negotiatedAt.length >= 10)
            .map((item) => ({
              negotiatedAt: String(item.negotiatedAt).slice(0, 10),
              totalValue: Number(item.totalValue ?? 0),
            }))
          const normalizedOpenTitles = (seller.openTitles ?? [])
            .filter((item) => typeof item.dueDate === 'string' && item.dueDate.length >= 10)
            .map((item) => ({
              titleId: String(item.titleId ?? ''),
              dueDate: String(item.dueDate).slice(0, 10),
              overdueDays: Number(item.overdueDays ?? 0),
              totalValue: Number(item.totalValue ?? 0),
            }))

          return {
            id: seller.id,
            name: seller.name,
            login: seller.login,
            totalValue: Number(seller.totalValue ?? 0),
            totalReturnedValue: Number(seller.totalReturnedValue ?? normalizedReturns.reduce((sum, item) => sum + item.totalValue, 0)),
            totalOpenTitlesValue: Number(seller.totalOpenTitlesValue ?? normalizedOpenTitles.reduce((sum, item) => sum + item.totalValue, 0)),
            totalGrossWeight: Number(seller.totalGrossWeight ?? 0),
            totalOrders: Number(seller.totalOrders ?? normalizedOrders.length),
            baseClientCount: Number(seller.baseClientCount ?? 0),
            orders: normalizedOrders,
            returns: normalizedReturns,
            openTitles: normalizedOpenTitles,
          }
        })

        setSellers(mapped)
        const diag = (data?.diagnostics as PerformanceDiagnostics | undefined) ?? {
          selectedMonthOrders: mapped.reduce((sum, seller) => sum + seller.totalOrders, 0),
        }
        console.info('[Metas] Performance carregada:', {
          pedidos: diag.selectedMonthOrders,
          queryMode: diag.queryMode ?? 'N/A',
          vendedores: mapped.length,
          escopo: diag.companyScope ?? 'N/A',
          porStatus: diag.byStatus ?? {},
          porEmpresa: diag.byCompany ?? {},
        })
        setPerformanceDiagnostics(diag)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSellers([])
        setPerformanceDiagnostics(null)
        setSellersError(error instanceof Error ? error.message : 'Falha ao carregar dados de vendedores.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setSellersLoading(false)
      })

    return () => controller.abort()
  }, [companyScopeFilter, month, year])

  // ── Brand weight effect ────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController()
    setBrandWeightLoading(true)
    setBrandWeightError('')
    fetch(
      `/api/metas/sellers-performance/brand-weight?year=${year}&month=${month + 1}&companyScope=${companyScopeFilter}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar peso por marca.')
        const rows = (payload.rows ?? []) as Array<{ sellerCode: string; sellerName: string; brand: string; totalKg: number }>
        const brands = (payload.brands ?? []) as string[]
        setBrandWeightRows(rows)
        setBrandWeightBrands(brands)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setBrandWeightError(err instanceof Error ? err.message : 'Falha ao carregar peso por marca.')
      })
      .finally(() => { if (!controller.signal.aborted) setBrandWeightLoading(false) })
    return () => controller.abort()
  }, [companyScopeFilter, month, year])

  useEffect(() => {
    setFocusProductRows({})
    setFocusProductLoading({})
    setFocusProductError({})
  }, [companyScopeFilter, month, year])

  useEffect(() => {
    const controller = new AbortController()
    const focusCodes = [...new Set(ruleBlocks.map((b) => (b.focusProductCode ?? '').trim()).filter(Boolean))]

    const codesToFetch = focusCodes.filter((code) => !focusProductRows[code] && !focusProductLoading[code])
    if (codesToFetch.length === 0) {
      return () => controller.abort()
    }

    codesToFetch.forEach((code) => {
      setFocusProductLoading((prev) => ({ ...prev, [code]: true }))
      setFocusProductError((prev) => ({ ...prev, [code]: '' }))
    })

    ;(async () => {
      await Promise.all(
        codesToFetch.map(async (code) => {
          try {
            const res = await fetch(
              `/api/metas/sellers-performance/product-focus?year=${year}&month=${month + 1}&companyScope=${companyScopeFilter}&productCode=${encodeURIComponent(code)}`,
              { signal: controller.signal }
            )
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar item foco do mês.')
            const rows = (payload.rows ?? []) as Array<{ sellerCode: string; sellerName: string; soldKg: number; returnKg: number; soldClients?: number }>
            setFocusProductRows((prev) => ({ ...prev, [code]: rows }))
          } catch (err: unknown) {
            if (!controller.signal.aborted) {
              setFocusProductError((prev) => ({ ...prev, [code]: err instanceof Error ? err.message : 'Falha ao carregar item foco do mês.' }))
            }
          } finally {
            setFocusProductLoading((prev) => ({ ...prev, [code]: false }))
          }
        })
      )
    })()

    return () => controller.abort()
  }, [companyScopeFilter, month, ruleBlocks, year])

  async function loadAllowlist() {
    setAllowlistLoading(true)
    setAllowlistError('')
    setAllowlistSuccess('')

    try {
      const response = await fetch('/api/metas/sellers-allowlist')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao carregar vendedores da meta.')
      }

      const list = Array.isArray(payload?.sellers) ? payload.sellers : []
      setAllowlist(
        list.map((item: Record<string, unknown>) => ({
          code: item.code == null ? null : String(item.code),
          partnerCode: item.partnerCode == null ? null : String(item.partnerCode),
          name: String(item.name ?? ''),
          active: Boolean(item.active),
        }))
      )
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao carregar vendedores da meta.')
      setAllowlist([])
    } finally {
      setAllowlistLoading(false)
    }
  }

  useEffect(() => {
    if (view !== 'sellers') return
    void loadAllowlist()
  }, [view])

  useEffect(() => {
    if (view !== 'products') return
    void loadProductAllowlist()
  }, [view])

  useEffect(() => {
    if (view !== 'config') return
    if (productAllowlistLoading) return
    if (productAllowlist.length > 0) return
    void loadProductAllowlist()
  }, [productAllowlist.length, productAllowlistLoading, view])

  async function saveAllowlist() {
    setAllowlistSaving(true)
    setAllowlistError('')
    setAllowlistSuccess('')

    const payload = {
      sellers: allowlist.map((seller) => ({
        code: seller.code && seller.code.trim().length > 0 ? seller.code.trim() : null,
        partnerCode: seller.partnerCode && seller.partnerCode.trim().length > 0 ? seller.partnerCode.trim() : null,
        name: seller.name.trim(),
        active: seller.active,
      })),
    }

    try {
      const response = await fetch('/api/metas/sellers-allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Falha ao salvar vendedores da meta.')
      }
      setAllowlist(
        (Array.isArray(data?.sellers) ? data.sellers : []).map((item: Record<string, unknown>) => ({
          code: item.code == null ? null : String(item.code),
          partnerCode: item.partnerCode == null ? null : String(item.partnerCode),
          name: String(item.name ?? ''),
          active: Boolean(item.active),
        }))
      )
      setAllowlistSuccess('Lista de vendedores da meta atualizada.')
      // Recarrega visao de desempenho imediatamente.
      setSellersLoading(true)
      setSellersError('')
      const perfResponse = await fetch(`/api/metas/sellers-performance?year=${year}&month=${month + 1}`)
      const perfData = await perfResponse.json().catch(() => ({}))
      if (perfResponse.ok) {
        const remoteSellers = (perfData?.sellers ?? []) as Array<{
          id: string
          name: string
          login: string
          baseClientCount?: number
          totalValue?: number
          totalReturnedValue?: number
          totalOpenTitlesValue?: number
          totalGrossWeight?: number
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number; grossWeight?: number; clientCode?: string }>
          returns?: Array<{ negotiatedAt?: string; totalValue?: number }>
          openTitles?: Array<{ titleId?: string; dueDate?: string; overdueDays?: number; totalValue?: number }>
        }>
        setSellers(
          remoteSellers.map((seller) => {
            const normalizedOrders = (seller.orders ?? [])
              .filter((order) => typeof order.negotiatedAt === 'string' && order.negotiatedAt.length >= 10)
              .map((order) => ({
                orderNumber: String(order.orderNumber ?? ''),
                negotiatedAt: String(order.negotiatedAt).slice(0, 10),
                totalValue: Number(order.totalValue ?? 0),
                grossWeight: Number(order.grossWeight ?? 0),
                clientCode: String(order.clientCode ?? ''),
              }))
            const normalizedReturns = (seller.returns ?? [])
              .filter((item) => typeof item.negotiatedAt === 'string' && item.negotiatedAt.length >= 10)
              .map((item) => ({
                negotiatedAt: String(item.negotiatedAt).slice(0, 10),
                totalValue: Number(item.totalValue ?? 0),
              }))
            const normalizedOpenTitles = (seller.openTitles ?? [])
              .filter((item) => typeof item.dueDate === 'string' && item.dueDate.length >= 10)
              .map((item) => ({
                titleId: String(item.titleId ?? ''),
                dueDate: String(item.dueDate).slice(0, 10),
                overdueDays: Number(item.overdueDays ?? 0),
                totalValue: Number(item.totalValue ?? 0),
              }))
            return {
              id: seller.id,
              name: seller.name,
              login: seller.login,
              totalValue: Number(seller.totalValue ?? 0),
              totalReturnedValue: Number(seller.totalReturnedValue ?? normalizedReturns.reduce((sum, item) => sum + item.totalValue, 0)),
              totalOpenTitlesValue: Number(seller.totalOpenTitlesValue ?? normalizedOpenTitles.reduce((sum, item) => sum + item.totalValue, 0)),
              totalGrossWeight: Number(seller.totalGrossWeight ?? 0),
              totalOrders: Number(seller.totalOrders ?? normalizedOrders.length),
              baseClientCount: Number(seller.baseClientCount ?? 0),
              orders: normalizedOrders,
              returns: normalizedReturns,
              openTitles: normalizedOpenTitles,
            }
          })
        )
        setPerformanceDiagnostics(
          (perfData?.diagnostics as PerformanceDiagnostics | undefined) ?? {
            selectedMonthOrders: 0,
          }
        )
      }
      setSellersLoading(false)
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao salvar vendedores da meta.')
    } finally {
      setAllowlistSaving(false)
    }
  }

  async function removeSellerAndSave(removeIndex: number) {
    const updated = allowlist.filter((_, i) => i !== removeIndex)
    setAllowlist(updated)
    setAllowlistError('')
    setAllowlistSuccess('')
    try {
      const response = await fetch('/api/metas/sellers-allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellers: updated.map((s) => ({
            code: s.code && s.code.trim().length > 0 ? s.code.trim() : null,
            partnerCode: s.partnerCode && s.partnerCode.trim().length > 0 ? s.partnerCode.trim() : null,
            name: s.name.trim(),
            active: s.active,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message ?? 'Falha ao salvar.')
      setAllowlist(
        (Array.isArray(data?.sellers) ? data.sellers : []).map((item: Record<string, unknown>) => ({
          code: item.code == null ? null : String(item.code),
          partnerCode: item.partnerCode == null ? null : String(item.partnerCode),
          name: String(item.name ?? ''),
          active: Boolean(item.active),
        }))
      )
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao remover vendedor.')
      void loadAllowlist()
    }
  }

  async function syncAllowlistFromSankhya() {
    setAllowlistSyncing(true)
    setAllowlistError('')
    setAllowlistSuccess('')

    try {
      const response = await fetch('/api/metas/sellers-allowlist/sync', {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Falha ao sincronizar vendedores do Sankhya.')
      }

      setAllowlist(
        (Array.isArray(data?.sellers) ? data.sellers : []).map((item: Record<string, unknown>) => ({
          code: item.code == null ? null : String(item.code),
          partnerCode: item.partnerCode == null ? null : String(item.partnerCode),
          name: String(item.name ?? ''),
          active: Boolean(item.active),
        }))
      )
      const imported = Number(data?.imported ?? 0)
      setAllowlistSuccess(
        imported > 0
          ? `Sincronizacao concluida: ${imported} vendedores importados do Sankhya.`
          : 'Sincronizacao concluida, sem vendedores novos.'
      )
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao sincronizar vendedores do Sankhya.')
    } finally {
      setAllowlistSyncing(false)
    }
  }

  async function loadProductAllowlist() {
    setProductAllowlistLoading(true)
    setProductAllowlistError('')
    setProductAllowlistSuccess('')

    try {
      const response = await fetch('/api/metas/products-allowlist')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao carregar produtos da meta.')
      }

      const list = Array.isArray(payload?.products) ? payload.products : []
      setProductAllowlist(
        list.map((item: Record<string, unknown>) => ({
          code: String(item.code ?? ''),
          description: String(item.description ?? ''),
          brand: String(item.brand ?? ''),
          unit: String(item.unit ?? ''),
          mobility: String(item.mobility ?? '').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
          active: Boolean(item.active),
        }))
      )
    } catch (error) {
      setProductAllowlistError(error instanceof Error ? error.message : 'Falha ao carregar produtos da meta.')
      setProductAllowlist([])
    } finally {
      setProductAllowlistLoading(false)
    }
  }

  async function saveProductAllowlist() {
    setProductAllowlistSaving(true)
    setProductAllowlistError('')
    setProductAllowlistSuccess('')

    const payload = {
      products: productAllowlist.map((product) => ({
        code: String(product.code ?? '').trim(),
        description: String(product.description ?? '').trim(),
        brand: String(product.brand ?? '').trim(),
        unit: String(product.unit ?? '').trim().toUpperCase(),
        mobility: product.mobility === 'SIM' ? 'SIM' : 'NAO',
        active: product.active,
      })),
    }

    try {
      const response = await fetch('/api/metas/products-allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Falha ao salvar produtos da meta.')
      }

      const list = Array.isArray(data?.products) ? data.products : []
      setProductAllowlist(
        list.map((item: Record<string, unknown>) => ({
          code: String(item.code ?? ''),
          description: String(item.description ?? ''),
          brand: String(item.brand ?? ''),
          unit: String(item.unit ?? ''),
          mobility: String(item.mobility ?? '').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
          active: Boolean(item.active),
        }))
      )
      setProductAllowlistSuccess('Lista de produtos da meta atualizada.')
    } catch (error) {
      setProductAllowlistError(error instanceof Error ? error.message : 'Falha ao salvar produtos da meta.')
    } finally {
      setProductAllowlistSaving(false)
    }
  }

  async function removeProductAndSave(code: string, description: string) {
    const updated = productAllowlist.filter(
      (item) => !(item.code === code && item.description === description)
    )
    setProductAllowlist(updated)
    setProductAllowlistError('')
    setProductAllowlistSuccess('')
    try {
      const response = await fetch('/api/metas/products-allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: updated.map((p) => ({
            code: String(p.code ?? '').trim(),
            description: String(p.description ?? '').trim(),
            brand: String(p.brand ?? '').trim(),
            unit: String(p.unit ?? '').trim().toUpperCase(),
            mobility: p.mobility === 'SIM' ? 'SIM' : 'NAO',
            active: p.active,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message ?? 'Falha ao salvar.')
      const list = Array.isArray(data?.products) ? data.products : []
      setProductAllowlist(
        list.map((item: Record<string, unknown>) => ({
          code: String(item.code ?? ''),
          description: String(item.description ?? ''),
          brand: String(item.brand ?? ''),
          unit: String(item.unit ?? ''),
          mobility: String(item.mobility ?? '').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
          active: Boolean(item.active),
        }))
      )
    } catch (error) {
      setProductAllowlistError(error instanceof Error ? error.message : 'Falha ao remover produto.')
      void loadProductAllowlist()
    }
  }

  async function syncProductAllowlistFromSankhya() {
    setProductAllowlistSyncing(true)
    setProductAllowlistError('')
    setProductAllowlistSuccess('')

    try {
      const response = await fetch('/api/metas/products-allowlist/sync', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Falha ao sincronizar produtos do Sankhya.')
      }

      const list = Array.isArray(data?.products) ? data.products : []
      setProductAllowlist(
        list.map((item: Record<string, unknown>) => ({
          code: String(item.code ?? ''),
          description: String(item.description ?? ''),
          brand: String(item.brand ?? ''),
          unit: String(item.unit ?? ''),
          mobility: String(item.mobility ?? '').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
          active: Boolean(item.active),
        }))
      )
      const imported = Number(data?.imported ?? 0)
      setProductAllowlistSuccess(
        imported > 0
          ? `Sincronizacao concluida: ${imported} produtos importados do Sankhya.`
          : 'Sincronizacao concluida, sem produtos novos.'
      )
    } catch (error) {
      setProductAllowlistError(error instanceof Error ? error.message : 'Falha ao sincronizar produtos do Sankhya.')
    } finally {
      setProductAllowlistSyncing(false)
    }
  }

  const blockedSet = useMemo(() => {
    const set = new Set<string>()
    if (includeNational) [...nationalHolidays(year), ...nationalHolidays(year + 1)].forEach((date) => set.add(date))
    ;(activeMonth?.customOffDates ?? []).forEach((date) => set.add(date))
    return set
  }, [activeMonth?.customOffDates, includeNational, year])

  const cycle = useMemo(
    () => buildCycle(activeMonth?.week1StartDate ?? '', activeMonth?.closingWeekEndDate ?? '', year, month, blockedSet),
    [activeMonth?.closingWeekEndDate, activeMonth?.week1StartDate, blockedSet, month, year]
  )
  const pointsTarget = useMemo(() => rules.reduce((sum, rule) => sum + rule.points, 0), [rules])
  const rewardTarget = useMemo(() => rules.reduce((sum, rule) => sum + rule.rewardValue, 0), [rules])

  const nextDate = useMemo(() => new Date(year, month + 1, 1), [month, year])
  const nextKey = monthKey(nextDate.getFullYear(), nextDate.getMonth())
  const nextConfigured = Boolean(monthConfigs[nextKey]?.week1StartDate)
  const standby = !activeMonth?.week1StartDate || (hasMonthEnded(year, month, activeMonth?.closingWeekEndDate ?? '') && !nextConfigured)

  const snapshots = useMemo<SellerSnapshot[]>(() => {
    const todayIso = toIsoDate(new Date())
    const stageStarted = new Set<StageKey>(
      cycle.weeks.filter((w) => w.start && w.start <= todayIso).map((w) => w.key)
    )

    const teamAverageValue =
      sellers.length > 0 ? sellers.reduce((sum, seller) => sum + seller.totalValue, 0) / sellers.length : 0

    const totalActiveProducts = productAllowlist.filter((p) => p.active).length

    const teamAverageTicket = (() => {
      const tickets = sellers
        .filter((seller) => seller.totalOrders > 0)
        .map((seller) => seller.totalValue / Math.max(seller.totalOrders, 1))
      if (tickets.length === 0) return 0
      return tickets.reduce((sum, value) => sum + value, 0) / tickets.length
    })()

    return sellers
      .map((seller) => {
        const block = findBlockForSeller(seller.id, ruleBlocks)
        const blockRules = block.rules
        const blockPointsTarget = blockRules.reduce((sum, rule) => sum + rule.points, 0)
        const blockRewardTarget = blockRules.reduce((sum, rule) => sum + rule.rewardValue, 0)
        const activePointsTarget = blockRules.filter((r) => stageStarted.has(r.stage)).reduce((sum, rule) => sum + rule.points, 0)

        const stageMetrics = STAGES.reduce(
          (acc, stage) => {
            acc[stage.key] = { orderCount: 0, totalValue: 0, clientCodes: new Set<string>() }
            return acc
          },
          {} as Record<StageKey, { orderCount: number; totalValue: number; clientCodes: Set<string> }>
        )

        for (const order of seller.orders) {
          const stage = findStageForDate(order.negotiatedAt, cycle.weeks)
          if (!stage) continue
          stageMetrics[stage].orderCount += 1
          stageMetrics[stage].totalValue += order.totalValue
          if (order.clientCode) stageMetrics[stage].clientCodes.add(order.clientCode)
          // FULL stage always accumulates everything
          if (stage !== 'FULL') {
            stageMetrics.FULL.orderCount += 1
            stageMetrics.FULL.totalValue += order.totalValue
            if (order.clientCode) stageMetrics.FULL.clientCodes.add(order.clientCode)
          }
        }

        const stageOrder: StageKey[] = ['W1', 'W2', 'W3', 'CLOSING']
        const cumulativeMetrics: Record<StageKey, { orderCount: number; totalValue: number; distinctClients: number }> = {
          W1: { orderCount: 0, totalValue: 0, distinctClients: 0 }, W2: { orderCount: 0, totalValue: 0, distinctClients: 0 },
          W3: { orderCount: 0, totalValue: 0, distinctClients: 0 }, CLOSING: { orderCount: 0, totalValue: 0, distinctClients: 0 },
          FULL: { orderCount: stageMetrics.FULL.orderCount, totalValue: stageMetrics.FULL.totalValue, distinctClients: stageMetrics.FULL.clientCodes.size },
        }
        let cumOrders = 0
        let cumValue = 0
        const cumClients = new Set<string>()
        for (const sk of stageOrder) {
          cumOrders += stageMetrics[sk].orderCount
          cumValue += stageMetrics[sk].totalValue
          for (const c of stageMetrics[sk].clientCodes) cumClients.add(c)
          cumulativeMetrics[sk] = { orderCount: cumOrders, totalValue: cumValue, distinctClients: cumClients.size }
        }

        const totalDistinctClients = stageMetrics.FULL.clientCodes.size
        const officialBaseClients = Math.max(seller.baseClientCount ?? 0, 0)

        // ── Financial accumulation by stage closing date ────────────────────────
        // For META_FINANCEIRA we need "all orders placed up to the END DATE of the
        // stage", regardless of whether the order day falls on a weekday, weekend,
        // or even before the cycle start.  This ensures the 30% / 60% / 80% / 120%
        // thresholds are evaluated against the true cumulative revenue.
        const stageEndDateMap: Partial<Record<StageKey, string>> = {}
        for (const w of cycle.weeks) {
          if (w.end) stageEndDateMap[w.key] = w.end
        }

        const financialByStageEnd: Partial<Record<StageKey, number>> = {}
        const returnsByStageEnd: Partial<Record<StageKey, number>> = {}
        for (const sk of ['W1', 'W2', 'W3', 'CLOSING', 'FULL'] as StageKey[]) {
          const endDate = stageEndDateMap[sk]
          financialByStageEnd[sk] = endDate
            ? seller.orders.reduce((sum, o) => (o.negotiatedAt <= endDate ? sum + o.totalValue : sum), 0)
            : 0
          returnsByStageEnd[sk] = endDate
            ? seller.returns.reduce((sum, r) => (r.negotiatedAt <= endDate ? sum + r.totalValue : sum), 0)
            : 0
        }

        const sellerCode = seller.id.replace(/^sankhya-/, '')
        const weightTargetRatios = getSellerWeightTargetRatios(block.weightTargets ?? [], brandWeightRows, sellerCode)
        const achievedWeightGroups = weightTargetRatios.filter((ratio) => ratio >= 1).length

        const focusCode = (block.focusProductCode ?? '').trim()
        const focusRows = focusCode ? (focusProductRows[focusCode] ?? []) : []
        const focusRow = focusRows.find((row) => row.sellerCode === sellerCode)
        const focusSoldKg = focusRow?.soldKg ?? 0
        const focusSoldClients = Number(focusRow?.soldClients ?? 0)

        const averageTicket = seller.totalOrders > 0 ? seller.totalValue / seller.totalOrders : 0
        const totalValueSafe = Math.max(seller.totalValue, 0.00001)
        const teamAverageValueSafe = Math.max(teamAverageValue, 0.00001)
        const teamAverageTicketSafe = Math.max(teamAverageTicket, 0.00001)
        const monthlyTargetSafe = block.monthlyTarget > 0 ? block.monthlyTarget : teamAverageValueSafe

        const ruleProgress = blockRules.map((rule) => {
          // Skip rules for stages that haven't started yet
          if (!stageStarted.has(rule.stage)) return { ruleId: rule.id, progress: 0 }

          const rawNumber = parseTargetNumber(rule.targetText) ?? 0
          const cumStage = cumulativeMetrics[rule.stage]
          const stage = stageMetrics[rule.stage]
          const kpiType = rule.kpiType ?? inferKpiType(rule.kpi)

          // Stage-locked metrics: only data up to this rule's stage end, so past KPIs never change retroactively
          const lockedValue = Math.max(cumStage.totalValue, 0.00001)
          const lockedOrders = Math.max(cumStage.orderCount, 1)
          const lockedTicket = cumStage.orderCount > 0 ? cumStage.totalValue / cumStage.orderCount : 0

          // KPIs that always interpret parameter as percentage
          const pctKpis: KpiType[] = ['BASE_CLIENTES', 'META_FINANCEIRA', 'RENTABILIDADE', 'DEVOLUCAO', 'INADIMPLENCIA']
          const asPct = pctKpis.includes(kpiType) && rawNumber > 0
            ? Math.max(rawNumber / 100, 0.00001)
            : (rule.targetText.includes('%') && rawNumber > 0 ? Math.max(rawNumber / 100, 0.00001) : null)

          let progress = 0

          switch (kpiType) {
            case 'META_FINANCEIRA': {
              // Use orders accumulated up to the stage's CLOSING DATE (not just orders
              // that fall within the stage date window).  This means weekends, holidays
              // between stages, and orders placed before the cycle start are all counted
              // toward the cumulative threshold (30% by end of W1, 60% by end of W2 …).
              const financialAccumulated = financialByStageEnd[rule.stage] ?? cumStage.totalValue
              if (asPct) {
                progress = financialAccumulated / (monthlyTargetSafe * asPct)
              } else {
                progress = financialAccumulated / monthlyTargetSafe
              }
              break
            }
            case 'RENTABILIDADE':
              // Use stage-locked average ticket so past stages don't shift
              progress = (lockedTicket / teamAverageTicketSafe) / (asPct ?? 1)
              break
            case 'BASE_CLIENTES':
              // Distinct clients reached in this stage vs total client base (% coverage)
              // totalDistinctClients can only grow → past KPIs can only stay same or decrease, never improve
              if (asPct) {
                const denominator = Math.max(officialBaseClients > 0 ? officialBaseClients : totalDistinctClients, 1)
                const clientCoverage = cumStage.distinctClients / denominator
                progress = clientCoverage / asPct
              } else {
                progress = cumStage.distinctClients > 0 ? 1 : 0
              }
              break
            case 'VOLUME':
              if (rawNumber > 0) {
                const requiredGroups = Math.max(Math.floor(rawNumber), 1)
                progress = getVolumeProgressByClosestTargets(weightTargetRatios, requiredGroups)
              } else {
                progress = 0
              }
              break
            case 'DISTRIBUICAO': {
              // targetText format: "X|Y" where X = items target (number or "N%" of total products), Y = clients% of seller base
              const parts = rule.targetText.split('|').map((s) => s.trim())
              const itemsPart = parts[0] ?? '0'
              const itemsIsPercent = itemsPart.includes('%')
              const itemsNum = parseDecimal(itemsPart.replace('%', ''), 0)
              const resolvedItems = itemsIsPercent && totalActiveProducts > 0
                ? Math.ceil(totalActiveProducts * itemsNum / 100)
                : itemsNum
              const clientsPct = parseDecimal(parts[1] ?? '0', 0) / 100
              const baseTotalClients = Math.max(officialBaseClients > 0 ? officialBaseClients : totalDistinctClients, 0)
              // Use official client base (parceiros preferenciais) when available.
              if (resolvedItems > 0 && clientsPct > 0 && baseTotalClients > 0) {
                const requiredClients = Math.ceil(baseTotalClients * clientsPct)
                const clientsAchieved = cumStage.distinctClients
                progress = clientsAchieved / Math.max(requiredClients, 1)
              } else if (resolvedItems > 0) {
                progress = cumStage.orderCount / resolvedItems
              } else {
                progress = cumStage.orderCount > 0 ? 1 : 0
              }
              break
            }
            case 'DEVOLUCAO':
              {
                const financialAccumulated = Math.max(financialByStageEnd[rule.stage] ?? 0, 0)
                const returnedAccumulated = Math.max(returnsByStageEnd[rule.stage] ?? 0, 0)
                const targetPct = asPct ?? (rawNumber > 0 ? rawNumber / 100 : 0)
                if (financialAccumulated <= 0 || targetPct <= 0) {
                  progress = 0
                  break
                }
                const actualPct = returnedAccumulated / financialAccumulated
                progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
              }
              break
            case 'INADIMPLENCIA':
              {
                const financialAccumulated = Math.max(financialByStageEnd[rule.stage] ?? 0, 0)
                const { pct: inadPct, days: atrasoDias } = parseInadimplenciaTarget(rule.targetText)
                const stageEnd = stageEndDateMap[rule.stage]
                const overdueOpenTitles = stageEnd
                  ? seller.openTitles.filter((title) => title.dueDate <= stageEnd && title.overdueDays > atrasoDias)
                  : []
                const overdueValue = overdueOpenTitles.reduce((sum, title) => sum + title.totalValue, 0)
                const targetPct = inadPct > 0 ? inadPct / 100 : 0
                if (financialAccumulated <= 0 || targetPct <= 0) {
                  progress = 0
                  break
                }
                const actualPct = overdueValue / financialAccumulated
                progress = actualPct <= targetPct ? 1 : targetPct / Math.max(actualPct, 0.00001)
              }
              break
            case 'ITEM_FOCO':
              {
                const { volumePct, basePct } = parseItemFocoTarget(rule.targetText)
                const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
                if (!focusCode || focusTargetKg <= 0 || volumePct <= 0) {
                  progress = 0
                  break
                }
                const requiredKg = focusTargetKg * (volumePct / 100)
                const volumeProgress = requiredKg > 0 ? focusSoldKg / requiredKg : 0
                const baseTotalClients = Math.max(officialBaseClients > 0 ? officialBaseClients : totalDistinctClients, 0)
                const requiredBaseClients = basePct > 0
                  ? Math.ceil(baseTotalClients * (basePct / 100))
                  : 0
                const baseProgress = requiredBaseClients > 0
                  ? focusSoldClients / Math.max(requiredBaseClients, 1)
                  : 1
                progress = volumeProgress * baseProgress
              }
              break
            default:
              if (asPct !== null) {
                const stageShare = stage.totalValue / lockedValue
                progress = stageShare / asPct
              } else if (rawNumber > 0) {
                progress = stage.orderCount / rawNumber
              } else {
                progress = stage.orderCount > 0 ? 1 : 0
              }
          }

          return { ruleId: rule.id, progress: Math.max(0, Math.min(progress, 1.4)) }
        })

        const pointsAchieved = blockRules.reduce((sum, rule) => {
          const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
          return sum + rule.points * Math.min(progress, 1)
        }, 0)

        const kpiRewardAchieved = blockRules.reduce((sum, rule) => {
          const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
          return sum + (progress >= 1 ? rule.rewardValue : 0)
        }, 0)

        const campaignCashTarget = prizes.reduce((sum, prize) => {
          if (!prize.active || prize.type !== 'CASH') return sum
          const monthlyTargetBase = Math.max(block.monthlyTarget, 0)
          const rewardValue = Math.max(prize.rewardValue, 0)
          return sum + (prize.cashMode === 'FIXED' ? rewardValue : (monthlyTargetBase * rewardValue) / 100)
        }, 0)

        const campaignCashAchieved = prizes.reduce((sum, prize) => {
          if (!prize.active || prize.type !== 'CASH') return sum
          if (pointsAchieved < prize.minPoints) return sum
          const monthlyTargetBase = Math.max(block.monthlyTarget, 0)
          const rewardValue = Math.max(prize.rewardValue, 0)
          return sum + (prize.cashMode === 'FIXED' ? rewardValue : (monthlyTargetBase * rewardValue) / 100)
        }, 0)

        const extraBonusEligible = pointsAchieved >= extraMinPoints
        const extraBonusAchieved = extraBonusEligible ? Math.max(extraBonus, 0) : 0
        const rewardAchieved = kpiRewardAchieved + campaignCashAchieved + extraBonusAchieved

        const ratio = activePointsTarget > 0 ? pointsAchieved / activePointsTarget : 0

        const hasSuperTarget = blockRules.some((rule) => {
          if (rule.kpiType !== 'META_FINANCEIRA') return false
          const pct = parseFloat(rule.targetText.replace('%', ''))
          return pct > 100 && (ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0) >= 1
        })

        const activeRulesForStatus = blockRules.filter((r) => stageStarted.has(r.stage))
        const allActiveKpisHit =
          activeRulesForStatus.length > 0 &&
          activeRulesForStatus.every((rule) => {
            const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
            return progress >= 1
          })

        const status: SellerSnapshot['status'] = hasSuperTarget ? 'SUPEROU' : allActiveKpisHit ? 'NO_ALVO' : ratio >= 0.65 ? 'ATENCAO' : 'CRITICO'

        return {
          seller,
          totalOrders: seller.totalOrders,
          uniqueClients: totalDistinctClients,
          totalValue: seller.totalValue,
          totalGrossWeight: seller.totalGrossWeight,
          averageTicket,
          pointsAchieved,
          pointsTarget: blockPointsTarget,
          kpiRewardAchieved,
          rewardAchieved,
          rewardTarget: blockRewardTarget + campaignCashTarget + Math.max(extraBonus, 0),
          status,
          gapToTarget: Math.max(blockPointsTarget - pointsAchieved, 0),
          ruleProgress,
          blockId: block.id,
        }
      })
      .sort((a, b) => b.pointsAchieved - a.pointsAchieved)
  }, [brandWeightRows, cycle.weeks, extraBonus, extraMinPoints, focusProductRows, prizes, productAllowlist, ruleBlocks, sellers])

  useEffect(() => {
    if (snapshots.length === 0) {
      if (selectedSellerId !== '') setSelectedSellerId('')
      return
    }
    if (!snapshots.some((snapshot) => snapshot.seller.id === selectedSellerId)) {
      setSelectedSellerId('')
    }
  }, [selectedSellerId, snapshots])

  const byStatus = useMemo(
    () => ({
      superou: snapshots.filter((s) => s.status === 'SUPEROU').length,
      noAlvo: snapshots.filter((s) => s.status === 'NO_ALVO').length,
      atencao: snapshots.filter((s) => s.status === 'ATENCAO').length,
      critico: snapshots.filter((s) => s.status === 'CRITICO').length,
    }),
    [snapshots]
  )

  const onTargetCount = byStatus.superou + byStatus.noAlvo
  const factoryGoalRatio = snapshots.length > 0 ? onTargetCount / snapshots.length : 0
  const factoryGoalMet = snapshots.length > 0 && onTargetCount === snapshots.length
  const factoryGap = Math.max(snapshots.length - onTargetCount, 0)
  const corporateTotalOrders = useMemo(
    () => snapshots.reduce((sum, snapshot) => sum + snapshot.totalOrders, 0),
    [snapshots]
  )
  const corporateTotalGrossWeight = useMemo(
    () => snapshots.reduce((sum, snapshot) => sum + snapshot.totalGrossWeight, 0),
    [snapshots]
  )
  const corporateTotalRevenue = useMemo(
    () => snapshots.reduce((sum, snapshot) => sum + snapshot.totalValue, 0),
    [snapshots]
  )
  const corporateUniqueClients = useMemo(() => {
    const uniqueClients = new Set<string>()
    for (const seller of sellers) {
      for (const order of seller.orders) {
        const code = (order.clientCode ?? '').trim()
        if (code) uniqueClients.add(code)
      }
    }
    return uniqueClients.size
  }, [sellers])
  // Sum of each seller's individual monthly target (from their assigned block)
  const corporateTotalTarget = useMemo(
    () =>
      snapshots.reduce((sum, snapshot) => {
        const block = ruleBlocks.find((b) => b.id === snapshot.blockId) ?? ruleBlocks[0]
        return sum + (block.monthlyTarget > 0 ? block.monthlyTarget : 0)
      }, 0),
    [ruleBlocks, snapshots]
  )
  // Sum of all weight targets across all blocks (all brands, all sellers)
  const corporateTotalWeightTarget = useMemo(
    () => ruleBlocks.reduce((sum, block) => sum + (block.weightTargets ?? []).reduce((s, wt) => s + (wt.targetKg > 0 ? wt.targetKg : 0), 0), 0),
    [ruleBlocks]
  )
  // Total actual weight by brand (sum across all fetched rows)
  const corporateTotalWeightActual = useMemo(
    () => brandWeightRows.reduce((sum, r) => sum + r.totalKg, 0),
    [brandWeightRows]
  )
  const corporateAverageTicket = useMemo(
    () => (corporateTotalOrders > 0 ? corporateTotalRevenue / corporateTotalOrders : 0),
    [corporateTotalOrders, corporateTotalRevenue]
  )
  const showPeriodHint =
    !sellersLoading &&
    !sellersError &&
    corporateTotalOrders === 0 &&
    sellers.length > 0
  const filteredProductAllowlist = useMemo(() => {
    const codeFilter = productCodeFilter.trim().toUpperCase()
    const descriptionFilter = productDescriptionFilter.trim().toUpperCase()
    const brandFilter = productBrandFilter.trim().toUpperCase()

    return productAllowlist.filter((product) => {
      const codeOk = codeFilter.length === 0 || product.code.toUpperCase().includes(codeFilter)
      const descriptionOk =
        descriptionFilter.length === 0 || product.description.toUpperCase().includes(descriptionFilter)
      const brandOk = brandFilter.length === 0 || product.brand.toUpperCase().includes(brandFilter)
      return codeOk && descriptionOk && brandOk
    })
  }, [productAllowlist, productCodeFilter, productDescriptionFilter, productBrandFilter])

  const rewardDonut = useMemo(() => {
    const palette: Record<SellerSnapshot['status'], string> = {
      SUPEROU:  '#0ea5e9',
      NO_ALVO:  '#06b6d4',
      ATENCAO:  '#f59e0b',
      CRITICO:  '#f43f5e',
    }
    const labels: Record<SellerSnapshot['status'], string> = {
      SUPEROU: 'Superou',
      NO_ALVO: 'Meta Batida',
      ATENCAO: 'Em progresso',
      CRITICO: 'Requer atenção',
    }
    const groups: Record<SellerSnapshot['status'], number> = {
      SUPEROU: 0, NO_ALVO: 0, ATENCAO: 0, CRITICO: 0,
    }
    let totalEarned = 0
    let totalTarget = 0
    let totalKpiHit = 0
    let totalKpiTarget = 0
    for (const s of snapshots) {
      groups[s.status] += s.rewardAchieved
      totalEarned += s.rewardAchieved
      totalTarget += s.rewardTarget
      const block = ruleBlocks.find((b) => b.id === s.blockId) ?? ruleBlocks[0]
      totalKpiTarget += block.rules.length
      totalKpiHit += block.rules.reduce((sum, rule) => {
        const progress = s.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
        return sum + (progress >= 1 ? 1 : 0)
      }, 0)
    }
    const radius = 52
    const circumference = 2 * Math.PI * radius
    const totalSafe = Math.max(totalEarned, 0.0001)
    const statuses: SellerSnapshot['status'][] = ['SUPEROU', 'NO_ALVO', 'ATENCAO', 'CRITICO']
    let offset = 0
    const segments = statuses
      .filter((st) => groups[st] > 0)
      .map((st) => {
        const ratio = groups[st] / totalSafe
        const length = ratio * circumference
        const seg = {
          status: st,
          label: labels[st],
          color: palette[st],
          value: groups[st],
          dash: `${length} ${circumference - length}`,
          offset: -offset,
        }
        offset += length
        return seg
      })
    const pctCommitted = totalTarget > 0 ? Math.min(totalEarned / totalTarget * 100, 100) : 0
    const legendItems = [
      { key: 'hit',        label: 'Meta Batida',  color: '#06b6d4', value: groups.SUPEROU + groups.NO_ALVO },
      { key: 'progress',  label: 'Em progresso', color: '#f59e0b', value: groups.ATENCAO + groups.CRITICO },
    ]
    const kpiCommittedPct = totalKpiTarget > 0 ? Math.min(totalKpiHit / totalKpiTarget * 100, 100) : 0
    return { radius, circumference, segments, legendItems, totalEarned, totalTarget, pctCommitted, totalKpiHit, totalKpiTarget, kpiCommittedPct }
  }, [ruleBlocks, snapshots])

  const sellerRewardRows = useMemo(() => {
    return snapshots
      .filter((s) => s.rewardAchieved > 0 || s.rewardTarget > 0)
      .map((s) => ({
        name: getSellerShortName(s.seller.name),
        earned: s.rewardAchieved,
        target: s.rewardTarget,
        status: s.status,
      }))
      .sort((a, b) => b.earned - a.earned)
  }, [snapshots])

  const stageSeries = useMemo(
    () =>
      STAGES.filter((s) => s.key !== 'FULL').map((stage) => {
        if (snapshots.length === 0) {
          return { key: stage.key, label: stage.label, kpiTotal: 0, kpiHit: 0, ratio: 0 }
        }

        let kpiTotal = 0
        let kpiHit = 0

        for (const snapshot of snapshots) {
          const block = ruleBlocks.find((b) => b.id === snapshot.blockId) ?? ruleBlocks[0]
          const blockStageRules = block.rules.filter((r) => r.stage === stage.key)
          kpiTotal += blockStageRules.length
          kpiHit += blockStageRules.reduce((sum, r) => {
            const progress = snapshot.ruleProgress.find((item) => item.ruleId === r.id)?.progress ?? 0
            return sum + (progress >= 1 ? 1 : 0)
          }, 0)
        }

        return {
          key: stage.key,
          label: stage.label,
          kpiTotal,
          kpiHit,
          ratio: kpiTotal > 0 ? kpiHit / kpiTotal : 0,
        }
      }),
    [ruleBlocks, snapshots]
  )

  const executiveMetricCardClass =
    'group relative overflow-hidden border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'

  const executivePanelCardClass =
    'group relative overflow-hidden border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'

  const lineChartData = useMemo(() => {
    const W = 500
    const H = 200
    const PAD = { top: 24, right: 16, bottom: 36, left: 44 }
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const totalStageKpis = stageSeries.reduce((sum, stage) => sum + stage.kpiTotal, 0)

    // Show % of KPIs conquered in each stage
    const points = stageSeries.map((stage, i) => {
      const pct = stage.ratio * 100
      const x = PAD.left + (stageSeries.length > 1 ? (i / (stageSeries.length - 1)) * plotW : plotW / 2)
      const y = PAD.top + plotH - (pct / 100) * plotH
      return { x, y, pct, hit: stage.kpiHit, total: stage.kpiTotal, label: stage.label, key: stage.key }
    })

    const linePath = smoothLinePath(points)
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`
        : ''

    const guides = [0, 25, 50, 75, 100].map((pct) => ({
      pct,
      y: PAD.top + plotH - (pct / 100) * plotH,
    }))

    return { W, H, PAD, plotW, plotH, points, linePath, areaPath, guides, totalStageKpis }
  }, [stageSeries])

  const sellerWeeklyHeatmap = useMemo(
    () =>
      snapshots.map((snapshot) => {
        const block = ruleBlocks.find((b) => b.id === snapshot.blockId) ?? ruleBlocks[0]
        const cells = STAGES.filter((s) => s.key !== 'FULL').map((stage) => {
          const blockStageRules = block.rules.filter((r) => r.stage === stage.key)
          const stageTarget = blockStageRules.reduce((sum, rule) => sum + rule.points, 0)
          const stageAchieved = blockStageRules.reduce((sum, rule) => {
            const progress =
              snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
            return sum + rule.points * Math.min(progress, 1)
          }, 0)
          const allHit =
            blockStageRules.length > 0 &&
            blockStageRules.every((rule) => {
              const progress = snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
              return progress >= 1
            })
          const ratio = stageTarget > 0 ? stageAchieved / stageTarget : 0
          // Only show 100%/emerald when EVERY individual KPI in the stage is completed.
          // Cap at 0.994 to prevent Intl rounding from displaying "100" when not all KPIs are done.
          return { stage: stage.label, stageKey: stage.key, ratio: !allHit && ratio >= 0.995 ? 0.994 : ratio }
        })
        return { seller: snapshot.seller, cells }
      }),
    [ruleBlocks, snapshots]
  )

  const heatCellClass = (ratio: number) => {
    if (ratio >= 1) return 'bg-emerald-600 text-white'
    if (ratio >= 0.85) return 'bg-cyan-600 text-white'
    if (ratio >= 0.7) return 'bg-blue-600 text-white'
    if (ratio >= 0.55) return 'bg-indigo-500 text-white'
    if (ratio >= 0.4) return 'bg-amber-400 text-surface-950'
    return 'bg-rose-300 text-surface-900'
  }

  const stageColorMap: Record<StageKey, string> = {
    W1: 'bg-cyan-500',
    W2: 'bg-blue-500',
    W3: 'bg-indigo-500',
    CLOSING: 'bg-emerald-500',
    FULL: 'bg-primary-500',
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Card className="relative border-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl">
        <div className="absolute inset-x-3 top-0 h-0.75 bg-linear-to-r from-primary-500 via-cyan-400 to-emerald-400" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Branding */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Gestão Comercial · Metas</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Painel de Metas — Ouro Verde</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCompanyModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {companyScopeFilter === 'all' ? 'Empresas: 1 e 2' : companyScopeFilter === '2' ? 'Empresa 2 — Maceió' : 'Empresa 1 — Ouro Verde'}
              </button>
              {!standby && !sellersLoading && (
                <span className="text-xs text-slate-500">{MONTHS[month]} {year}</span>
              )}
              {sellersLoading && (
                <span className="text-xs text-slate-500 animate-pulse">Carregando dados…</span>
              )}
            </div>
          </div>

          {/* Action area */}
          <div className="flex flex-wrap items-center gap-2">
            {view !== 'dashboard' ? (
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <ChevronLeft size={14} />
                Voltar ao painel
              </button>
            ) : (
              <>
                {/* Period picker */}
                <div className="relative" ref={periodPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowPeriodPicker((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold backdrop-blur-sm transition-all ${
                      showPeriodPicker
                        ? 'border-primary-400/60 bg-primary-500/20 text-primary-200 ring-1 ring-primary-400/30'
                        : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <CalendarDays size={14} />
                    <span>{MONTHS[month]} {year}</span>
                    {standby && <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Standby</span>}
                    <ChevronDown size={12} className={`transition-transform ${showPeriodPicker ? 'rotate-180' : ''}`} />
                  </button>

                  {showPeriodPicker && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-surface-200 bg-white p-5 shadow-2xl ring-1 ring-black/5">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-surface-400">Período de referência</p>

                      {/* Month/year navigation */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-label="Mês anterior"
                          onClick={() => { if (month === 0) { setMonth(11); setYear((y) => y - 1) } else { setMonth((m) => m - 1) } }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                        >
                          <ChevronLeft size={15} />
                        </button>

                        <div className="flex flex-1 items-center gap-2">
                          <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="flex-1 rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          >
                            {MONTHS.map((name, idx) => (
                              <option key={name} value={idx}>{name}</option>
                            ))}
                          </select>
                          <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="w-24 rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          aria-label="Próximo mês"
                          onClick={() => { if (month === 11) { setMonth(0); setYear((y) => y + 1) } else { setMonth((m) => m + 1) } }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => { const now = new Date(); setMonth(now.getMonth()); setYear(now.getFullYear()) }}
                        className="mt-2 w-full rounded-lg border border-surface-200 bg-surface-50 py-1.5 text-xs font-semibold text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                      >
                        Ir para mês atual
                      </button>

                      {standby ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {!activeMonth?.week1StartDate
                            ? 'Mês em standby — defina o início da 1ª semana em Configurações.'
                            : `Mês encerrado em ${formatDateBr(cycle.lastBusinessDate)}.`}
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-400">Ciclo operacional</p>
                            <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">{cycle.totalBusinessDays} dias úteis</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {cycle.weeks.filter((w) => w.key !== 'FULL').map((week) => {
                              const today = toIsoDate(new Date())
                              const isActive = week.start && week.end && today >= week.start && today <= week.end
                              return (
                                <div
                                  key={week.key}
                                  className={`rounded-lg border px-2.5 py-2 text-xs ${isActive ? 'border-primary-200 bg-primary-50' : 'border-surface-200 bg-surface-50'}`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${stageColorMap[week.key]}`} />
                                    <span className={`font-semibold ${isActive ? 'text-primary-700' : 'text-surface-700'}`}>{week.label}</span>
                                  </div>
                                  <p className="mt-0.5 text-surface-500">{week.start ? `${formatDateBr(week.start)} – ${formatDateBr(week.end)}` : '—'}</p>
                                  <p className="text-surface-400">{week.businessDays.length} dias úteis</p>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-5 w-px bg-white/20" />

                <button
                  type="button"
                  onClick={() => setView('config')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-500"
                >
                  <Settings2 size={14} />
                  Configurações
                </button>
                <button
                  type="button"
                  onClick={() => setView('sellers')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  <Users size={14} />
                  Vendedores
                </button>
                <button
                  type="button"
                  onClick={() => setView('products')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  <Boxes size={14} />
                  Produtos
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {view === 'config' ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-primary-600" />
                <h2 className="text-base font-semibold text-surface-900">Calendário operacional mensal</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className={label}>Mês<select className={input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}</select></label>
                <label className={label}>Ano<input className={input} type="number" min={2024} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
                <label className={label}>Início da 1ª semana<input className={input} type="date" min={`${year}-${String(month + 1).padStart(2, '0')}-01`} max={toIsoDate(new Date(year, month + 1, 0))} value={activeMonth?.week1StartDate ?? ''} onChange={(event) => setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: event.target.value, closingWeekEndDate: (activeMonth?.closingWeekEndDate && activeMonth.closingWeekEndDate >= event.target.value) ? activeMonth.closingWeekEndDate : '', customOffDates: activeMonth?.customOffDates ?? [] } }))} /></label>
                <label className={label}>Fim do fechamento<input className={input} type="date" min={activeMonth?.week1StartDate || `${year}-${String(month + 1).padStart(2, '0')}-01`} max={toIsoDate(new Date(year, month + 1, 0))} value={activeMonth?.closingWeekEndDate ?? ''} onChange={(event) => setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: activeMonth?.week1StartDate ?? firstMonday(year, month), closingWeekEndDate: event.target.value, customOffDates: activeMonth?.customOffDates ?? [] } }))} /></label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={includeNational} onChange={(event) => setIncludeNational(event.target.checked)} /> Considerar feriados nacionais oficiais</label>
                <Badge variant="secondary">Dias úteis no mês: {cycle.totalBusinessDays}</Badge>
              </div>

              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Desconsiderar data</p>
                <div className="mt-2 flex gap-2">
                  <input type="date" className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customDate) return
                      const list = activeMonth?.customOffDates ?? []
                      if (list.includes(customDate)) return
                      setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: activeMonth?.week1StartDate ?? firstMonday(year, month), closingWeekEndDate: activeMonth?.closingWeekEndDate ?? '', customOffDates: [...list, customDate].sort() } }))
                      setCustomDate('')
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                {(activeMonth?.customOffDates?.length ?? 0) > 0 ? <div className="mt-2 flex flex-wrap gap-2">{activeMonth?.customOffDates.map((date) => <button key={date} type="button" className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-100" onClick={() => setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: activeMonth?.week1StartDate ?? firstMonday(year, month), closingWeekEndDate: activeMonth?.closingWeekEndDate ?? '', customOffDates: (activeMonth?.customOffDates ?? []).filter((item) => item !== date) } }))}>{formatDateBr(date)} ×</button>)}</div> : null}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-4">{cycle.weeks.filter((w) => w.key !== 'FULL').map((week) => <div key={week.key} className="rounded-lg border border-surface-200 bg-white p-2.5 text-xs"><p className="font-semibold text-surface-700">{week.label}</p><p className="mt-1 text-surface-600">{formatDateBr(week.start)} - {formatDateBr(week.end)}</p><p className="text-surface-500">Dias úteis: {week.businessDays.length}</p></div>)}</div>

              {standby ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{!activeMonth?.week1StartDate ? 'Mês em standby: defina a data de início da 1ª semana para ativar o ciclo.' : `Período selecionado encerrou em ${formatDateBr(cycle.lastBusinessDate)}. O sistema permanece em standby até configurar o início do próximo ciclo.`}</div> : null}
            </Card>

            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2"><CircleDollarSign size={16} className="text-emerald-600" /><h2 className="text-base font-semibold text-surface-900">Parâmetros de premiação</h2></div>
              <label className={label}>Salário base<input className={input} type="number" step="0.01" value={salaryBase} onChange={(event) => setSalaryBase(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>Base de premiação<input className={input} type="number" step="0.01" value={basePremiation} onChange={(event) => setBasePremiation(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>Bônus extra de meta<input className={input} type="number" step="0.01" value={extraBonus} onChange={(event) => setExtraBonus(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>
                Pontos mínimos do bônus
                <input
                  className={input}
                  type="text"
                  inputMode="decimal"
                  value={extraMinPointsInput}
                  onChange={(event) => setExtraMinPointsInput(event.target.value)}
                  onBlur={() => {
                    const parsed = parsePointsInput(extraMinPointsInput)
                    setExtraMinPoints(parsed)
                    setExtraMinPointsInput(num(parsed, 2))
                  }}
                />
              </label>
              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm text-surface-700">
                <p>Potencial de KPIs: <strong>{currency(rewardTarget)}</strong> | {num(pointsTarget, 3)} pts</p>
                <p>Base de premiação: <strong>{currency(basePremiation)}</strong></p>
              </div>
            </Card>
          </div>

          {/* ── Escopo de empresas Sankhya ─────────────────── */}
          <Card className="border-surface-200">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-surface-900">Escopo de empresas (Sankhya)</h2>
                <p className="mt-0.5 text-xs text-surface-500">Define quais empresas do Sankhya são consideradas no cálculo de pedidos e faturamento.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { value: '1', label: 'Empresa 1', desc: 'Moagem Ouro Verde' },
                { value: '2', label: 'Empresa 2', desc: 'Moagem Ouro Verde Maceió' },
                { value: 'all', label: 'Ambas', desc: 'Consolidado geral' },
              ] as { value: CompanyScopeFilter; label: string; desc: string }[]).map(({ value, label, desc }) => {
                const active = companyScopeFilter === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCompanyScopeFilter(value)}
                    className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/50 ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-300'
                        : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-surface-800'}`}>{label}</span>
                    <span className={`text-xs ${active ? 'text-indigo-500' : 'text-surface-500'}`}>{desc}</span>
                  </button>
                )
              })}
            </div>

            {companyScopeFilter === 'all' && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Atenção: com ambas as empresas ativas, os totais de pedidos e faturamento incluem todas as filiais e podem divergir dos relatórios individuais do Sankhya.
              </div>
            )}
          </Card>

          {/* ── Multi-block KPI system ─────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900">Grupos de parâmetros por vendedor</h2>
            </div>
            <button
              type="button"
              onClick={() => setAddGroupModal({ open: true, search: '', selectedSellerId: '' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <UserPlus size={12} /> Adicionar vendedor
            </button>
          </div>

          {/* Block selector tabs */}
          {ruleBlocks.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg border border-surface-200 bg-surface-50 p-1">
              {ruleBlocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedBlockId === block.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {block.title}
                  {block.sellerIds.length > 0 && <span className="ml-1 text-[10px] opacity-75">({block.sellerIds.length})</span>}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const block = ruleBlocks.find((b) => b.id === selectedBlockId) ?? ruleBlocks[0]
            const updateBlock = (patch: Partial<RuleBlock>) => setRuleBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, ...patch } : b))
            const updateBlockRule = (ruleId: string, patch: Partial<GoalRule>) => updateBlock({ rules: block.rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r) })
            const assignedSellers = sellers.filter((s) => block.sellerIds.includes(s.id))
            const unassignedSellers = sellers.filter((s) => !ruleBlocks.some((b) => b.id !== block.id && b.sellerIds.includes(s.id)) || block.sellerIds.includes(s.id))
            const sellersInBlock = sellers.filter((s) => findBlockForSeller(s.id, ruleBlocks).id === block.id)
            const monthStartIso = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const stageLabelMap = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<StageKey, string>

            function getStageEndIso(stage: StageKey) {
              return cycle.weeks.find((w) => w.key === stage)?.end ?? null
            }

            function getSellerCode(seller: Salesperson) {
              return seller.id.replace(/^sankhya-/, '')
            }

            function getCumulativeRevenue(seller: Salesperson, stageEndIso: string | null) {
              if (!stageEndIso) return 0
              return seller.orders.reduce((sum, order) => (order.negotiatedAt <= stageEndIso ? sum + order.totalValue : sum), 0)
            }

            function getCumulativeReturns(seller: Salesperson, stageEndIso: string | null) {
              if (!stageEndIso) return 0
              return seller.returns.reduce((sum, row) => (row.negotiatedAt <= stageEndIso ? sum + row.totalValue : sum), 0)
            }

            function getDistinctClientsUntil(seller: Salesperson, stageEndIso: string | null) {
              if (!stageEndIso) return 0
              const set = new Set<string>()
              for (const order of seller.orders) {
                if (order.negotiatedAt > stageEndIso) continue
                const code = (order.clientCode ?? '').trim()
                if (code) set.add(code)
              }
              return set.size
            }

            function getTotalDistinctClientsInMonth(seller: Salesperson) {
              const set = new Set<string>()
              for (const order of seller.orders) {
                const code = (order.clientCode ?? '').trim()
                if (code) set.add(code)
              }
              return set.size
            }

            function renderKpiInspector(rule: GoalRule, kpiType: KpiType) {
              const inspectorKey = `${block.id}:${rule.id}`
              const isOpen = kpiInspectorOpenKey === inspectorKey
              const stageEndIso = getStageEndIso(rule.stage)
              const selectedSeller =
                sellersInBlock.find((s) => s.id === kpiInspectorSellerId) ??
                sellersInBlock[0] ??
                null
              const parameterNumber = Math.max(parseTargetNumber(rule.targetText) ?? 0, 0)
              const stageLabel = stageLabelMap[rule.stage] ?? rule.stage

              return (
                <div className="relative">
                  <button
                    type="button"
                    className="rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-primary-600"
                    title="Abrir auditoria técnica do KPI"
                    onClick={(e) => {
                      if (isOpen) {
                        setKpiInspectorOpenKey(null)
                        setKpiInspectorAnchor(null)
                        return
                      }
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      const estimatedHeight = 340
                      const openUp = window.innerHeight - rect.bottom < estimatedHeight
                      setKpiInspectorOpenKey(inspectorKey)
                      setKpiInspectorSellerId((prev) => {
                        if (sellersInBlock.some((s) => s.id === prev)) return prev
                        return sellersInBlock[0]?.id ?? ''
                      })
                      setKpiInspectorAnchor({
                        top: openUp ? rect.top - 8 : rect.bottom + 8,
                        left: rect.right,
                        openUp,
                      })
                    }}
                  >
                    <CircleHelp size={14} />
                  </button>
                  {isOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => {
                          setKpiInspectorOpenKey(null)
                          setKpiInspectorAnchor(null)
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="fixed z-[70] w-96 rounded-xl border border-surface-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
                        style={{
                          top: kpiInspectorAnchor?.top ?? 0,
                          left: kpiInspectorAnchor?.left ?? 0,
                          transform: kpiInspectorAnchor?.openUp ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                        }}
                      >
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-surface-800">Auditoria do KPI (Sankhya)</p>
                          <p className="text-[10px] text-surface-500">{stageLabel} · Período {formatDateBr(monthStartIso)} a {stageEndIso ? formatDateBr(stageEndIso) : '--'}</p>
                        </div>

                        {sellersInBlock.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-surface-200 bg-surface-50 px-2.5 py-2 text-xs text-surface-500">
                            Nenhum vendedor neste grupo para auditar.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">Vendedor</p>
                              <select
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-surface-800"
                                value={selectedSeller?.id ?? ''}
                                onChange={(e) => setKpiInspectorSellerId(e.target.value)}
                              >
                                {sellersInBlock.map((sellerOption) => (
                                  <option key={sellerOption.id} value={sellerOption.id}>{sellerOption.name}</option>
                                ))}
                              </select>
                            </div>

                            {selectedSeller ? (() => {
                              const sellerCode = getSellerCode(selectedSeller)
                              const revenue = getCumulativeRevenue(selectedSeller, stageEndIso)
                              const returned = getCumulativeReturns(selectedSeller, stageEndIso)
                              const distinctClientsCum = getDistinctClientsUntil(selectedSeller, stageEndIso)
                              const distinctClientsMonth = getTotalDistinctClientsInMonth(selectedSeller)
                              const officialBaseClients = Math.max(selectedSeller.baseClientCount ?? 0, 0)
                              const resolvedBaseClients = officialBaseClients > 0 ? officialBaseClients : distinctClientsMonth
                              const teamAverageTicket = (() => {
                                const tickets = sellers
                                  .filter((s) => s.totalOrders > 0)
                                  .map((s) => s.totalValue / Math.max(s.totalOrders, 1))
                                if (tickets.length === 0) return 0
                                return tickets.reduce((sum, value) => sum + value, 0) / tickets.length
                              })()
                              const orderCountCum = stageEndIso
                                ? selectedSeller.orders.filter((o) => o.negotiatedAt <= stageEndIso).length
                                : 0
                              const avgTicketCum = orderCountCum > 0 ? revenue / orderCountCum : 0

                              let title = 'Resultado apurado'
                              let lines: Array<{ label: string; value: string }> = []
                              let resultLabel = 'Resultado'
                              let resultValue = ''
                              let ok = false

                              if (kpiType === 'DEVOLUCAO') {
                                const actualPct = revenue > 0 ? (returned / revenue) * 100 : 0
                                title = 'Devolução sobre faturado'
                                lines = [
                                  { label: 'Faturado no período', value: currency(revenue) },
                                  { label: 'Devolvido no período', value: currency(returned) },
                                  { label: 'Limite parametrizado', value: `${num(parameterNumber, 3)}%` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = `${num(actualPct, 3)}%`
                                ok = parameterNumber > 0 && actualPct <= parameterNumber
                              } else if (kpiType === 'BASE_CLIENTES') {
                                const coveragePct = resolvedBaseClients > 0 ? (distinctClientsCum / resolvedBaseClients) * 100 : 0
                                title = 'Cobertura da base'
                                lines = [
                                  { label: 'Clientes únicos acumulados', value: `${distinctClientsCum}` },
                                  { label: 'Base total de clientes do vendedor', value: `${resolvedBaseClients}` },
                                  { label: 'Meta parametrizada', value: `${num(parameterNumber, 2)}%` },
                                ]
                                resultLabel = 'Cobertura apurada'
                                resultValue = `${num(coveragePct, 2)}%`
                                ok = parameterNumber > 0 && coveragePct >= parameterNumber
                              } else if (kpiType === 'META_FINANCEIRA') {
                                const monthlyTargetSafe = block.monthlyTarget > 0 ? block.monthlyTarget : 0
                                const required = parameterNumber > 0 ? monthlyTargetSafe * (parameterNumber / 100) : monthlyTargetSafe
                                const progressPct = required > 0 ? (revenue / required) * 100 : 0
                                title = 'Meta financeira acumulada'
                                lines = [
                                  { label: 'Faturado acumulado', value: currency(revenue) },
                                  { label: 'Meta do bloco', value: currency(monthlyTargetSafe) },
                                  { label: 'Alvo da etapa', value: required > 0 ? currency(required) : 'Não definido' },
                                ]
                                resultLabel = 'Atingimento da etapa'
                                resultValue = `${num(progressPct, 2)}%`
                                ok = required > 0 && revenue >= required
                              } else if (kpiType === 'VOLUME') {
                                const requiredGroups = Math.max(Math.floor(parameterNumber), 0)
                                const ratios = getSellerWeightTargetRatios(block.weightTargets ?? [], brandWeightRows, sellerCode)
                                const achievedGroups = ratios.filter((ratio) => ratio >= 1).length
                                const volumeProgress = requiredGroups > 0
                                  ? getVolumeProgressByClosestTargets(ratios, requiredGroups)
                                  : 0
                                const equivalentGroups = volumeProgress * Math.max(requiredGroups, 1)
                                title = 'Grupos de peso atingidos'
                                lines = [
                                  { label: 'Grupos com meta batida', value: `${achievedGroups}` },
                                  { label: 'Grupos exigidos no parâmetro', value: `${requiredGroups}` },
                                  { label: 'Progresso aproximado', value: `${num(volumeProgress * 100, 1)}%` },
                                  { label: 'Metas de peso no bloco', value: `${(block.weightTargets ?? []).length}` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = requiredGroups > 0
                                  ? `${num(equivalentGroups, 2)}/${requiredGroups}`
                                  : 'N/A'
                                ok = requiredGroups > 0 && volumeProgress >= 1
                              } else if (kpiType === 'DISTRIBUICAO') {
                                const parts = rule.targetText.split('|').map((s) => s.trim())
                                const itemsPart = parts[0] ?? '0'
                                const itemsIsPercent = itemsPart.includes('%')
                                const itemsNum = parseDecimal(itemsPart.replace('%', ''), 0)
                                const totalActiveProducts = productAllowlist.filter((p) => p.active).length
                                const resolvedItems = itemsIsPercent && totalActiveProducts > 0
                                  ? Math.ceil(totalActiveProducts * itemsNum / 100)
                                  : itemsNum
                                const clientsPct = Math.max(parseDecimal(parts[1] ?? '0', 0), 0)
                                const coveragePct = resolvedBaseClients > 0 ? (distinctClientsCum / resolvedBaseClients) * 100 : 0
                                title = 'Distribuição por clientes e itens'
                                lines = [
                                  { label: 'Clientes únicos acumulados', value: `${distinctClientsCum}` },
                                  { label: 'Base total de clientes do vendedor', value: `${resolvedBaseClients}` },
                                  { label: 'Cobertura da base', value: `${num(coveragePct, 2)}%` },
                                  { label: 'Itens alvo resolvidos', value: `${num(resolvedItems, 0)} item(ns)` },
                                  { label: 'Parâmetro de base', value: `${num(clientsPct, 2)}%` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = `${num(coveragePct, 2)}% base`
                                ok = clientsPct > 0 && coveragePct >= clientsPct
                              } else if (kpiType === 'ITEM_FOCO') {
                                const { volumePct, basePct } = parseItemFocoTarget(rule.targetText)
                                const focusCode = (block.focusProductCode ?? '').trim()
                                const focusRow = focusCode
                                  ? (focusProductRows[focusCode] ?? []).find((row) => row.sellerCode === sellerCode)
                                  : null
                                const soldKg = focusRow?.soldKg ?? 0
                                const soldClients = Number(focusRow?.soldClients ?? 0)
                                const baseTotalClients = resolvedBaseClients
                                const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
                                const requiredKg = focusTargetKg * (Math.max(volumePct, 0) / 100)
                                const requiredBaseClients = basePct > 0
                                  ? Math.ceil(baseTotalClients * (basePct / 100))
                                  : 0
                                const baseCoveragePct = baseTotalClients > 0 ? (soldClients / baseTotalClients) * 100 : 0
                                const baseGoalOk = requiredBaseClients > 0 ? soldClients >= requiredBaseClients : true
                                title = 'Item foco (volume + base de clientes)'
                                lines = [
                                  { label: 'Meta do item foco (kg)', value: `${num(focusTargetKg, 2)} kg` },
                                  { label: 'Volume mínimo exigido', value: `${num(requiredKg, 2)} kg` },
                                  { label: 'Vendido do item foco', value: `${num(soldKg, 2)} kg` },
                                  { label: 'Base total de clientes do vendedor', value: `${baseTotalClients}` },
                                  { label: 'Clientes com item foco', value: `${soldClients}` },
                                  { label: 'Meta de base (clientes)', value: requiredBaseClients > 0 ? `${requiredBaseClients} (${num(basePct, 2)}%)` : `${num(basePct, 2)}%` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = `${num(baseCoveragePct, 2)}% base`
                                ok = requiredKg > 0 && soldKg >= requiredKg && baseGoalOk
                              } else if (kpiType === 'RENTABILIDADE') {
                                const targetPct = Math.max(parameterNumber, 0)
                                const threshold = targetPct > 0 ? teamAverageTicket * (targetPct / 100) : 0
                                title = 'Rentabilidade por ticket médio'
                                lines = [
                                  { label: 'Ticket médio acumulado', value: currency(avgTicketCum) },
                                  { label: 'Ticket médio da equipe', value: currency(teamAverageTicket) },
                                  { label: 'Parâmetro rentabilidade', value: `${num(targetPct, 2)}%` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = threshold > 0 ? `${num((avgTicketCum / threshold) * 100, 2)}%` : 'N/A'
                                ok = threshold > 0 && avgTicketCum >= threshold
                              } else if (kpiType === 'INADIMPLENCIA') {
                                const { pct: inadPct, days: atrasoDias } = parseInadimplenciaTarget(rule.targetText)
                                const overdueTitles = stageEndIso
                                  ? selectedSeller.openTitles.filter((title) => title.dueDate <= stageEndIso && title.overdueDays > atrasoDias)
                                  : []
                                const overdueValue = overdueTitles.reduce((sum, title) => sum + title.totalValue, 0)
                                const actualPct = revenue > 0 ? (overdueValue / revenue) * 100 : 0
                                title = 'Inadimplência acumulativa'
                                lines = [
                                  { label: 'Faturado acumulado', value: currency(revenue) },
                                  { label: 'Títulos em aberto > prazo', value: currency(overdueValue) },
                                  { label: 'Quantidade de títulos', value: `${overdueTitles.length}` },
                                  { label: 'Parâmetro de inadimplência', value: `${num(inadPct, 2)}%` },
                                  { label: 'Prazo mínimo em atraso', value: `${atrasoDias} dias` },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = `${num(actualPct, 3)}%`
                                ok = inadPct > 0 && actualPct <= inadPct
                              } else {
                                title = 'KPI personalizado'
                                lines = [
                                  { label: 'Parâmetro textual', value: rule.targetText || '—' },
                                  { label: 'Tipo de KPI', value: kpiType },
                                ]
                                resultLabel = 'Resultado apurado'
                                resultValue = 'Sem fórmula padrão'
                                ok = false
                              }

                              return (
                                <div className="rounded-lg border border-surface-200 bg-surface-50 p-2.5 text-xs text-surface-700">
                                  <p className="mb-2 text-[11px] font-semibold text-surface-800">{title}</p>
                                  <div className="space-y-1.5">
                                    {lines.map((line) => (
                                      <div key={line.label} className="flex items-center justify-between gap-2">
                                        <span>{line.label}</span>
                                        <strong className="text-surface-900">{line.value}</strong>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 border-t border-surface-200 pt-2 flex items-center justify-between">
                                    <span>{resultLabel}</span>
                                    <strong className={ok ? 'text-emerald-700' : 'text-rose-700'}>{resultValue}</strong>
                                  </div>
                                </div>
                              )
                            })() : null}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            }

            return (
              <Card key={block.id} className="border-surface-200">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                      value={block.title}
                      onChange={(e) => updateBlock({ title: e.target.value })}
                    />
                    {block.sellerIds.length === 0 && (
                      <Badge variant="secondary">Grupo padrão — aplica a vendedores não atribuídos</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmModal({
                        open: true,
                        title: 'Restaurar padrões',
                        message: `Restaurar todos os KPIs do grupo "${block.title}" para os valores padrão? As regras atuais serão substituídas e essa ação não pode ser desfeita.`,
                        confirmLabel: 'Restaurar',
                        variant: 'danger',
                        onConfirm: () => updateBlock({ rules: DEFAULT_RULES.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })) }),
                      })}
                      className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
                    >
                      <RotateCcw size={12} /> Restaurar padrões
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBlock({ rules: [...block.rules, { id: `rule-${Date.now()}`, stage: 'W1', frequency: 'WEEKLY', kpiType: 'BASE_CLIENTES' as KpiType, kpi: 'Base de clientes', description: 'Cobertura da base de clientes no período.', targetText: '0%', rewardValue: 0, points: 0 }] })}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                    >
                      <Plus size={12} /> Novo KPI
                    </button>
                    {ruleBlocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setConfirmModal({
                          open: true,
                          title: 'Excluir grupo',
                          message: `Deseja excluir o grupo "${block.title}"? Os vendedores atribuídos voltarão ao grupo padrão.`,
                          confirmLabel: 'Excluir',
                          variant: 'danger',
                          onConfirm: () => {
                            setRuleBlocks((prev) => prev.filter((b) => b.id !== block.id))
                            setSelectedBlockId((prev) => prev === block.id ? (ruleBlocks.find((b) => b.id !== block.id)?.id ?? '') : prev)
                          },
                        })}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Excluir grupo
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta em dinheiro + seller assignment */}
                <div className="mb-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className={label}>
                      Meta financeira do mês (R$)
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        min="0"
                        value={block.monthlyTarget}
                        onChange={(e) => updateBlock({ monthlyTarget: parseDecimal(e.target.value, 0) })}
                      />
                    </label>
                    <p className="mt-1 text-[10px] text-surface-400">
                      {block.monthlyTarget > 0
                        ? `Cada vendedor neste bloco tem como referência ${currency(block.monthlyTarget)} no mês.`
                        : 'Sem meta financeira definida — usa a média da equipe como referência.'}
                    </p>
                  </div>
                  <div>
                    <p className={label}>Vendedores neste bloco</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {assignedSellers.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 border border-primary-200">
                          {s.name.split(' ').slice(0, 2).join(' ')}
                          <button
                            type="button"
                            onClick={() => setConfirmModal({
                              open: true,
                              title: 'Remover vendedor do grupo',
                              message: `Deseja remover "${s.name}" do grupo "${block.title}"? O vendedor voltará a usar o grupo padrão.`,
                              confirmLabel: 'Remover',
                              variant: 'danger',
                              onConfirm: () => updateBlock({ sellerIds: block.sellerIds.filter((id) => id !== s.id) }),
                            })}
                            className="ml-0.5 flex items-center justify-center rounded-full p-0.5 text-primary-400 hover:bg-primary-100 hover:text-rose-600 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (sellerPickerBlockId === block.id) {
                              setSellerPickerBlockId(null)
                              setSellerPickerSearch('')
                            } else {
                              setSellerPickerBlockId(block.id)
                              setSellerPickerSearch('')
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary-300 bg-primary-50/40 px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 hover:border-primary-400 transition-colors"
                        >
                          <UserPlus size={11} /> Adicionar vendedor
                        </button>
                        {sellerPickerBlockId === block.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => { setSellerPickerBlockId(null); setSellerPickerSearch('') }}
                              aria-hidden="true"
                            />
                            <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-surface-200 bg-white shadow-xl ring-1 ring-black/5">
                              <div className="p-2 border-b border-surface-100">
                                <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5">
                                  <Search size={12} className="text-surface-400 shrink-0" />
                                  <input
                                    autoFocus
                                    placeholder="Buscar vendedor..."
                                    className="flex-1 bg-transparent text-xs text-surface-800 placeholder-surface-400 outline-none"
                                    value={sellerPickerSearch}
                                    onChange={(e) => setSellerPickerSearch(e.target.value)}
                                  />
                                  {sellerPickerSearch && (
                                    <button type="button" onClick={() => setSellerPickerSearch('')} className="text-surface-400 hover:text-surface-600">
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <ul className="max-h-56 overflow-y-auto py-1 divide-y divide-surface-50">
                                {unassignedSellers
                                  .filter((s) => !block.sellerIds.includes(s.id))
                                  .filter((s) => !sellerPickerSearch || s.name.toLowerCase().includes(sellerPickerSearch.toLowerCase()))
                                  .map((s) => {
                                    const initials = s.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                                    return (
                                      <li key={s.id}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-primary-50 transition-colors"
                                          onClick={() => setConfirmModal({
                                            open: true,
                                            title: 'Adicionar vendedor ao grupo',
                                            message: `Deseja adicionar "${s.name}" ao grupo "${block.title}"?`,
                                            confirmLabel: 'Adicionar',
                                            variant: 'primary',
                                            onConfirm: () => {
                                              updateBlock({ sellerIds: [...block.sellerIds, s.id] })
                                              setSellerPickerBlockId(null)
                                              setSellerPickerSearch('')
                                            },
                                          })}
                                        >
                                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">{initials}</span>
                                          <span className="truncate text-xs font-medium text-surface-800">{s.name}</span>
                                        </button>
                                      </li>
                                    )
                                  })}
                                {unassignedSellers
                                  .filter((s) => !block.sellerIds.includes(s.id))
                                  .filter((s) => !sellerPickerSearch || s.name.toLowerCase().includes(sellerPickerSearch.toLowerCase()))
                                  .length === 0 && (
                                  <li className="px-3 py-4 text-center text-xs text-surface-400">
                                    {sellerPickerSearch ? 'Nenhum resultado para essa busca' : 'Todos os vendedores já estão atribuídos'}
                                  </li>
                                )}
                              </ul>
                              <div className="border-t border-surface-100 px-3 py-2 text-[10px] text-surface-400">
                                {unassignedSellers.filter((s) => !block.sellerIds.includes(s.id)).length} vendedor(es) disponível(is)
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPI rules table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">Período</th><th className="px-3 py-2">KPI</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Parâmetro</th><th className="px-3 py-2">Premiação</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {block.rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-surface-50/50">
                          <td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.stage} onChange={(e) => updateBlockRule(rule.id, { stage: e.target.value as StageKey })}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td>
                          <td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.kpiType ?? 'CUSTOM'} onChange={(e) => { const sel = KPI_CATALOG.find((k) => k.type === e.target.value); const defaultTarget = e.target.value === 'DISTRIBUICAO' ? '0%|0' : e.target.value === 'VOLUME' ? '0' : e.target.value === 'ITEM_FOCO' ? '0|0' : e.target.value === 'INADIMPLENCIA' ? '0|45' : '0%'; updateBlockRule(rule.id, { kpiType: e.target.value as KpiType, kpi: sel?.label ?? rule.kpi, description: sel?.defaultDescription || rule.description, targetText: defaultTarget }) }}>{KPI_CATALOG.map((k) => <option key={k.type} value={k.type}>{k.label}</option>)}</select></td>
                          <td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.description} onChange={(e) => updateBlockRule(rule.id, { description: e.target.value })} /></td>
                          <td className="px-3 py-2">{(() => {
                            const kpiType = rule.kpiType ?? inferKpiType(rule.kpi)

                            if (kpiType === 'DISTRIBUICAO') {
                              const parts = rule.targetText.split('|')
                              const itemsPart = parts[0] ?? ''
                              const isPercent = itemsPart.includes('%')
                              const itemsVal = itemsPart.replace('%', '')
                              const clientsVal = parts[1] ?? ''
                              return (
                                <div className="flex items-center gap-1">
                                  <input className="w-12 rounded border border-surface-200 px-1.5 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" placeholder="0" title={isPercent ? '% dos itens totais' : 'Qtd. itens alvo'} value={itemsVal} onChange={(e) => { const v = e.target.value + (isPercent ? '%' : ''); updateBlockRule(rule.id, { targetText: `${v}|${clientsVal}` }) }} />
                                  <button type="button" className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isPercent ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500'}`} title="Alternar entre % e absoluto" onClick={() => { const v = itemsVal; updateBlockRule(rule.id, { targetText: `${v}${isPercent ? '' : '%'}|${clientsVal}` }) }}>{isPercent ? '%' : 'Nº'}</button>
                                  <span className="text-[10px] text-surface-400">itens</span>
                                  <input className="w-12 rounded border border-surface-200 px-1.5 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" placeholder="0" title="% da base de clientes" value={clientsVal} onChange={(e) => { updateBlockRule(rule.id, { targetText: `${itemsPart}|${e.target.value}` }) }} />
                                  <span className="text-[10px] text-surface-400">% base</span>
                                  {renderKpiInspector(rule, kpiType)}
                                </div>
                              )
                            }

                            if (kpiType === 'VOLUME') {
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="0"
                                    title="Quantidade mínima de grupos de produto com meta de peso batida"
                                    value={String(Math.max(0, Math.floor(parseTargetNumber(rule.targetText) ?? 0)))}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: String(Math.max(0, Math.floor(parseDecimal(e.target.value, 0)))) })}
                                  />
                                  {renderKpiInspector(rule, kpiType)}
                                </div>
                              )
                            }

                            if (kpiType === 'ITEM_FOCO') {
                              const parsed = parseItemFocoTarget(rule.targetText)
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="w-14 rounded border border-surface-200 px-1.5 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="0"
                                    title="% mínimo do volume para item foco"
                                    value={parsed.volumePct || ''}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: formatItemFocoTarget(parseDecimal(e.target.value, 0), parsed.basePct) })}
                                  />
                                  <span className="text-[10px] text-surface-400">% vol.</span>
                                  <input
                                    className="w-14 rounded border border-surface-200 px-1.5 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="0"
                                    title="% da base total de clientes do vendedor para positivação do item foco"
                                    value={parsed.basePct || ''}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: formatItemFocoTarget(parsed.volumePct, parseDecimal(e.target.value, 0)) })}
                                  />
                                  <span className="text-[10px] text-surface-400">% base</span>
                                  {renderKpiInspector(rule, kpiType)}
                                </div>
                              )
                            }

                            if (kpiType === 'DEVOLUCAO') {
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="0"
                                    title="% máximo de devolução sobre o faturado no período"
                                    value={parseTargetNumber(rule.targetText) ?? 0}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: `${Math.max(parseDecimal(e.target.value, 0), 0)}%` })}
                                  />
                                  <span className="text-[10px] text-surface-400">%</span>
                                  {renderKpiInspector(rule, kpiType)}
                                </div>
                              )
                            }

                            if (kpiType === 'INADIMPLENCIA') {
                              const parsed = parseInadimplenciaTarget(rule.targetText)
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="w-16 rounded border border-surface-200 px-2 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="0"
                                    title="% máximo de inadimplência sobre o faturado no período"
                                    value={parsed.pct || ''}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: formatInadimplenciaTarget(parseDecimal(e.target.value, 0), parsed.days) })}
                                  />
                                  <span className="text-[10px] text-surface-400">%</span>
                                  <input
                                    className="w-16 rounded border border-surface-200 px-2 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={1}
                                    step={1}
                                    placeholder="45"
                                    title="Dias mínimos em atraso (títulos em aberto com DHBAIXA nulo)"
                                    value={parsed.days || ''}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: formatInadimplenciaTarget(parsed.pct, Math.max(Math.floor(parseDecimal(e.target.value, 45)), 1)) })}
                                  />
                                  <span className="text-[10px] text-surface-400">dias</span>
                                  {renderKpiInspector(rule, kpiType)}
                                </div>
                              )
                            }

                            return (
                              <div className="flex items-center gap-1">
                                <input className="flex-1 rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.targetText} onChange={(e) => updateBlockRule(rule.id, { targetText: e.target.value })} />
                                {renderKpiInspector(rule, kpiType)}
                              </div>
                            )
                          })()}</td>
                          <td className="px-3 py-2"><input className="w-24 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.01" value={rule.rewardValue} onChange={(e) => updateBlockRule(rule.id, { rewardValue: parseDecimal(e.target.value, 0) })} /></td>
                          <td className="px-3 py-2"><input className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.001" value={rule.points} onChange={(e) => updateBlockRule(rule.id, { points: parseDecimal(e.target.value, 0) })} /></td>
                          <td className="px-3 py-2"><button type="button" onClick={() => updateBlock({ rules: block.rules.filter((r) => r.id !== rule.id) })} className="rounded p-1 text-surface-400 hover:bg-rose-50 hover:text-rose-600" title="Remover KPI"><span className="text-xs">✕</span></button></td>
                        </tr>
                      ))}
                      <tr className="bg-surface-50 font-semibold">
                        <td className="px-3 py-2 text-xs text-surface-500" colSpan={4}>
                          Totais — {block.rules.length} KPIs
                          {block.monthlyTarget > 0 && <span className="ml-2 text-emerald-600">| Meta: {currency(block.monthlyTarget)}</span>}
                          {block.sellerIds.length > 0 && <span className="ml-2 text-primary-600">| {block.sellerIds.length} vendedor(es)</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-surface-700">{currency(block.rules.reduce((s, r) => s + r.rewardValue, 0))}</td>
                        <td className="px-3 py-2 text-xs text-surface-700">{num(block.rules.reduce((s, r) => s + r.points, 0), 3)}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Metas de peso por grupo de produto ───────── */}
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes size={14} className="text-cyan-600" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Metas de peso por grupo de produto</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newTarget: WeightTarget = {
                          id: `wt-${Date.now()}`,
                          brand: '',
                          targetKg: 0,
                        }
                        updateBlock({ weightTargets: [...(block.weightTargets ?? []), newTarget] })
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-cyan-300 bg-cyan-50/50 px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 transition-colors"
                    >
                      <Plus size={11} /> Adicionar grupo
                    </button>
                  </div>
                  {(!block.weightTargets || block.weightTargets.length === 0) ? (
                    <p className="rounded-lg border border-dashed border-surface-200 bg-surface-50 px-3 py-4 text-center text-xs text-surface-400">
                      Nenhuma meta de peso definida. Clique em "Adicionar grupo" para configurar.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-surface-200 text-sm">
                        <thead>
                          <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                            <th className="px-3 py-2">Grupo de produto (marca)</th>
                            <th className="px-3 py-2">Meta (kg)</th>
                            <th className="px-3 py-2">Vendido (kg)</th>
                            <th className="px-3 py-2">Progresso</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {(block.weightTargets ?? []).map((wt) => {
                            const sellerCodes = block.sellerIds.map((sid) => {
                              const s = sellers.find((x) => x.id === sid)
                              return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '')
                            })
                            const actualKg = brandWeightRows
                              .filter((r) => {
                                if (!wt.brand) return false
                                if (sellerCodes.length === 0) return r.brand === wt.brand.toUpperCase()
                                return r.brand === wt.brand.toUpperCase() && sellerCodes.some((sc) => r.sellerCode === sc)
                              })
                              .reduce((sum, r) => sum + r.totalKg, 0)
                            const rawProgress = wt.targetKg > 0 ? actualKg / wt.targetKg : 0
                            const progressPct = rawProgress * 100
                            const barPct = Math.min(progressPct, 100)
                            const progressColor = rawProgress >= 1 ? 'bg-emerald-500' : rawProgress >= 0.8 ? 'bg-cyan-500' : rawProgress >= 0.6 ? 'bg-amber-400' : 'bg-rose-400'
                            const progressTextColor = rawProgress >= 1 ? 'text-emerald-600' : rawProgress >= 0.8 ? 'text-cyan-600' : rawProgress >= 0.6 ? 'text-amber-500' : 'text-rose-500'
                            return (
                              <tr key={wt.id} className="hover:bg-surface-50/50">
                                <td className="px-3 py-2">
                                  <select
                                    className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs bg-white"
                                    value={wt.brand}
                                    onChange={(e) => {
                                      const updated = (block.weightTargets ?? []).map((x) => x.id === wt.id ? { ...x, brand: e.target.value } : x)
                                      updateBlock({ weightTargets: updated })
                                    }}
                                  >
                                    <option value="">Selecionar grupo...</option>
                                    {/* Known brands from allowlist and from fetched data */}
                                    {[...new Set([
                                      ...productAllowlist.map((p) => p.brand.toUpperCase()).filter(Boolean),
                                      ...brandWeightBrands,
                                    ])].sort().map((brand) => (
                                      <option key={brand} value={brand}>{brand}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="w-32 rounded border border-surface-200 px-2 py-1.5 text-xs"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    value={wt.targetKg || ''}
                                    onChange={(e) => {
                                      const updated = (block.weightTargets ?? []).map((x) => x.id === wt.id ? { ...x, targetKg: parseDecimal(e.target.value, 0) } : x)
                                      updateBlock({ weightTargets: updated })
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 text-xs text-surface-700">
                                  {brandWeightLoading ? (
                                    <span className="text-surface-400">Carregando...</span>
                                  ) : brandWeightError ? (
                                    <span className="text-amber-600" title={brandWeightError}>—</span>
                                  ) : (
                                    <span className={actualKg >= wt.targetKg && wt.targetKg > 0 ? 'font-semibold text-emerald-600' : ''}>
                                      {num(actualKg, 2)} kg
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {wt.targetKg > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-200">
                                        <div className={`h-full transition-[width] duration-700 ${progressColor}`} style={{ width: `${barPct}%` }} />
                                      </div>
                                      <span className={`text-[11px] font-semibold ${progressTextColor}`}>
                                        {num(progressPct, 1)}%{rawProgress > 1 && <span className="ml-0.5 text-[9px] text-emerald-500">↑</span>}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-surface-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (block.weightTargets ?? []).filter((x) => x.id !== wt.id)
                                      updateBlock({ weightTargets: updated })
                                    }}
                                    className="rounded p-1 text-surface-400 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="bg-surface-50 font-semibold border-t border-surface-200">
                            <td className="px-3 py-2 text-xs text-surface-500">
                              Total — {(block.weightTargets ?? []).filter((w) => w.targetKg > 0).length} metas de peso configuradas
                            </td>
                            <td className="px-3 py-2 text-xs text-surface-700">
                              {num((block.weightTargets ?? []).reduce((s, w) => s + w.targetKg, 0), 2)} kg
                            </td>
                            <td className="px-3 py-2 text-xs text-surface-700">
                              {(() => {
                                const sc = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '') })
                                const total = (block.weightTargets ?? []).reduce((sum, wt) => sum + brandWeightRows.filter((r) => wt.brand && r.brand === wt.brand.toUpperCase() && (sc.length === 0 || sc.some((c) => r.sellerCode === c))).reduce((s2, r) => s2 + r.totalKg, 0), 0)
                                return <>{num(total, 2)} kg</>
                              })()}
                            </td>
                            <td className="px-3 py-2 text-xs" colSpan={2}>
                              {(() => {
                                const sc = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '') })
                                const totalTarget = (block.weightTargets ?? []).reduce((s, w) => s + w.targetKg, 0)
                                const totalActual = (block.weightTargets ?? []).reduce((sum, wt) => sum + brandWeightRows.filter((r) => wt.brand && r.brand === wt.brand.toUpperCase() && (sc.length === 0 || sc.some((c) => r.sellerCode === c))).reduce((s2, r) => s2 + r.totalKg, 0), 0)
                                if (totalTarget <= 0) return <span className="text-surface-400">—</span>
                                const pct = totalActual / totalTarget * 100
                                if (pct >= 100) {
                                  return <span className="font-semibold text-emerald-600">+{num(pct - 100, 1)}% acima da meta ↑</span>
                                }
                                const color = pct >= 80 ? 'text-cyan-700' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
                                return <span className={`font-semibold ${color}`}>{num(pct, 1)}% da meta total atingida</span>
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-indigo-600" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Item foco do mês</p>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-surface-200 bg-surface-50 p-3 md:grid-cols-[1.6fr_0.7fr] md:items-end">
                    <label className={label}>
                      Produto foco
                      <select
                        className={`${input} text-sm`}
                        value={block.focusProductCode ?? ''}
                        onChange={(e) => updateBlock({ focusProductCode: e.target.value })}
                      >
                        <option value="">Selecionar produto...</option>
                        {productAllowlist
                          .filter((p) => p.active)
                          .sort((a, b) => a.description.localeCompare(b.description))
                          .map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.description} · {p.brand}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className={label}>
                      Meta do item (kg)
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={block.focusTargetKg ?? ''}
                        onChange={(e) => updateBlock({ focusTargetKg: parseDecimal(e.target.value, 0) })}
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    {(!block.focusProductCode || !block.focusTargetKg) ? (
                      <p className="rounded-lg border border-dashed border-surface-200 bg-white px-3 py-4 text-center text-xs text-surface-400">
                        Selecione um produto da lista e defina a meta (kg) para acompanhar o item foco por vendedor.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-surface-200 text-sm">
                          <thead>
                            <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Item foco</th>
                              <th className="px-3 py-2">Meta (kg)</th>
                              <th className="px-3 py-2">Vendido (kg)</th>
                              <th className="px-3 py-2">Base total (clientes)</th>
                              <th className="px-3 py-2">Positivação da base</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-100">
                            {(() => {
                              const focusCode = (block.focusProductCode ?? '').trim()
                              const rows = focusCode ? (focusProductRows[focusCode] ?? []) : []
                              const loading = focusCode ? focusProductLoading[focusCode] : false
                              const error = focusCode ? focusProductError[focusCode] : ''
                              const sellersInBlock = block.sellerIds.length > 0 ? sellers.filter((s) => block.sellerIds.includes(s.id)) : sellers
                              const focusProduct = productAllowlist.find((p) => p.code === focusCode)

                              if (loading) {
                                return (
                                  <tr>
                                    <td className="px-3 py-3 text-xs text-surface-400" colSpan={6}>Carregando item foco...</td>
                                  </tr>
                                )
                              }
                              if (error) {
                                return (
                                  <tr>
                                    <td className="px-3 py-3 text-xs text-rose-600" colSpan={6}>{error}</td>
                                  </tr>
                                )
                              }
                              if (sellersInBlock.length === 0) {
                                return (
                                  <tr>
                                    <td className="px-3 py-3 text-xs text-surface-400" colSpan={6}>Nenhum vendedor neste bloco.</td>
                                  </tr>
                                )
                              }

                              const sellerCodes = new Set(sellersInBlock.map((seller) => seller.id.replace(/^sankhya-/, '')))
                              const blockRows = rows.filter((r) => sellerCodes.has(r.sellerCode))
                              const soldKg = blockRows.reduce((sum, row) => sum + (row.soldKg ?? 0), 0)
                              const soldClients = blockRows.reduce((sum, row) => sum + Number(row.soldClients ?? 0), 0)
                              const targetKg = Math.max(block.focusTargetKg ?? 0, 0)
                              const itemFocoRule = block.rules.find((rule) => (rule.kpiType ?? inferKpiType(rule.kpi)) === 'ITEM_FOCO')
                              const itemFocoParams = itemFocoRule ? parseItemFocoTarget(itemFocoRule.targetText) : { volumePct: 0, basePct: 0 }
                              const volumeRequiredKg = targetKg > 0 ? targetKg * (Math.max(itemFocoParams.volumePct, 0) / 100) : 0
                              const volumeOk = volumeRequiredKg > 0 ? soldKg >= volumeRequiredKg : soldKg > 0
                              const baseTotalClients = sellersInBlock.reduce((sum, seller) => {
                                const official = Math.max(seller.baseClientCount ?? 0, 0)
                                if (official > 0) return sum + official
                                const clientSet = new Set<string>()
                                for (const order of seller.orders) {
                                  const code = (order.clientCode ?? '').trim()
                                  if (code) clientSet.add(code)
                                }
                                return sum + clientSet.size
                              }, 0)
                              const basePct = Math.max(itemFocoParams.basePct, 0)
                              const requiredBaseClients = basePct > 0 ? Math.ceil(baseTotalClients * (basePct / 100)) : 0
                              const baseCoveragePct = baseTotalClients > 0 ? (soldClients / baseTotalClients) * 100 : 0
                              const baseOk = requiredBaseClients > 0 ? soldClients >= requiredBaseClients : true
                              const baseColor = baseOk ? 'text-emerald-700' : 'text-rose-700'
                              const sku = focusProduct?.code ?? focusCode
                              const itemNome = focusProduct?.description ?? 'Item não encontrado na lista'

                              return (
                                <tr key={`focus-item-${focusCode}`} className="hover:bg-surface-50/50">
                                  <td className="px-3 py-2 text-xs font-semibold text-surface-800">{sku || '—'}</td>
                                  <td className="px-3 py-2 text-xs text-surface-700">{itemNome}</td>
                                  <td className="px-3 py-2 text-xs text-surface-700">{num(targetKg, 2)} kg</td>
                                  <td className="px-3 py-2 text-xs text-surface-700">
                                    <div className="font-medium">{num(soldKg, 2)} kg</div>
                                    {itemFocoParams.volumePct > 0 ? (
                                      <div className={`text-[10px] ${volumeOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        mínimo {num(itemFocoParams.volumePct, 0)}% = {num(volumeRequiredKg, 2)} kg
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-surface-700">{baseTotalClients}</td>
                                  <td className={`px-3 py-2 text-xs font-semibold ${baseColor}`}>
                                    {num(baseCoveragePct, 1)}%
                                    {basePct > 0 ? (
                                      <span className="ml-1 text-[10px] font-medium text-surface-500">
                                        (meta {num(basePct, 0)}% = {requiredBaseClients} clientes)
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })()}

          <Card className="border-surface-200">
            <h2 className="mb-3 text-base font-semibold text-surface-900">Campanhas de premiação (mensal e trimestral)</h2>
            <div className="space-y-2">
              {prizes.map((prize) => (
                <div key={prize.id} className="grid gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 md:grid-cols-6 md:items-end">
                  <label className={label}>Campanha<input className={input} value={prize.title} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, title: event.target.value } : item))} /></label>
                  <label className={label}>Frequência<select className={input} value={prize.frequency} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, frequency: event.target.value as CampaignPrize['frequency'] } : item))}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option></select></label>
                  <label className={label}>Tipo<select className={input} value={prize.type} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? normalizePrize({ ...item, type: event.target.value as PrizeType }) : item))}><option value="CASH">Financeira</option><option value="BENEFIT">Benefício</option></select></label>
                  {prize.type === 'CASH' ? (
                    <label className={label}>
                      <span>{(prize.cashMode ?? 'PERCENT') === 'FIXED' ? 'Valor fixo (R$)' : 'Percentual sobre a meta'}</span>
                      <div className="relative mt-1">
                        {(prize.cashMode ?? 'PERCENT') === 'FIXED' ? (
                          <input
                            className={`${input} pr-16`}
                            type="text"
                            inputMode="numeric"
                            value={formatBrlNumber(prize.rewardValue)}
                            onChange={(event) =>
                              setPrizes((prev) =>
                                prev.map((item) =>
                                  item.id === prize.id
                                    ? { ...item, rewardValue: parseBrlNumber(event.target.value) }
                                    : item
                                )
                              )
                            }
                          />
                        ) : (
                          <input
                            className={`${input} pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            type="number"
                            step="0.01"
                            value={prize.rewardValue}
                            onChange={(event) =>
                              setPrizes((prev) =>
                                prev.map((item) =>
                                  item.id === prize.id
                                    ? { ...item, rewardValue: parseDecimal(event.target.value, 0) }
                                    : item
                                )
                              )
                            }
                          />
                        )}
                        <select
                          className="absolute right-1.5 top-1/2 z-10 h-7 w-14 -translate-y-1/2 rounded-md border border-surface-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-surface-700 shadow-sm"
                          value={prize.cashMode ?? 'PERCENT'}
                          onChange={(event) =>
                            setPrizes((prev) =>
                              prev.map((item) =>
                                item.id === prize.id
                                  ? { ...item, cashMode: event.target.value as CashCalcMode }
                                  : item
                              )
                            )
                          }
                        >
                          <option value="PERCENT">%</option>
                          <option value="FIXED">R$</option>
                        </select>
                      </div>
                    </label>
                  ) : (
                    <label className={label}>Premiação<input className={input} placeholder="Ex: Viagem, produto, voucher…" value={prize.benefitDescription} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, benefitDescription: event.target.value } : item))} /></label>
                  )}
                  <label className={label}>Pontos mínimos<input className={input} type="number" step="0.01" value={prize.minPoints} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, minPoints: parseDecimal(event.target.value, 0) } : item))} /></label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={prize.active} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, active: event.target.checked } : item))} /> Ativa</label>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : view === 'sellers' ? (
        <>
          <Card className="border-surface-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Configuração específica</p>
                <h2 className="text-base font-semibold text-surface-900">Vendedores considerados no painel de metas</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={syncAllowlistFromSankhya}
                  disabled={allowlistSyncing}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {allowlistSyncing ? 'Sincronizando...' : 'Sincronizar Sankhya'}
                </button>
                <button
                  type="button"
                  onClick={() => setAllowlist((prev) => [...prev, { code: null, partnerCode: null, name: '', active: true }])}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
                >
                  <Plus size={12} /> Adicionar vendedor
                </button>
                <button
                  type="button"
                  onClick={saveAllowlist}
                  disabled={allowlistSaving}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {allowlistSaving ? 'Salvando...' : 'Salvar lista'}
                </button>
              </div>
            </div>

            {allowlistLoading ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-sm text-surface-500">Carregando vendedores da meta...</div>
            ) : (
              <div className="space-y-2">
                {allowlistError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{allowlistError}</div>
                ) : null}
                {allowlistSuccess ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{allowlistSuccess}</div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">Ativo</th>
                        <th className="px-3 py-2">Nome do vendedor</th>
                        <th className="px-3 py-2">Código vendedor</th>
                        <th className="px-3 py-2">Código parceiro</th>
                        <th className="px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {allowlist.map((seller, index) => (
                        <tr key={`seller-allow-${index}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary-600"
                              checked={seller.active}
                              onChange={(event) =>
                                setAllowlist((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, active: event.target.checked } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-surface-700">{seller.name}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-surface-700">{seller.code ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-surface-700">{seller.partnerCode ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeSellerAndSave(index)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-surface-500">
                  Critério de correspondência: código de vendedor, código de parceiro ou nome (normalizado).
                </p>
              </div>
            )}
          </Card>
        </>
      ) : view === 'products' ? (
        <>
          <Card className="border-surface-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Configuração específica</p>
                <h2 className="text-base font-semibold text-surface-900">Produtos considerados no painel de metas</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={syncProductAllowlistFromSankhya}
                  disabled={productAllowlistSyncing}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {productAllowlistSyncing ? 'Sincronizando...' : 'Sincronizar Sankhya'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProductAllowlist((prev) => [
                      ...prev,
                      { code: '', description: '', brand: 'CAFES', unit: 'UN', mobility: 'SIM', active: true },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
                >
                  <Plus size={12} /> Adicionar produto
                </button>
                <button
                  type="button"
                  onClick={saveProductAllowlist}
                  disabled={productAllowlistSaving}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {productAllowlistSaving ? 'Salvando...' : 'Salvar lista'}
                </button>
              </div>
            </div>

            {productAllowlistLoading ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-sm text-surface-500">Carregando produtos da meta...</div>
            ) : (
              <div className="space-y-3">
                {productAllowlistError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{productAllowlistError}</div>
                ) : null}
                {productAllowlistSuccess ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{productAllowlistSuccess}</div>
                ) : null}

                <div className="grid gap-2 md:grid-cols-3">
                  <label className={label}>
                    Filtro por código
                    <input
                      className={input}
                      value={productCodeFilter}
                      onChange={(event) => setProductCodeFilter(event.target.value)}
                      placeholder="Ex.: 910"
                    />
                  </label>
                  <label className={label}>
                    Filtro por descrição
                    <input
                      className={input}
                      value={productDescriptionFilter}
                      onChange={(event) => setProductDescriptionFilter(event.target.value)}
                      placeholder="Ex.: CAFE"
                    />
                  </label>
                  <label className={label}>
                    Filtro por marca/categoria
                    <input
                      className={input}
                      value={productBrandFilter}
                      onChange={(event) => setProductBrandFilter(event.target.value)}
                      placeholder="Ex.: GRAOS"
                    />
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">Ativo</th>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2">Marca</th>
                        <th className="px-3 py-2">Unidade padrão</th>
                        <th className="px-3 py-2">Mobilidade</th>
                        <th className="px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {filteredProductAllowlist.map((product, index) => (
                        <tr key={`product-allow-${product.code}-${index}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary-600"
                              checked={product.active}
                              onChange={(event) =>
                                setProductAllowlist((prev) =>
                                  prev.map((item) =>
                                    item.code === product.code && item.description === product.description
                                      ? { ...item, active: event.target.checked }
                                      : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-surface-700">{product.code}</td>
                          <td className="px-3 py-2 text-xs text-surface-700">{product.description}</td>
                          <td className="px-3 py-2 text-xs text-surface-700">{product.brand}</td>
                          <td className="px-3 py-2 text-xs text-surface-700">{product.unit}</td>
                          <td className="px-3 py-2 text-xs text-surface-700">{product.mobility}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeProductAndSave(product.code, product.description)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-surface-500">
                  Filtros corporativos aplicados na sincronização: Mobilidade = SIM, e marcas permitidas: CAFÉS, COLORÍFICOS/TEMPEROS, GRÃOS, RAÇÃO PASSAROS, RAÇÃO PET - CACHORRO e RAÇÃO PET - GATO.
                </p>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* ── Period selector ────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="group relative overflow-hidden border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary-500 to-cyan-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta de faturamento</p>
              {corporateTotalTarget > 0 ? (() => {
                const pct = Math.min(corporateTotalRevenue / corporateTotalTarget * 100, 100)
                const exceeded = corporateTotalRevenue > corporateTotalTarget
                return (
                  <>
                    <p className={`mt-2 text-3xl font-bold ${exceeded ? 'text-emerald-600' : 'text-surface-900'}`}>
                      {num(pct, 1)}%
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ${exceeded ? 'bg-emerald-500' : pct >= 80 ? 'bg-cyan-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {exceeded ? (
                      <p className="mt-1.5 text-xs font-semibold text-emerald-600">
                        +{num((corporateTotalRevenue / corporateTotalTarget - 1) * 100, 1)}% acima da meta ↑
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-surface-500">
                        {currency(corporateTotalTarget - corporateTotalRevenue)} restam para atingir a meta
                      </p>
                    )}
                  </>
                )
              })() : (
                <>
                  <p className="mt-2 text-3xl font-bold text-surface-900">{num(factoryGoalRatio * 100, 1)}%</p>
                  <p className="mt-2 text-xs text-surface-500">{onTargetCount}/{snapshots.length || 0} vendedores com meta batida</p>
                </>
              )}
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 to-emerald-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">CUSTO DE PREMIAÇÕES</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{currency(rewardDonut.totalEarned)}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-500 transition-[width] duration-700"
                  style={{ width: `${Math.min(rewardDonut.pctCommitted, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-surface-500">
                {num(rewardDonut.pctCommitted, 1)}% comprometido da previsão de {currency(rewardDonut.totalTarget)}
              </p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-primary-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Pedidos no mês</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{num(corporateTotalOrders, 0)}</p>
              <p className="mt-2 text-xs text-surface-500">Consolidado dos vendedores monitorados</p>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500" />
              <div className="grid grid-cols-2 gap-4 divide-x divide-surface-100">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Meta de peso consolidada</p>
                  {corporateTotalWeightTarget > 0 ? (
                    <>
                      <p className="mt-1 text-2xl font-semibold text-surface-700">{num(corporateTotalWeightTarget, 2)} kg</p>
                      <p className="mt-1 text-[10px] text-surface-400">Soma das metas de peso por grupo de produto</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-2xl font-semibold text-surface-400 italic">—</p>
                      <p className="mt-1 text-[10px] text-surface-400">Configure em Configurações → metas de peso</p>
                    </>
                  )}
                </div>
                <div className="pl-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Peso total dos pedidos</p>
                  <p className={`mt-1 text-2xl font-semibold ${
                    corporateTotalWeightTarget > 0 && corporateTotalGrossWeight >= corporateTotalWeightTarget
                      ? 'text-emerald-600'
                      : 'text-surface-900'
                  }`}>{num(corporateTotalGrossWeight, 2)} kg</p>
                  {corporateTotalWeightTarget > 0 ? (
                    <p className="mt-1 text-[10px] text-surface-400">
                      {num(Math.min(corporateTotalGrossWeight / corporateTotalWeightTarget * 100, 999), 1)}% da meta de peso
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-surface-400">Soma do peso bruto dos pedidos no período</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <div className="grid grid-cols-2 gap-4 divide-x divide-surface-100">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Meta consolidada</p>
                  <p className="mt-1 text-2xl font-semibold text-surface-700">{currency(corporateTotalTarget)}</p>
                  <p className="mt-1 text-[10px] text-surface-400">Soma das metas individuais dos vendedores</p>
                </div>
                <div className="pl-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Valor total de Pedidos</p>
                  <p className={`mt-1 text-2xl font-semibold ${
                    corporateTotalTarget > 0 && corporateTotalRevenue >= corporateTotalTarget
                      ? 'text-emerald-600'
                      : 'text-surface-900'
                  }`}>{currency(corporateTotalRevenue)}</p>
                  {corporateTotalTarget > 0 && (
                    <p className="mt-1 text-[10px] text-surface-400">
                      {num(Math.min(corporateTotalRevenue / corporateTotalTarget * 100, 999), 1)}% da meta consolidada
                    </p>
                  )}
                  {corporateTotalTarget === 0 && (
                    <p className="mt-1 text-[10px] text-surface-400">Valor total dos pedidos no mês</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {showPeriodHint ? (
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm font-semibold text-amber-900">Sem pedidos no período selecionado</p>
              <p className="mt-1 text-xs text-amber-800">
                No mês selecionado ({MONTHS[month]}/{year}) não houve pedidos para os vendedores da lista.
                Verifique se os vendedores ativos possuem movimentações comerciais no período.
              </p>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-violet-500" />
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                  Tendência de evolução
                </p>
                <p className="text-[9px] text-surface-400">% de KPIs conquistados por etapa</p>
              </div>
              <div className="mt-3">
                <svg viewBox={`0 0 ${lineChartData.W} ${lineChartData.H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="trend-area-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="trend-line-grad" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <filter id="trend-dot-glow">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#3b82f6" floodOpacity="0.5" />
                    </filter>
                  </defs>

                  {/* Grid lines + Y labels */}
                  {lineChartData.guides.map((g) => (
                    <g key={g.pct}>
                      <line
                        x1={lineChartData.PAD.left} x2={lineChartData.W - lineChartData.PAD.right}
                        y1={g.y} y2={g.y}
                        stroke={g.pct === 100 ? '#c7d2fe' : '#e2e8f0'}
                        strokeWidth={g.pct === 100 ? 1.5 : 1}
                        strokeDasharray={g.pct === 0 ? 'none' : '4 4'}
                      />
                      <text x={lineChartData.PAD.left - 6} y={g.y + 4} textAnchor="end"
                        fill="#94a3b8" style={{ fontSize: 7, fontWeight: 500 }}>
                        {g.pct}%
                      </text>
                    </g>
                  ))}

                  {/* Area fill */}
                  {lineChartData.areaPath && (
                    <path d={lineChartData.areaPath} fill="url(#trend-area-grad)" />
                  )}

                  {/* Line */}
                  {lineChartData.linePath && (
                    <path
                      d={lineChartData.linePath}
                      fill="none"
                      stroke="url(#trend-line-grad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Dots + value labels */}
                  {lineChartData.points.map((pt, idx) => {
                    const isFirst = idx === 0
                    const isLast = idx === lineChartData.points.length - 1
                    const xLabelAnchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle'
                    return (
                    <g key={pt.key}>
                      <circle cx={pt.x} cy={pt.y} r="5" fill="white" stroke="#6366f1" strokeWidth="2" filter="url(#trend-dot-glow)" />
                      <circle cx={pt.x} cy={pt.y} r="2.5" fill="#6366f1" />
                      {/* value above dot */}
                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="#1e293b"
                        style={{ fontSize: 8, fontWeight: 700 }}>
                        {Math.round(pt.pct)}%
                      </text>
                      {/* X label */}
                      <text x={pt.x} y={lineChartData.H - 8} textAnchor={xLabelAnchor} fill="#64748b"
                        style={{ fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {pt.label}
                      </text>
                    </g>
                    )
                  })}
                </svg>
              </div>
              <p className="mt-1 text-[9px] text-surface-400">{lineChartData.totalStageKpis} KPIs monitorados nas etapas · {MONTHS[month]} {year}</p>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-teal-400 via-cyan-500 to-sky-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Aderência por Etapa Semanal</p>
              <p className="mt-0.5 text-[10px] text-surface-400">KPIs conquistados em cada etapa do ciclo</p>
              <div className="mt-4 space-y-2.5">
                {(() => {
                  const stageHex: Record<string, string> = {
                    W1: '#06b6d4', W2: '#3b82f6', W3: '#6366f1', CLOSING: '#10b981', FULL: '#10b981',
                  }
                  return stageSeries.map((stage) => {
                    const hitRatio = stage.ratio
                    const color = stageHex[stage.key] ?? '#64748b'
                    const missingKpis = Math.max(stage.kpiTotal - stage.kpiHit, 0)
                    return (
                      <div key={stage.key} className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-white px-3 py-2.5 ring-1 ring-surface-200 shadow-sm">
                        {/* left accent */}
                        <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
                        <div className="flex-1 min-w-0 pl-1">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-surface-700 truncate">{stage.label}</span>
                            <span className="text-[10px] text-surface-400 tabular-nums shrink-0">{stage.kpiHit}/{stage.kpiTotal}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                            <div
                              className="h-full rounded-full transition-[width] duration-700"
                              style={{ width: `${Math.min(hitRatio * 100, 100)}%`, backgroundColor: color }}
                            />
                          </div>
                          {stage.kpiTotal > 0 && (
                            <p className="mt-1 text-[9px] text-surface-400">
                              {missingKpis} KPI{missingKpis !== 1 ? 's' : ''} ainda não conquistado{missingKpis !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </Card>
          </div>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-400 via-teal-500 to-cyan-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                Premiação por Desempenho
              </p>
              <p className="mt-0.5 text-[10px] text-surface-400">KPIs conquistados no período selecionado — {MONTHS[month]} {year}</p>
              {snapshots.length === 0 ? (
                <p className="py-8 text-center text-xs text-surface-400">Aguardando dados de vendedores…</p>
              ) : (
                <div className="mt-4 grid gap-6 xl:grid-cols-[1.5fr_3.5fr]">
                  {/* ── Donut grande ──────────────────────────── */}
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg className="w-full max-w-56 h-auto" viewBox="0 0 200 200">
                      {/* Track */}
                      <circle cx="100" cy="100" r="76" fill="none" stroke="#f1f5f9" strokeWidth="22" />
                      {/* Single KPI progress segment */}
                      {rewardDonut.totalKpiTarget > 0 && (
                        <circle
                          cx="100" cy="100" r="76"
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="22"
                          strokeDasharray={`${(rewardDonut.kpiCommittedPct / 100) * (2 * Math.PI * 76)} ${2 * Math.PI * 76}`}
                          strokeDashoffset={0}
                          strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }}
                        />
                      )}
                      {/* Center text */}
                      <text x="100" y="95" textAnchor="middle" className="fill-surface-400" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Premiação atual</text>
                      <text x="100" y="113" textAnchor="middle" className="fill-surface-900" style={{ fontSize: 13, fontWeight: 700 }}>{currency(rewardDonut.totalEarned)}</text>
                    </svg>
                    {/* KPI summary */}
                    <div className="mt-2 w-full max-w-56 rounded-xl border border-surface-100 bg-surface-50/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-surface-700">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" />
                          KPIs alcançados
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-surface-900">
                          {rewardDonut.totalKpiHit}/{rewardDonut.totalKpiTarget}
                        </span>
                      </div>
                    </div>
                    {/* Previsão máxima — ao final da coluna do donut */}
                    {rewardDonut.totalTarget > 0 && (
                      <div className="mt-3 w-full max-w-56 rounded-xl border border-surface-200 bg-surface-50/80 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-surface-500">
                          <span className="font-semibold uppercase tracking-[0.08em] leading-tight">Previsão máxima</span>
                          <span className="font-bold text-surface-800 tabular-nums">{currency(rewardDonut.totalTarget)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-200">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-[width] duration-700"
                            style={{ width: `${rewardDonut.pctCommitted}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[9px] text-surface-400">
                          {num(rewardDonut.pctCommitted, 1)}% comprometida
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-4">
                    {/* Grid vendedores — sem rodapé de orçamento aqui */}
                    <div className="flex-1">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-surface-400">Premiação por vendedor</p>
                      {sellerRewardRows.length === 0 ? (
                        <p className="text-[10px] text-surface-400">Nenhuma premiação acumulada ainda.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {sellerRewardRows.map((row, i) => {
                            const rankRatio = sellerRewardRows.length > 1
                              ? 1 - i / (sellerRewardRows.length - 1)
                              : 1
                            const rankColor =
                              rankRatio >= 0.8 ? '#0ea5e9' :
                              rankRatio >= 0.55 ? '#3b82f6' :
                              rankRatio >= 0.3 ? '#f59e0b' : '#f43f5e'
                            const pct = row.target > 0 ? Math.min(row.earned / row.target * 100, 100) : 0
                            const isZero = row.earned === 0
                            return (
                              <div
                                key={i}
                                className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-white px-3 pt-2.5 pb-2 shadow-sm ring-1 ring-surface-200 transition-all duration-150 hover:ring-surface-300 hover:shadow-md"
                              >
                                {/* rank badge */}
                                <span className="absolute right-2 top-1.5 text-[9px] font-semibold tabular-nums text-surface-300">#{i + 1}</span>
                                {/* colored left rule */}
                                <span className="absolute inset-y-0 left-0 w-0.75 rounded-l-lg" style={{ backgroundColor: rankColor }} />
                                {/* name */}
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-surface-500 leading-none mb-1.5">{row.name}</p>
                                {/* value */}
                                <p className={`text-[13px] font-extrabold tabular-nums leading-none ${isZero ? 'text-surface-300' : 'text-surface-900'}`}>
                                  {currency(row.earned)}
                                </p>
                                {/* progress + max */}
                                <div className="mt-2 space-y-1">
                                  <div className="h-0.75 w-full overflow-hidden rounded-full bg-surface-100">
                                    <div
                                      className="h-full rounded-full transition-[width] duration-700"
                                      style={{ width: `${pct}%`, backgroundColor: rankColor }}
                                    />
                                  </div>
                                  {row.target > 0 && (
                                    <p className="text-[9px] tabular-nums text-surface-400 leading-none">máx. {currency(row.target)}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

          <Card className={executivePanelCardClass}>
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-500" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
              Desempenho individual de vendedores
            </p>
            <p className="mt-0.5 text-[10px] text-surface-400">
              Clique no card do vendedor para expandir os detalhes completos no próprio bloco.
            </p>
            {sellersLoading ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-sm text-surface-500">
                Carregando vendedores...
              </div>
            ) : sellersError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-4 text-sm text-rose-700">
                {sellersError}
              </div>
            ) : snapshots.length === 0 ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-sm text-surface-500">
                Nenhum vendedor ativo encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const rows = sellerWeeklyHeatmap
                    .map((row) => {
                      const snapshot = snapshots.find((s) => s.seller.id === row.seller.id)
                      if (!snapshot) return null
                      const avgRatio = row.cells.length > 0
                        ? row.cells.reduce((sum, cell) => sum + cell.ratio, 0) / row.cells.length
                        : 0
                      const pointsRatio = snapshot.pointsTarget > 0 ? snapshot.pointsAchieved / snapshot.pointsTarget : 0
                      return {
                        id: row.seller.id,
                        nameShort: getSellerShortName(row.seller.name),
                        fullName: row.seller.name,
                        login: row.seller.login,
                        rank: snapshots.findIndex((s) => s.seller.id === row.seller.id) + 1,
                        status: snapshot.status,
                        pointsAchieved: snapshot.pointsAchieved,
                        pointsTarget: snapshot.pointsTarget,
                        uniqueClients: snapshot.uniqueClients,
                        pointsRatio,
                        avgRatio,
                        snapshot,
                        cells: row.cells,
                      }
                    })
                    .filter((row): row is NonNullable<typeof row> => row !== null)

                    const periodClosed = hasMonthEnded(year, month, activeMonth?.closingWeekEndDate ?? '') && Boolean(cycle.lastBusinessDate)
                    const avgPoints = rows.length > 0
                      ? rows.reduce((sum, row) => sum + row.pointsAchieved, 0) / rows.length
                      : 0
                    const avgGapToFull = rows.length > 0
                      ? rows.reduce((sum, row) => sum + Math.max(1 - row.pointsAchieved, 0), 0) / rows.length
                      : 0
                    const kpiSummary = rows.reduce(
                      (acc, row) => {
                        const block = findBlockForSeller(row.id, ruleBlocks)
                        const total = block.rules.length
                        const hit = block.rules.filter((rule) => {
                          const progress = row.snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
                          return progress >= 1
                        }).length
                        return { hit: acc.hit + hit, total: acc.total + total }
                      },
                      { hit: 0, total: 0 }
                    )

                    return (
                      <>
                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
                          <div className="relative overflow-hidden rounded-xl border border-sky-200 bg-linear-to-br from-sky-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-sky-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-700">Vendedores monitorados</p>
                            <p className="mt-1 text-2xl font-bold text-sky-900 tabular-nums">{rows.length}</p>
                            <p className="text-[10px] text-sky-700">Base ativa no período selecionado</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-indigo-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-indigo-700">Clientes únicos atendidos</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-900 tabular-nums">{num(corporateUniqueClients, 0)}</p>
                            <p className="text-[10px] text-indigo-700">Total no período selecionado</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-cyan-200 bg-linear-to-br from-cyan-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-cyan-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-700">Pontuação média da equipe</p>
                            <p className="mt-1 text-2xl font-bold text-cyan-900 tabular-nums">{num(avgPoints, 2)} pts</p>
                            <p className="text-[10px] text-cyan-700">Média geral de pontos alcançados no ciclo</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-emerald-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">KPIs conquistados no ciclo</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-900 tabular-nums">{kpiSummary.hit}/{kpiSummary.total}</p>
                            <p className="text-[10px] text-emerald-700">
                              {periodClosed ? `Gap médio para 1,00 pt: ${num(avgGapToFull, 2)} pts` : 'Parcial até a data atual'}
                            </p>
                          </div>
                        </div>

                      <div className="space-y-1.5">
                        <div className="grid grid-cols-[44px_2.35fr_1fr_1fr_repeat(4,0.82fr)_24px] items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                          <span className="text-center">#</span>
                          <span>Vendedor</span>
                          <span className="text-center">Pontuação</span>
                          <span className="text-center">Clientes atendidos</span>
                          {STAGES.filter((stage) => stage.key !== 'FULL').map((stage) => (
                            <span key={`head-compact-${stage.key}`} className="text-center">{stage.label}</span>
                          ))}
                          <span />
                        </div>
                        {rows.map((row) => {
                          const isOpen = selectedSellerId === row.id
                          const sellerBlock = findBlockForSeller(row.id, ruleBlocks)
                          const kpisTotal = sellerBlock.rules.length
                          const kpisHit = sellerBlock.rules.filter((rule) => {
                            const progress = row.snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
                            return progress >= 1
                          }).length
                          return (
                            <div
                              key={`seller-accordion-${row.id}`}
                              className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                                isOpen
                                  ? 'border-slate-300 bg-white shadow-md ring-1 ring-slate-200'
                                  : 'border-surface-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedSellerId((prev) => (prev === row.id ? '' : row.id))}
                                className="w-full cursor-pointer px-2.5 py-1.5 text-left transition-colors duration-200"
                              >
                                <div className="grid grid-cols-[44px_2.35fr_1fr_1fr_repeat(4,0.82fr)_24px] items-center gap-1.5">
                                  <span className={`text-center text-xs font-semibold tabular-nums ${isOpen ? 'text-slate-700' : 'text-surface-500'}`}>{row.rank}</span>
                                  <span className="block min-w-0 truncate text-sm font-semibold text-surface-900">{row.nameShort}</span>
                                  <span className="rounded-md border border-surface-200 bg-white px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-surface-800">{num(row.pointsAchieved, 2)} pts</span>
                                  <span className="rounded-md border border-surface-200 bg-white px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-surface-800">{num(row.uniqueClients, 0)}</span>
                                  {row.cells.map((cell) => (
                                    <span
                                      key={`seller-stage-pill-${row.id}-${cell.stageKey}`}
                                      className={`rounded-md px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums ${heatCellClass(cell.ratio)}`}
                                    >
                                      {num(cell.ratio * 100, 0)}%
                                    </span>
                                  ))}
                                  <ChevronDown
                                    size={14}
                                    className={`justify-self-center text-surface-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </button>

                              {isOpen && (
                                <div className="border-t border-slate-300 bg-linear-to-b from-slate-100 via-blue-50/45 to-cyan-50/35 px-3 py-3">
                                  <div className="rounded-xl border border-slate-300/80 bg-linear-to-br from-white via-slate-50 to-blue-50/40 shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/60">
                                    <div className="relative overflow-hidden border-b border-slate-200/80">
                                      <div className="px-3 py-3">
                                        <div>
                                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Painel do vendedor</p>
                                          <p className="text-base font-semibold text-slate-900">{row.fullName}</p>
                                          <p className="text-[11px] text-slate-500">Resumo executivo de performance e KPIs no período selecionado.</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Pontuação</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{num(row.snapshot.pointsAchieved, 3)} / {num(row.snapshot.pointsTarget, 3)} pts</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Pedidos no mês</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{num(row.snapshot.totalOrders, 0)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Faturamento</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{currency(row.snapshot.totalValue)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Peso bruto</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{num(row.snapshot.totalGrossWeight, 2)} kg</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Premiação por KPIs</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{currency(row.snapshot.kpiRewardAchieved)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Clientes atendidos</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{num(row.snapshot.uniqueClients, 0)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Gap para meta</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{num(row.snapshot.gapToTarget, 3)} pts</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">KPIs alcançados</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{kpisHit}/{kpisTotal}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">KPIs e parâmetros do ciclo</p>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                      {sellerBlock.rules.map((rule) => {
                                        const progress = row.snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
                                        const done = progress >= 1
                                        const progressPct = Math.min(progress * 100, 100)
                                        const kpiState = done
                                          ? 'HIT'
                                          : progress >= 0.85
                                            ? 'NEAR'
                                            : progress >= 0.5
                                              ? 'MID'
                                              : 'FAR'
                                        const stageLabel = STAGES.find((s) => s.key === rule.stage)?.label ?? rule.stage
                                        const stageChipClass = 'bg-slate-100 text-slate-600 ring-slate-200'
                                        const progressTrackClass = 'bg-slate-200/80'
                                        const stateTheme: Record<'HIT' | 'NEAR' | 'MID' | 'FAR', { card: string; bar: string; text: string; icon: string; subtext: string; badgeBg: string; top: string }> = {
                                          HIT: {
                                            card: 'border-emerald-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100/70',
                                            bar: 'bg-emerald-500',
                                            text: 'text-emerald-700',
                                            icon: 'text-emerald-600',
                                            subtext: 'text-slate-600',
                                            badgeBg: 'bg-emerald-50',
                                            top: 'bg-emerald-400/70',
                                          },
                                          NEAR: {
                                            card: 'border-amber-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-amber-100/70',
                                            bar: 'bg-amber-500',
                                            text: 'text-amber-700',
                                            icon: 'text-amber-600',
                                            subtext: 'text-slate-600',
                                            badgeBg: 'bg-amber-50',
                                            top: 'bg-amber-400/70',
                                          },
                                          MID: {
                                            card: 'border-orange-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-orange-100/70',
                                            bar: 'bg-orange-500',
                                            text: 'text-orange-700',
                                            icon: 'text-orange-600',
                                            subtext: 'text-slate-600',
                                            badgeBg: 'bg-orange-50',
                                            top: 'bg-orange-400/70',
                                          },
                                          FAR: {
                                            card: 'border-red-300 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-red-100/80',
                                            bar: 'bg-red-500',
                                            text: 'text-red-700',
                                            icon: 'text-red-600',
                                            subtext: 'text-slate-600',
                                            badgeBg: 'bg-red-50',
                                            top: 'bg-red-400/70',
                                          },
                                        }
                                        const visual = stateTheme[kpiState]
                                        const topAccentClass = visual.top
                                        return (
                                          <div
                                            key={`seller-rule-${row.id}-${rule.id}`}
                                            className={`group relative overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)] ${visual.card}`}
                                          >
                                            <div className={`absolute inset-x-0 top-0 h-0.75 ${topAccentClass}`} />
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ring-1 ${stageChipClass}`}>{stageLabel}</span>
                                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${visual.badgeBg}`}>
                                                {done ? <TrendingUp size={12} className={visual.icon} /> : <TrendingDown size={12} className={visual.icon} />}
                                              </span>
                                            </div>
                                            <p className="line-clamp-1 text-xs font-semibold text-slate-900">{rule.kpi} ({rule.targetText})</p>
                                            <p className={`mt-0.5 line-clamp-2 text-[10px] leading-relaxed ${visual.subtext}`}>{rule.description}</p>
                                            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${progressTrackClass}`}>
                                              <div
                                                className={`h-full rounded-full transition-[width] duration-700 ${visual.bar}`}
                                                style={{ width: `${progressPct}%` }}
                                              />
                                            </div>
                                            <p className={`mt-1 text-right text-[10px] font-semibold tabular-nums ${visual.text}`}>{num(progressPct, 0)}%</p>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </Card>

          <Card className="border-surface-200">
            <p className="text-xs text-surface-600">Período monitorado: {MONTHS[month]}/{year}. O ciclo considera somente dias úteis no intervalo configurado (início da 1ª semana até o fim do fechamento, quando informado) e semanas fixas por janela de segunda a sexta. Após o último dia útil, entra em standby aguardando a definição do próximo ciclo.</p>
          </Card>
        </>
      )}

      {/* ── Confirm modal ──────────────────────────────────────── */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
              className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                confirmModal.onConfirm()
                setConfirmModal((prev) => ({ ...prev, open: false }))
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                confirmModal.variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {confirmModal.confirmLabel}
            </button>
          </div>
        }
      >
        <div className="px-6 py-4">
          <p className="text-sm text-surface-700 leading-relaxed">{confirmModal.message}</p>
        </div>
      </Modal>

      {/* ── Add seller group modal ──────────────────────────────── */}
      <Modal
        open={addGroupModal.open}
        onClose={() => setAddGroupModal({ open: false, search: '', selectedSellerId: '' })}
        title="Adicionar grupo de parâmetros"
        description="Selecione um vendedor para criar um novo grupo de regras e meta financeira individual."
        size="sm"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setAddGroupModal({ open: false, search: '', selectedSellerId: '' })}
              className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!addGroupModal.selectedSellerId}
              onClick={() => {
                const seller = sellers.find((s) => s.id === addGroupModal.selectedSellerId)
                if (!seller) return
                const newId = `block-${Date.now()}`
                const source = ruleBlocks.find((b) => b.id === selectedBlockId) ?? ruleBlocks[0]
                const cloned: RuleBlock = {
                  ...source,
                  id: newId,
                  title: seller.name.split(' ').slice(0, 2).join(' '),
                  sellerIds: [seller.id],
                  rules: source.rules.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
                }
                setRuleBlocks((prev) => [...prev, cloned])
                setSelectedBlockId(newId)
                setAddGroupModal({ open: false, search: '', selectedSellerId: '' })
              }}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Criar grupo
            </button>
          </div>
        }
      >
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
            <Search size={14} className="text-surface-400 shrink-0" />
            <input
              autoFocus
              placeholder="Buscar vendedor..."
              className="flex-1 bg-transparent text-sm text-surface-800 placeholder-surface-400 outline-none"
              value={addGroupModal.search}
              onChange={(e) => setAddGroupModal((prev) => ({ ...prev, search: e.target.value }))}
            />
            {addGroupModal.search && (
              <button type="button" onClick={() => setAddGroupModal((prev) => ({ ...prev, search: '' }))} className="text-surface-400 hover:text-surface-600">
                <X size={12} />
              </button>
            )}
          </div>
          {sellers.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              Nenhum vendedor carregado. Os dados são carregados automaticamente ao acessar o painel de metas com um período selecionado.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto rounded-xl border border-surface-200 divide-y divide-surface-100">
              {sellers
                .filter((s) => !addGroupModal.search || s.name.toLowerCase().includes(addGroupModal.search.toLowerCase()))
                .map((s) => {
                  const initials = s.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                  const alreadyInBlock = ruleBlocks.some((b) => b.sellerIds.includes(s.id))
                  const isSelected = addGroupModal.selectedSellerId === s.id
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={alreadyInBlock}
                        onClick={() => setAddGroupModal((prev) => ({ ...prev, selectedSellerId: s.id }))}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-50'
                            : alreadyInBlock
                            ? 'cursor-not-allowed opacity-40 bg-surface-50'
                            : 'hover:bg-surface-50'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${isSelected ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-600'}`}>
                          {initials}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`truncate text-xs font-semibold ${isSelected ? 'text-primary-700' : 'text-surface-800'}`}>{s.name}</div>
                          {alreadyInBlock && <div className="text-[10px] text-surface-400">Já possui grupo definido</div>}
                        </div>
                        {isSelected && <span className="text-primary-500 font-bold text-sm">✓</span>}
                      </button>
                    </li>
                  )
                })}
              {sellers.filter((s) => !addGroupModal.search || s.name.toLowerCase().includes(addGroupModal.search.toLowerCase())).length === 0 && (
                <li className="px-4 py-5 text-center text-xs text-surface-400">Nenhum vendedor encontrado para essa busca</li>
              )}
            </ul>
          )}
          {sellers.length > 0 && (
            <p className="text-[10px] text-surface-400">
              {sellers.filter((s) => !ruleBlocks.some((b) => b.sellerIds.includes(s.id))).length} de {sellers.length} vendedores sem grupo definido
            </p>
          )}
        </div>
      </Modal>

      {/* ── Company scope modal ─────────────────────────────────── */}
      {showCompanyModal && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCompanyModal(false) }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                  <Building2 size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-surface-900">Escopo de empresas</h2>
                  <p className="text-xs text-surface-500">Selecione a base de dados a considerar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {/* Options */}
            <div className="space-y-2 p-6">
              {([
                {
                  value: '1' as CompanyScopeFilter,
                  label: 'Empresa 1 — Ouro Verde',
                  desc: 'Moagem Ouro Verde (CODEMP = 1). Dados da matriz.',
                  color: 'emerald',
                },
                {
                  value: '2' as CompanyScopeFilter,
                  label: 'Empresa 2 — Maceió',
                  desc: 'Moagem Ouro Verde Maceió (CODEMP = 2). Dados da filial.',
                  color: 'blue',
                },
                {
                  value: 'all' as CompanyScopeFilter,
                  label: 'Empresas selecionadas: 1 e 2',
                  desc: 'Consolidado de todas as filiais. Totais podem divergir de relatórios individuais.',
                  color: 'violet',
                },
              ]).map(({ value, label, desc, color }) => {
                const active = companyScopeFilter === value
                const colorMap: Record<string, string> = {
                  emerald: active ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200' : 'border-surface-200 hover:border-emerald-200 hover:bg-emerald-50/40',
                  blue: active ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-surface-200 hover:border-blue-200 hover:bg-blue-50/40',
                  violet: active ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-200' : 'border-surface-200 hover:border-violet-200 hover:bg-violet-50/40',
                }
                const dotMap: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', violet: 'bg-violet-500' }
                const textMap: Record<string, string> = {
                  emerald: active ? 'text-emerald-800' : 'text-surface-800',
                  blue: active ? 'text-blue-800' : 'text-surface-800',
                  violet: active ? 'text-violet-800' : 'text-surface-800',
                }
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setCompanyScopeFilter(value); setShowCompanyModal(false) }}
                    className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary-400/50 ${colorMap[color]}`}
                  >
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotMap[color]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${textMap[color]}`}>{label}</span>
                        {active && (
                          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-surface-600 ring-1 ring-surface-200">Ativo</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-surface-500">{desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
