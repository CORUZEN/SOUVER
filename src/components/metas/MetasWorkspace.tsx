'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleDollarSign,
  Plus,
  Pencil,
  RefreshCw,
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
import { fetchAuthMeCached } from '@/lib/client/auth-me-cache'

type StageKey = 'W1' | 'W2' | 'W3' | 'CLOSING' | 'FULL'
type OperationalStageKey = Exclude<StageKey, 'FULL'>
type RuleFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
type PrizeType = 'CASH' | 'BENEFIT'
type CashCalcMode = 'PERCENT' | 'FIXED'
type KpiType = 'BASE_CLIENTES' | 'VOLUME' | 'META_FINANCEIRA' | 'DISTRIBUICAO' | 'DEVOLUCAO' | 'INADIMPLENCIA' | 'ITEM_FOCO' | 'RENTABILIDADE' | 'CUSTOM'
type FocusTargetMode = 'KG' | 'BASE_CLIENTS'
type SellerProfileType = 'NOVATO' | 'ANTIGO_1' | 'ANTIGO_15' | 'SUPERVISOR'
type SellerPerformanceScope = 'ALL' | SellerProfileType
type RewardMode = 'CURRENCY' | 'PERCENT'
type WeightPanelView = 'GENERAL' | 'SELLER' | 'SUPERVISOR'

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
  targetKg: number    // legacy fallback (used when Sankhya not connected)
  manualKgByPeriod?: Record<string, number> // manual values keyed by 'YYYY-MM' — used when Sankhya connected but no data for period
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
  weekPeriods: Record<OperationalStageKey, { start: string; end: string }>
  customOffDates: string[]
  sellerIncludedDates: Array<{
    sellerId: string
    sellerName: string
    date: string
  }>
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
  supervisorCode?: string | null
  supervisorName?: string | null
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
  profileType: SellerProfileType
  supervisorCode?: string | null
  supervisorName?: string | null
}

interface ProductAllowlistEntry {
  code: string
  description: string
  brand: string
  unit: string
  mobility: 'SIM' | 'NAO'
  active: boolean
}

type ProductSortKey = 'code' | 'description' | 'brand' | 'unit' | 'mobility' | 'active'
type SortDirection = 'asc' | 'desc'

interface SellerDistributionRow {
  sellerCode: string
  clientCode: string
  productsW1: number
  productsW2: number
  productsW3: number
  productsClosing: number
  productsMonth: number
}

interface SellerDistributionItemsRow {
  sellerCode: string
  itemsW1: number
  itemsW2: number
  itemsW3: number
  itemsClosing: number
  itemsMonth: number
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

interface DistributionDiagnostics {
  queryModeUsed?: string
  attempts?: Array<{ mode: string; rows: number; sellerItemsRows?: number; error?: string }>
  totalRows?: number
  uniqueSellers?: number
  uniqueClients?: number
  sellerCodesRequested?: number
  productCodesRequested?: number
  companyScope?: string
}

interface MetasUiPermissionSection {
  view: boolean
  edit: boolean
  save: boolean
  remove: boolean
}

interface MetasUiPermissions {
  config: MetasUiPermissionSection
  sellers: MetasUiPermissionSection
  products: MetasUiPermissionSection
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
  rewardMode: RewardMode
  status: 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'
  gapToTarget: number
  ruleProgress: RuleProgress[]
  blockId: string
}

interface RuleBlock {
  id: string
  title: string
  sellerProfileType?: SellerProfileType
  monthlyTarget: number  // legacy — kept for backward compat when Sankhya not connected
  manualFinancialByPeriod?: Record<string, number> // manual values keyed by 'YYYY-MM'
  sellerIds: string[]
  rules: GoalRule[]
  weightTargets: WeightTarget[]
  focusProductCode?: string
  focusTargetKg?: number
  focusTargetMode?: FocusTargetMode
  focusTargetBasePct?: number
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

const OPERATIONAL_STAGE_KEYS: OperationalStageKey[] = ['W1', 'W2', 'W3', 'CLOSING']

const KPI_CATALOG: Array<{ type: KpiType; label: string; defaultDescription: string }> = [
  { type: 'BASE_CLIENTES', label: 'Base de clientes', defaultDescription: 'Cobertura da base de clientes no período.' },
  { type: 'VOLUME', label: 'Volume', defaultDescription: 'Quantidade mínima de grupos de produto com meta de peso (kg) atingida no período.' },
  { type: 'META_FINANCEIRA', label: 'Meta financeira', defaultDescription: 'Atingir a meta financeira no fechamento do período.' },
  { type: 'DISTRIBUICAO', label: 'Distribuição de itens', defaultDescription: 'Positivação de itens na base de clientes.' },
  { type: 'DEVOLUCAO', label: 'Devolução', defaultDescription: 'Racional sobre os valores devolvidos x valores faturados.' },
  { type: 'INADIMPLENCIA', label: 'Inadimplência acumulativa', defaultDescription: 'Racional sobre o percentual x valores faturados.' },
  { type: 'ITEM_FOCO', label: 'Item foco do mês', defaultDescription: 'Entrega do item foco conforme o critério definido no bloco (kg ou base de clientes).' },
  { type: 'RENTABILIDADE', label: 'Rentabilidade', defaultDescription: 'Margem de contribuição dentro do percentual parametrizado.' },
  { type: 'CUSTOM', label: 'Personalizado', defaultDescription: '' },
]

const SELLER_PROFILE_OPTIONS: Array<{ value: SellerProfileType; label: string; description: string }> = [
  { value: 'NOVATO', label: 'Vendedor novato', description: 'Perfil inicial para vendedores em rampa.' },
  { value: 'ANTIGO_1', label: 'Vendedor antigo (1%)', description: 'Perfil antigo com política de 1%.' },
  { value: 'ANTIGO_15', label: 'Vendedor antigo (1,5%)', description: 'Perfil antigo com política de 1,5%.' },
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'Perfil de liderança comercial.' },
]

const SELLER_PROFILE_LABEL: Record<SellerProfileType, string> = {
  NOVATO: 'Novato',
  ANTIGO_1: 'Antigo (1%)',
  ANTIGO_15: 'Antigo (1,5%)',
  SUPERVISOR: 'Supervisor',
}

const SELLER_PERFORMANCE_SCOPE_OPTIONS: Array<{ value: SellerPerformanceScope; label: string }> = [
  { value: 'ALL', label: 'Visão geral' },
  { value: 'NOVATO', label: 'Novato' },
  { value: 'ANTIGO_1', label: 'Antigo (1%)' },
  { value: 'ANTIGO_15', label: 'Antigo (1,5%)' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
]

function isPercentRewardProfile(profileType: SellerProfileType) {
  return profileType === 'ANTIGO_1' || profileType === 'ANTIGO_15'
}

function getPercentRewardCap(profileType: SellerProfileType) {
  if (profileType === 'ANTIGO_1') return 1
  if (profileType === 'ANTIGO_15') return 1.5
  return 0
}

function getRewardModeFromProfile(profileType: SellerProfileType): RewardMode {
  return isPercentRewardProfile(profileType) ? 'PERCENT' : 'CURRENCY'
}

function normalizeSellerProfileType(value: unknown): SellerProfileType {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'ANTIGO_1') return 'ANTIGO_1'
  if (normalized === 'ANTIGO_15') return 'ANTIGO_15'
  if (normalized === 'SUPERVISOR') return 'SUPERVISOR'
  return 'NOVATO'
}

function cloneRulesWithFreshIds(rules: GoalRule[], keyPrefix: string) {
  const stamp = Date.now()
  return rules.map((rule, index) => ({
    ...rule,
    id: `${keyPrefix}-${stamp}-${index}`,
  }))
}

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
  const normalizedName = fullName.replace(/\s*\(\d+\)\s*$/, '').trim()
  const PREPS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  const parts = normalizedName.split(/\s+/)
  const toTitle = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  const meaningful = parts.filter((word) => !PREPS.has(word.toLowerCase()))
  return meaningful.slice(0, 2).map(toTitle).join(' ')
}

function stripLegacySellerCounterSuffix(value: string) {
  return value.replace(/\s*\(\d+\)\s*$/, '').trim()
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
  { id: 'closing-foco', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'ITEM_FOCO', kpi: 'Item foco do mês', description: 'Entrega do item foco conforme o critério definido no bloco (kg ou base de clientes).', targetText: '100|40', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-fin', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento do mês (faturado) — bônus de superação.', targetText: '120%', rewardValue: 96.75, points: 0 },
  { id: 'closing-rentab', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'RENTABILIDADE', kpi: 'Rentabilidade', description: 'Apresentar margem de contribuição dentro do percentual parametrizado.', targetText: '33%', rewardValue: 967.46, points: 0.2 },
]

const DEFAULT_RULE_BLOCKS: RuleBlock[] = [
  {
    id: 'default',
    title: 'Bloco padrão',
    sellerProfileType: 'NOVATO',
    monthlyTarget: 0,
    sellerIds: [],
    rules: DEFAULT_RULES,
    weightTargets: [],
    focusProductCode: '',
    focusTargetKg: 0,
    focusTargetMode: 'KG',
    focusTargetBasePct: 0,
  },
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

function formatRewardValue(value: number, mode: RewardMode) {
  if (mode === 'PERCENT') return `${num(value, 2)}%`
  return currency(value)
}

function num(value: number, max = 2) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(value)
}

function parseDecimal(input: string, fallback = 0) {
  const parsed = Number(input.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeEntityCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d+$/.test(trimmed)) {
    const normalized = String(Number(trimmed))
    return normalized === 'NaN' ? trimmed : normalized
  }
  return trimmed
}

function toSellerCodeFromId(sellerId: string) {
  return normalizeEntityCode(sellerId.replace(/^sankhya-/, ''))
}

function normalizeSellerNameForLookup(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseMonthKeyToYearMonth(key: string) {
  const match = key.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const parsedYear = Number(match[1])
  const parsedMonthIndex = Number(match[2]) - 1
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonthIndex) || parsedMonthIndex < 0 || parsedMonthIndex > 11) {
    return null
  }
  return { year: parsedYear, month: parsedMonthIndex }
}

function findClosestMonthConfigKey(keys: string[], targetKey: string) {
  if (keys.length === 0) return undefined
  const sorted = [...keys].sort()
  const previous = [...sorted].reverse().find((key) => key < targetKey)
  if (previous) return previous
  const next = sorted.find((key) => key > targetKey)
  return next
}

function clampIsoToMonth(raw: string, year: number, month: number): string {
  const parsed = parseIsoDate(raw)
  if (!parsed) return ''
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  if (parsed < monthStart || parsed > monthEnd) return ''
  return toIsoDate(parsed)
}

function buildDefaultWeekPeriods(week1StartDateRaw: string, closingWeekEndDateRaw: string, year: number, month: number) {
  const weekPeriods: Record<OperationalStageKey, { start: string; end: string }> = {
    W1: { start: '', end: '' },
    W2: { start: '', end: '' },
    W3: { start: '', end: '' },
    CLOSING: { start: '', end: '' },
  }

  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const configuredStart = parseIsoDate(week1StartDateRaw)
  if (!configuredStart) return weekPeriods

  const baseStart = configuredStart < monthStart ? monthStart : configuredStart
  const configuredEnd = resolveClosingEndDate(closingWeekEndDateRaw, year, month)
  const cycleEndBase = configuredEnd ? parseIsoDate(configuredEnd) ?? monthEnd : monthEnd
  const cycleEnd = cycleEndBase < baseStart ? baseStart : cycleEndBase

  OPERATIONAL_STAGE_KEYS.forEach((stageKey, index) => {
    const stageStartDate = addDays(baseStart, index * 7)
    if (stageStartDate > cycleEnd) return
    const rawStageEnd = stageKey === 'CLOSING' ? cycleEnd : addDays(stageStartDate, 4)
    const stageEndDate = rawStageEnd > cycleEnd ? cycleEnd : rawStageEnd
    weekPeriods[stageKey] = {
      start: toIsoDate(stageStartDate),
      end: toIsoDate(stageEndDate),
    }
  })

  return weekPeriods
}

function normalizeMonthConfig(
  input: Partial<MonthConfig> | undefined,
  year: number,
  month: number
): MonthConfig {
  const customOffDates = Array.isArray(input?.customOffDates)
    ? Array.from(new Set(input.customOffDates.filter((date): date is string => typeof date === 'string' && Boolean(parseIsoDate(date))))).sort()
    : []
  const sellerIncludedDatesRaw = Array.isArray(input?.sellerIncludedDates) ? input.sellerIncludedDates : []
  const sellerIncludedDatesMap = new Map<string, { sellerId: string; sellerName: string; date: string }>()
  for (const entry of sellerIncludedDatesRaw) {
    const sellerId = typeof entry?.sellerId === 'string' ? entry.sellerId : ''
    const date = typeof entry?.date === 'string' ? entry.date : ''
    if (!sellerId || !date || !parseIsoDate(date)) continue
    const sellerName = typeof entry.sellerName === 'string' ? entry.sellerName : ''
    sellerIncludedDatesMap.set(`${sellerId}::${date}`, { sellerId, sellerName, date })
  }
  const sellerIncludedDates = Array.from(sellerIncludedDatesMap.values())
    .sort((a, b) => (a.date === b.date ? a.sellerName.localeCompare(b.sellerName, 'pt-BR') : a.date.localeCompare(b.date)))

  const week1StartDateRaw = typeof input?.week1StartDate === 'string' ? input.week1StartDate : ''
  const closingWeekEndDateRaw = typeof input?.closingWeekEndDate === 'string' ? input.closingWeekEndDate : ''
  const defaultWeekPeriods = buildDefaultWeekPeriods(week1StartDateRaw, closingWeekEndDateRaw, year, month)
  const inputWeekPeriods = input?.weekPeriods && typeof input.weekPeriods === 'object'
    ? input.weekPeriods
    : {}

  const normalizedWeekPeriods = OPERATIONAL_STAGE_KEYS.reduce<Record<OperationalStageKey, { start: string; end: string }>>((acc, stageKey) => {
    const fallback = defaultWeekPeriods[stageKey]
    const rawPeriod = (inputWeekPeriods as Partial<Record<OperationalStageKey, { start?: string; end?: string }>>)[stageKey]
    const explicitStart = clampIsoToMonth(String(rawPeriod?.start ?? ''), year, month)
    const explicitEnd = clampIsoToMonth(String(rawPeriod?.end ?? ''), year, month)
    const fallbackStart = clampIsoToMonth(String(fallback.start ?? ''), year, month)
    const fallbackEnd = clampIsoToMonth(String(fallback.end ?? ''), year, month)
    const start = explicitStart || fallbackStart
    const end = explicitEnd || fallbackEnd
    if (!start || !end || start > end) {
      acc[stageKey] = { start: '', end: '' }
    } else {
      acc[stageKey] = { start, end }
    }
    return acc
  }, {
    W1: { start: '', end: '' },
    W2: { start: '', end: '' },
    W3: { start: '', end: '' },
    CLOSING: { start: '', end: '' },
  })

  const derivedWeek1StartDate = normalizedWeekPeriods.W1.start
  const derivedClosingWeekEndDate = normalizedWeekPeriods.CLOSING.end

  return {
    week1StartDate: derivedWeek1StartDate || clampIsoToMonth(week1StartDateRaw, year, month),
    closingWeekEndDate: derivedClosingWeekEndDate || clampIsoToMonth(closingWeekEndDateRaw, year, month),
    weekPeriods: normalizedWeekPeriods,
    customOffDates,
    sellerIncludedDates,
  }
}

function stableSerialize(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize)
    if (input && typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, normalize(val)])
      return Object.fromEntries(entries)
    }
    return input
  }
  return JSON.stringify(normalize(value))
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

function parseDistribuicaoTarget(targetText: string, totalActiveProducts: number) {
  const parts = targetText.split('|').map((s) => s.trim())
  const itemsPart = parts[0] ?? '0'
  const itemsIsPercent = itemsPart.includes('%')
  const itemsNum = Math.max(parseDecimal(itemsPart.replace('%', ''), 0), 0)
  const resolvedItems = itemsIsPercent && totalActiveProducts > 0
    ? Math.ceil((totalActiveProducts * itemsNum) / 100)
    : Math.max(Math.floor(itemsNum), 0)
  const clientsPct = Math.max(parseDecimal((parts[1] ?? '0').replace('%', ''), 0), 0)
  return { resolvedItems, clientsPct, itemsNum, itemsIsPercent }
}

function getDistribuicaoProductsByStage(row: SellerDistributionRow, stage: StageKey) {
  if (stage === 'W1') return row.productsW1
  if (stage === 'W2') return row.productsW2
  if (stage === 'W3') return row.productsW3
  if (stage === 'CLOSING') return row.productsClosing
  return row.productsMonth
}

function getDistribuicaoItemsByStage(row: SellerDistributionItemsRow | undefined, stage: StageKey) {
  if (!row) return 0
  if (stage === 'W1') return row.itemsW1
  if (stage === 'W2') return row.itemsW2
  if (stage === 'W3') return row.itemsW3
  if (stage === 'CLOSING') return row.itemsClosing
  return row.itemsMonth
}

function formatItemFocoTarget(volumePct: number, basePct: number) {
  const v = Math.max(volumePct, 0)
  const b = Math.max(basePct, 0)
  return `${v}|${b}`
}

function resolveFocusTargetMode(block: RuleBlock): FocusTargetMode {
  return block.focusTargetMode === 'BASE_CLIENTS' ? 'BASE_CLIENTS' : 'KG'
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
  const withBusinessDay = weeks.find((week) => week.key !== 'FULL' && week.businessDays.includes(isoDate))
  return withBusinessDay?.key ?? null
}

function findStageForIncludedDate(isoDate: string, weeks: CycleWeek[]): StageKey | null {
  const operationalWeeks = weeks
    .filter((week): week is CycleWeek & { start: string; end: string } => week.key !== 'FULL' && Boolean(week.start && week.end))
    .sort((a, b) => a.start.localeCompare(b.start))

  if (operationalWeeks.length === 0) return null
  const direct = operationalWeeks.find((week) => isDateWithinRange(isoDate, week.start, week.end))
  if (direct) return direct.key

  const previous = [...operationalWeeks].reverse().find((week) => week.end < isoDate)
  if (previous) return previous.key

  const next = operationalWeeks.find((week) => week.start > isoDate)
  return next?.key ?? null
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

function buildCycle(
  startIso: string,
  closingEndIso: string,
  year: number,
  month: number,
  blocked: Set<string>,
  weekPeriods?: Partial<Record<OperationalStageKey, { start?: string; end?: string }>>
) {
  const monthStartIso = toIsoDate(new Date(year, month, 1))
  const monthEndIso = toIsoDate(new Date(year, month + 1, 0))
  const normalized = normalizeMonthConfig({
    week1StartDate: startIso,
    closingWeekEndDate: closingEndIso,
    weekPeriods: weekPeriods as MonthConfig['weekPeriods'],
    customOffDates: [],
    sellerIncludedDates: [],
  }, year, month)

  const weeks: CycleWeek[] = OPERATIONAL_STAGE_KEYS.map((stageKey) => {
    const stage = STAGES.find((item) => item.key === stageKey)!
    const period = normalized.weekPeriods[stageKey]
    if (!period.start || !period.end) {
      return {
        key: stageKey,
        label: stage.label,
        start: null,
        end: null,
        businessDays: [],
      }
    }

    const business: string[] = []
    let cursor = parseIsoDate(period.start)
    const end = parseIsoDate(period.end)
    if (!cursor || !end) {
      return {
        key: stageKey,
        label: stage.label,
        start: null,
        end: null,
        businessDays: [],
      }
    }

    while (cursor <= end) {
      const weekday = cursor.getDay()
      const iso = toIsoDate(cursor)
      if (weekday >= 1 && weekday <= 5 && !blocked.has(iso)) business.push(iso)
      cursor = addDays(cursor, 1)
    }

    return {
      key: stageKey,
      label: stage.label,
      start: period.start,
      end: period.end,
      businessDays: business,
    }
  })

  const fullBusinessSet = new Set<string>(weeks.flatMap((week) => week.businessDays))
  const fullBusiness = [...fullBusinessSet].sort()
  const firstStart = weeks.map((week) => week.start).filter((value): value is string => Boolean(value)).sort()[0] ?? null
  const lastEnd = [...weeks]
    .map((week) => week.end)
    .filter((value): value is string => Boolean(value))
    .sort()
    .slice(-1)[0] ?? null

  weeks.push({
    key: 'FULL',
    label: 'Todo o período',
    start: firstStart ?? monthStartIso,
    end: lastEnd ?? monthEndIso,
    businessDays: fullBusiness,
  })

  const lastBusinessDate = fullBusiness.length > 0 ? fullBusiness[fullBusiness.length - 1] : null
  const totalBusinessDays = weeks.filter((week) => week.key !== 'FULL').reduce((sum, week) => sum + week.businessDays.length, 0)
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
  const [metasPermissions, setMetasPermissions] = useState<MetasUiPermissions | null>(null)
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
  const [sellerIncludeDate, setSellerIncludeDate] = useState('')
  const [sellerIncludeSellerId, setSellerIncludeSellerId] = useState('')
  const [sellers, setSellers] = useState<Salesperson[]>([])
  const [selectedSellerId, setSelectedSellerId] = useState('')
  const [sellerPerformanceScope, setSellerPerformanceScope] = useState<SellerPerformanceScope>('ALL')
  const [performanceSupervisorKey, setPerformanceSupervisorKey] = useState('')
  const [weightPanelView, setWeightPanelView] = useState<WeightPanelView>('GENERAL')
  const [weightPanelSellerId, setWeightPanelSellerId] = useState('')
  const [weightPanelSupervisorKey, setWeightPanelSupervisorKey] = useState('')
  const [weightRankingListMaxHeight, setWeightRankingListMaxHeight] = useState<number | null>(null)
  const [sellersLoading, setSellersLoading] = useState(true)
  const [sellersError, setSellersError] = useState('')
  const [performanceDiagnostics, setPerformanceDiagnostics] = useState<PerformanceDiagnostics | null>(null)
  const [allowlist, setAllowlist] = useState<SellerAllowlistEntry[]>([])
  const [allowlistLoading, setAllowlistLoading] = useState(false)
  const [allowlistSaving, setAllowlistSaving] = useState(false)
  const [allowlistSyncing, setAllowlistSyncing] = useState(false)
  const [allowlistError, setAllowlistError] = useState('')
  const [allowlistSuccess, setAllowlistSuccess] = useState('')
  const [allowlistShowOnlyInactive, setAllowlistShowOnlyInactive] = useState(false)
  const [productAllowlist, setProductAllowlist] = useState<ProductAllowlistEntry[]>([])
  const [productAllowlistLoading, setProductAllowlistLoading] = useState(false)
  const [productAllowlistSaving, setProductAllowlistSaving] = useState(false)
  const [productAllowlistSyncing, setProductAllowlistSyncing] = useState(false)
  const [productAllowlistError, setProductAllowlistError] = useState('')
  const [productAllowlistSuccess, setProductAllowlistSuccess] = useState('')
  const [productCodeFilter, setProductCodeFilter] = useState('')
  const [productDescriptionFilter, setProductDescriptionFilter] = useState('')
  const [productBrandFilter, setProductBrandFilter] = useState('')
  const [productShowOnlyInactive, setProductShowOnlyInactive] = useState(false)
  const [productSort, setProductSort] = useState<{ key: ProductSortKey; direction: SortDirection }>({
    key: 'brand',
    direction: 'asc',
  })
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
  const [applyKpiModal, setApplyKpiModal] = useState<{
    open: boolean
    sourceBlockId: string
    selectedSellerIds: string[]
  }>({ open: false, sourceBlockId: '', selectedSellerIds: [] })
  const [sellerPickerBlockId, setSellerPickerBlockId] = useState<string | null>(null)
  const [sellerPickerSearch, setSellerPickerSearch] = useState('')
  const [addGroupModal, setAddGroupModal] = useState<{
    open: boolean
    search: string
    selectedSellerId: string
    profileType: SellerProfileType
  }>({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })
  const [addAllowlistModal, setAddAllowlistModal] = useState<{
    open: boolean
    search: string
    selectedSellerId: string
    profileType: SellerProfileType
  }>({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })
  // Brand weight data fetched from Sankhya (seller × brand → total kg for the selected month)
  const [brandWeightRows, setBrandWeightRows] = useState<Array<{ sellerCode: string; sellerName: string; brand: string; totalKg: number }>>([])
  const [brandWeightBrands, setBrandWeightBrands] = useState<string[]>([])
  const [brandWeightLoading, setBrandWeightLoading] = useState(false)
  const [brandWeightError, setBrandWeightError] = useState('')
  // Sankhya configured targets (meta financeira + metas de peso por marca) — Vidya Force
  const [sankhyaTargets, setSankhyaTargets] = useState<Array<{
    sellerCode: string
    sellerName: string
    financialTarget: number
    weightTargets: Array<{ brand: string; targetKg: number }>
  }>>([])
  const [sankhyaTargetsLoading, setSankhyaTargetsLoading] = useState(false)
  const [sankhyaTargetsError, setSankhyaTargetsError] = useState('')
  const [sankhyaConnected, setSankhyaConnected] = useState(false)
  const [sankhyaNoDataForPeriod, setSankhyaNoDataForPeriod] = useState(false)
  const [sankhyaDiagnostics, setSankhyaDiagnostics] = useState<{
    financialSqlIndex: number; weightSqlIndex: number; financialErrors?: string[]; weightErrors?: string[]
  } | null>(null)
  const [focusProductRows, setFocusProductRows] = useState<Record<string, Array<{ sellerCode: string; sellerName: string; soldKg: number; returnKg: number; soldClients: number }>>>({})
  const [focusProductLoading, setFocusProductLoading] = useState<Record<string, boolean>>({})
  const [focusProductError, setFocusProductError] = useState<Record<string, string>>({})
  const [distributionRows, setDistributionRows] = useState<SellerDistributionRow[]>([])
  const [distributionSellerItemsRows, setDistributionSellerItemsRows] = useState<SellerDistributionItemsRow[]>([])
  const [distributionLoading, setDistributionLoading] = useState(false)
  const [distributionError, setDistributionError] = useState('')
  const [distributionDiagnostics, setDistributionDiagnostics] = useState<DistributionDiagnostics | null>(null)
  const [kpiInspectorOpenKey, setKpiInspectorOpenKey] = useState<string | null>(null)
  const [kpiInspectorSellerId, setKpiInspectorSellerId] = useState('')
  const [kpiInspectorAnchor, setKpiInspectorAnchor] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const [readOnlyBlockPickerOpen, setReadOnlyBlockPickerOpen] = useState(false)
  const [isEditingBlockTitle, setIsEditingBlockTitle] = useState(false)
  const [blockTitleDraft, setBlockTitleDraft] = useState('')
  const periodPickerRef = useRef<HTMLDivElement>(null)
  const readOnlyBlockPickerRef = useRef<HTMLDivElement>(null)
  const weightPanelLeftColumnRef = useRef<HTMLDivElement>(null)
  const weightRankingHeaderRef = useRef<HTMLDivElement>(null)
  const weightRankingListRef = useRef<HTMLDivElement>(null)
  const dashboardFocusProductsPrefetchAttemptedRef = useRef(false)

  const activeKey = monthKey(year, month)
  const activeMonth = monthConfigs[activeKey]
  const prevActiveKeyRef = useRef(activeKey)
  const pendingBeforePeriodChangeRef = useRef(false)
  const shouldRebaselineAfterAutoMonthInitRef = useRef(false)
  const [isConfigLoaded, setIsConfigLoaded] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configSaveError, setConfigSaveError] = useState('')
  const [configSaveSuccess, setConfigSaveSuccess] = useState('')
  const [lastSavedConfigSignature, setLastSavedConfigSignature] = useState<string | null>(null)
  const [isRebaseliningConfig, setIsRebaseliningConfig] = useState(false)
  const input = 'mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500'
  const canViewConfig = metasPermissions?.config.view ?? false
  const canEditConfig = metasPermissions?.config.edit ?? false
  const canSaveConfig = metasPermissions?.config.save ?? false
  const canRemoveConfig = metasPermissions?.config.remove ?? false
  const canMutateConfig = canEditConfig || canSaveConfig || canRemoveConfig

  const canViewSellers = metasPermissions?.sellers.view ?? false
  const canEditSellers = metasPermissions?.sellers.edit ?? false
  const canSaveSellers = metasPermissions?.sellers.save ?? false
  const canRemoveSellers = metasPermissions?.sellers.remove ?? false
  const canMutateSellers = canEditSellers || canSaveSellers || canRemoveSellers

  const canViewProducts = metasPermissions?.products.view ?? false
  const canEditProducts = metasPermissions?.products.edit ?? false
  const canSaveProducts = metasPermissions?.products.save ?? false
  const canRemoveProducts = metasPermissions?.products.remove ?? false
  const canMutateProducts = canEditProducts || canSaveProducts || canRemoveProducts
  const sellerProfileByCode = useMemo(() => {
    const map = new Map<string, SellerProfileType>()
    for (const seller of allowlist) {
      const normalizedCode = normalizeEntityCode(String(seller.code ?? ''))
      if (!normalizedCode) continue
      map.set(normalizedCode, normalizeSellerProfileType(seller.profileType))
    }
    return map
  }, [allowlist])
  const sellerProfileByName = useMemo(() => {
    const map = new Map<string, SellerProfileType>()
    for (const seller of allowlist) {
      const normalizedName = normalizeSellerNameForLookup(String(seller.name ?? ''))
      if (!normalizedName) continue
      map.set(normalizedName, normalizeSellerProfileType(seller.profileType))
    }
    return map
  }, [allowlist])
  const sellerProfileByShortName = useMemo(() => {
    const map = new Map<string, SellerProfileType>()
    for (const seller of allowlist) {
      const shortName = getSellerShortName(String(seller.name ?? ''))
      const normalizedShortName = normalizeSellerNameForLookup(shortName)
      if (!normalizedShortName) continue
      map.set(normalizedShortName, normalizeSellerProfileType(seller.profileType))
    }
    return map
  }, [allowlist])
  const sellerAllowlistByCode = useMemo(() => {
    const map = new Map<string, SellerAllowlistEntry>()
    for (const seller of allowlist) {
      const normalizedCode = normalizeEntityCode(String(seller.code ?? ''))
      if (!normalizedCode) continue
      map.set(normalizedCode, seller)
    }
    return map
  }, [allowlist])
  const sellerAllowlistByName = useMemo(() => {
    const map = new Map<string, SellerAllowlistEntry>()
    for (const seller of allowlist) {
      const normalizedName = normalizeSellerNameForLookup(String(seller.name ?? ''))
      if (!normalizedName) continue
      map.set(normalizedName, seller)
    }
    return map
  }, [allowlist])
  const sellerAllowlistByShortName = useMemo(() => {
    const map = new Map<string, SellerAllowlistEntry>()
    for (const seller of allowlist) {
      const shortName = getSellerShortName(String(seller.name ?? ''))
      const normalizedShortName = normalizeSellerNameForLookup(shortName)
      if (!normalizedShortName) continue
      map.set(normalizedShortName, seller)
    }
    return map
  }, [allowlist])
  const resolveAllowlistSellerEntry = useCallback((sellerCode: string, sellerName: string, sellerShortName: string): SellerAllowlistEntry | null => {
    const byCode = sellerCode ? sellerAllowlistByCode.get(sellerCode) : undefined
    if (byCode) return byCode

    const normalizedName = normalizeSellerNameForLookup(sellerName)
    const byName = sellerAllowlistByName.get(normalizedName)
    if (byName) return byName

    const normalizedShortName = normalizeSellerNameForLookup(sellerShortName)
    const byShortName = sellerAllowlistByShortName.get(normalizedShortName)
    if (byShortName) return byShortName

    const prefixed = Array.from(sellerAllowlistByName.entries()).find(([allowlistName]) => allowlistName.startsWith(normalizedName))
    if (prefixed) return prefixed[1]

    const contained = Array.from(sellerAllowlistByName.entries()).find(([allowlistName]) => normalizedName.includes(allowlistName))
    if (contained) return contained[1]

    return null
  }, [sellerAllowlistByCode, sellerAllowlistByName, sellerAllowlistByShortName])
  const sellerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const seller of sellers) map.set(seller.id, seller.name)
    return map
  }, [sellers])
  const resolveSellerProfileForId = useCallback((sellerId: string): SellerProfileType | null => {
    const sellerCode = toSellerCodeFromId(sellerId)
    const byCode = sellerCode ? sellerProfileByCode.get(sellerCode) : undefined
    if (byCode) return byCode
    const sellerName = sellerNameById.get(sellerId)
    if (!sellerName) return null
    const normalizedName = normalizeSellerNameForLookup(sellerName)
    const byName = sellerProfileByName.get(normalizedName)
    if (byName) return byName
    const byShortName = sellerProfileByShortName.get(normalizeSellerNameForLookup(getSellerShortName(sellerName)))
    if (byShortName) return byShortName
    const prefixName = Array.from(sellerProfileByName.entries()).find(([allowlistName]) => allowlistName.startsWith(normalizedName))
    if (prefixName) return prefixName[1]
    const containedName = Array.from(sellerProfileByName.entries()).find(([allowlistName]) => normalizedName.includes(allowlistName))
    if (containedName) return containedName[1]
    return byName ?? null
  }, [sellerNameById, sellerProfileByCode, sellerProfileByName, sellerProfileByShortName])
  const resolveBlockProfileType = useCallback((candidate: RuleBlock): SellerProfileType => {
    if (candidate.sellerIds.length === 0) return normalizeSellerProfileType(candidate.sellerProfileType)
    const uniqueProfiles = Array.from(
      new Set(
        candidate.sellerIds
          .map((sellerId) => resolveSellerProfileForId(sellerId))
          .filter((profile): profile is SellerProfileType => Boolean(profile))
      )
    )
    if (uniqueProfiles.length === 1) return uniqueProfiles[0]
    const normalizedTitle = normalizeSellerNameForLookup(stripLegacySellerCounterSuffix(candidate.title))
    if (normalizedTitle) {
      const byShortTitle = sellerProfileByShortName.get(normalizedTitle)
      if (byShortTitle) return byShortTitle
      const prefixed = Array.from(sellerProfileByName.entries()).find(([allowlistName]) => allowlistName.startsWith(normalizedTitle))
      if (prefixed) return prefixed[1]
    }
    return normalizeSellerProfileType(candidate.sellerProfileType)
  }, [resolveSellerProfileForId, sellerProfileByName, sellerProfileByShortName])
  const closeAddAllowlistModal = () =>
    setAddAllowlistModal({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })
  const closeApplyKpiModal = () => setApplyKpiModal({ open: false, sourceBlockId: '', selectedSellerIds: [] })
  const kpiApplySourceBlock = useMemo(
    () => ruleBlocks.find((block) => block.id === applyKpiModal.sourceBlockId) ?? null,
    [applyKpiModal.sourceBlockId, ruleBlocks]
  )
  const kpiApplySourceProfile = useMemo(
    () => (kpiApplySourceBlock ? resolveBlockProfileType(kpiApplySourceBlock) : null),
    [kpiApplySourceBlock, resolveBlockProfileType]
  )
  const kpiApplyTargetOptions = useMemo(() => {
    if (!applyKpiModal.sourceBlockId) return [] as Array<{ sellerId: string; sellerName: string; blockId: string; blockTitle: string }>
    if (!kpiApplySourceProfile) return [] as Array<{ sellerId: string; sellerName: string; blockId: string; blockTitle: string }>
    const bySeller = new Map<string, { sellerId: string; sellerName: string; blockId: string; blockTitle: string }>()
    for (const candidate of ruleBlocks) {
      if (candidate.id === applyKpiModal.sourceBlockId || candidate.sellerIds.length === 0) continue
      if (resolveBlockProfileType(candidate) !== kpiApplySourceProfile) continue
      for (const sellerId of candidate.sellerIds) {
        if (bySeller.has(sellerId)) continue
        const sellerName = sellers.find((seller) => seller.id === sellerId)?.name ?? sellerId.replace(/^sankhya-/, '')
        bySeller.set(sellerId, {
          sellerId,
          sellerName,
          blockId: candidate.id,
          blockTitle: candidate.title,
        })
      }
    }
    return Array.from(bySeller.values()).sort((a, b) => a.sellerName.localeCompare(b.sellerName))
  }, [applyKpiModal.sourceBlockId, kpiApplySourceProfile, resolveBlockProfileType, ruleBlocks, sellers])
  const selectedKpiApplySellerIds = useMemo(
    () => new Set(applyKpiModal.selectedSellerIds),
    [applyKpiModal.selectedSellerIds]
  )
  const allKpiApplyTargetsSelected =
    kpiApplyTargetOptions.length > 0 && kpiApplyTargetOptions.every((option) => selectedKpiApplySellerIds.has(option.sellerId))

  useEffect(() => {
    if (!applyKpiModal.open) return
    setApplyKpiModal((prev) => {
      const validIds = new Set(kpiApplyTargetOptions.map((option) => option.sellerId))
      const filteredSelection = prev.selectedSellerIds.filter((sellerId) => validIds.has(sellerId))
      if (
        filteredSelection.length === prev.selectedSellerIds.length &&
        filteredSelection.every((sellerId, index) => sellerId === prev.selectedSellerIds[index])
      ) {
        return prev
      }
      return { ...prev, selectedSellerIds: filteredSelection }
    })
  }, [applyKpiModal.open, kpiApplyTargetOptions])

  const applyKpiRulesToSelectedSellers = () => {
    const validTargetIds = new Set(kpiApplyTargetOptions.map((option) => option.sellerId))
    const selectedIds = new Set(applyKpiModal.selectedSellerIds.filter((sellerId) => validTargetIds.has(sellerId)))
    if (selectedIds.size === 0) return
    setRuleBlocks((prev) => {
      const sourceBlock = prev.find((block) => block.id === applyKpiModal.sourceBlockId)
      if (!sourceBlock) return prev
      const targetBlockIds = new Set(
        prev
          .filter((candidate) => candidate.id !== sourceBlock.id && candidate.sellerIds.some((sellerId) => selectedIds.has(sellerId)))
          .map((candidate) => candidate.id)
      )
      if (targetBlockIds.size === 0) return prev
      const stamp = Date.now()
      return prev.map((candidate) => {
        if (!targetBlockIds.has(candidate.id)) return candidate
        const clonedRules = sourceBlock.rules.map((rule, index) => ({
          ...rule,
          id: `rule-${stamp}-${candidate.id}-${index}`,
        }))
        return { ...candidate, rules: clonedRules }
      })
    })
    closeApplyKpiModal()
  }

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
    function handleClickOutside(e: MouseEvent) {
      if (readOnlyBlockPickerRef.current && !readOnlyBlockPickerRef.current.contains(e.target as Node)) {
        setReadOnlyBlockPickerOpen(false)
      }
    }
    if (readOnlyBlockPickerOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [readOnlyBlockPickerOpen])

  useEffect(() => {
    fetchAuthMeCached()
      .then((data) => {
        const perms = data?.user?.metasPermissions as MetasUiPermissions | undefined
        if (!perms) {
          setMetasPermissions({
            config: { view: false, edit: false, save: false, remove: false },
            sellers: { view: false, edit: false, save: false, remove: false },
            products: { view: false, edit: false, save: false, remove: false },
          })
          return
        }
        setMetasPermissions({
          config: {
            view: Boolean(perms.config?.view),
            edit: Boolean(perms.config?.edit),
            save: Boolean(perms.config?.save),
            remove: Boolean(perms.config?.remove),
          },
          sellers: {
            view: Boolean(perms.sellers?.view),
            edit: Boolean(perms.sellers?.edit),
            save: Boolean(perms.sellers?.save),
            remove: Boolean(perms.sellers?.remove),
          },
          products: {
            view: Boolean(perms.products?.view),
            edit: Boolean(perms.products?.edit),
            save: Boolean(perms.products?.save),
            remove: Boolean(perms.products?.remove),
          },
        })
      })
      .catch(() => {
        setMetasPermissions({
          config: { view: false, edit: false, save: false, remove: false },
          sellers: { view: false, edit: false, save: false, remove: false },
          products: { view: false, edit: false, save: false, remove: false },
        })
      })
  }, [])

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
    setIsEditingBlockTitle(false)
    setBlockTitleDraft('')
  }, [selectedBlockId])

  useEffect(() => {
    // ── Load config from API (database) ──────────────────────────────────
    const migrateBlocks = (raw: unknown): RuleBlock[] => {
      if (Array.isArray(raw)) return (raw as RuleBlock[]).map((b) => ({
        ...b,
        title: (b.sellerIds?.length ?? 0) > 0 ? stripLegacySellerCounterSuffix(String(b.title ?? '')) : String(b.title ?? ''),
        sellerProfileType: normalizeSellerProfileType(b.sellerProfileType),
        monthlyTarget: b.monthlyTarget ?? 0,
        sellerIds: b.sellerIds ?? [],
        weightTargets: b.weightTargets ?? [],
        focusProductCode: b.focusProductCode ?? '',
        focusTargetKg: b.focusTargetKg ?? 0,
        focusTargetMode: b.focusTargetMode === 'BASE_CLIENTS' ? 'BASE_CLIENTS' : 'KG',
        focusTargetBasePct: Math.max(Number(b.focusTargetBasePct ?? 0) || 0, 0),
        rules: (b.rules ?? []).map((r: GoalRule) => ({ ...r, kpiType: r.kpiType ?? inferKpiType(r.kpi) })),
      }))
      return DEFAULT_RULE_BLOCKS
    }

    fetch('/api/metas/config?scope=1')
      .then((r) => r.json())
      .then((data: { metaConfigs?: unknown; monthConfigs?: unknown }) => {
        if (data.monthConfigs && typeof data.monthConfigs === 'object' && !Array.isArray(data.monthConfigs)) {
          const rawMonthConfigs = data.monthConfigs as Record<string, Partial<MonthConfig>>
          const normalizedMonthConfigs = Object.fromEntries(
            Object.entries(rawMonthConfigs).map(([key, value]) => {
              const parsed = parseMonthKeyToYearMonth(key)
              const normalized = normalizeMonthConfig(
                value,
                parsed?.year ?? year,
                parsed?.month ?? month
              )
              return [key, normalized]
            })
          )
          setMonthConfigs(normalizedMonthConfigs)
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
            // Inherit from the closest configured month (prefer previous, fallback to next)
            const source = findClosestMonthConfigKey(Object.keys(normalized), monthKey(year, month))
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

  const mergedMetaConfigs = useMemo<Record<string, MetaConfig>>(
    () => ({
      ...metaConfigs,
      [activeKey]: { ruleBlocks, prizes, includeNational, salaryBase, basePremiation, extraBonus, extraMinPoints },
    }),
    [activeKey, basePremiation, extraBonus, extraMinPoints, includeNational, metaConfigs, prizes, ruleBlocks, salaryBase]
  )

  const currentConfigPayload = useMemo(
    () => ({ scope: '1', metaConfigs: mergedMetaConfigs, monthConfigs }),
    [mergedMetaConfigs, monthConfigs]
  )

  const currentConfigSignature = useMemo(() => stableSerialize(currentConfigPayload), [currentConfigPayload])
  const hasPendingConfigChanges =
    isConfigLoaded &&
    !isRebaseliningConfig &&
    lastSavedConfigSignature !== null &&
    currentConfigSignature !== lastSavedConfigSignature

  function handleMonthChange(nextMonth: number) {
    pendingBeforePeriodChangeRef.current = hasPendingConfigChanges
    setMonth(nextMonth)
  }

  function handleYearChange(nextYear: number) {
    pendingBeforePeriodChangeRef.current = hasPendingConfigChanges
    setYear(nextYear)
  }

  function handlePeriodChange(nextYear: number, nextMonth: number) {
    pendingBeforePeriodChangeRef.current = hasPendingConfigChanges
    setYear(nextYear)
    setMonth(nextMonth)
  }

  function updateActiveMonthConfig(
    patch:
      | Partial<MonthConfig>
      | ((current: MonthConfig) => Partial<MonthConfig>)
  ) {
    setMonthConfigs((prev) => {
      const current = normalizeMonthConfig(prev[activeKey], year, month)
      const nextPatch = typeof patch === 'function' ? patch(current) : patch
      return {
        ...prev,
        [activeKey]: normalizeMonthConfig({ ...current, ...nextPatch }, year, month),
      }
    })
  }

  function updateStagePeriod(stage: OperationalStageKey, field: 'start' | 'end', value: string) {
    updateActiveMonthConfig((current) => ({
      weekPeriods: {
        ...current.weekPeriods,
        [stage]: {
          ...current.weekPeriods[stage],
          [field]: value,
        },
      },
    }))
  }

  useEffect(() => {
    if (activeMonth) return
    setMonthConfigs((prev) => ({
      ...prev,
      [activeKey]: normalizeMonthConfig({
        week1StartDate: firstMonday(year, month),
        closingWeekEndDate: '',
        customOffDates: [],
        sellerIncludedDates: [],
      }, year, month),
    }))
    if (shouldRebaselineAfterAutoMonthInitRef.current) {
      setIsRebaseliningConfig(true)
      shouldRebaselineAfterAutoMonthInitRef.current = false
    }
  }, [activeKey, activeMonth, month, year])

  // ── Month-switch: save old month config, load new month (or inherit from previous) ──
  useEffect(() => {
    if (prevActiveKeyRef.current === activeKey) return
    const shouldRebaselineAfterSwitch = !pendingBeforePeriodChangeRef.current
    pendingBeforePeriodChangeRef.current = false
    shouldRebaselineAfterAutoMonthInitRef.current = shouldRebaselineAfterSwitch
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
        // Inherit from the closest configured month (prefer previous, fallback to next)
        const source = findClosestMonthConfigKey(Object.keys(updated), activeKey)
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

    if (shouldRebaselineAfterSwitch) {
      setIsRebaseliningConfig(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => {
    if (!isConfigLoaded) return
    if (lastSavedConfigSignature !== null) return
    if (isRebaseliningConfig) return
    setLastSavedConfigSignature(currentConfigSignature)
  }, [currentConfigSignature, isConfigLoaded, isRebaseliningConfig, lastSavedConfigSignature])

  useEffect(() => {
    if (!isRebaseliningConfig) return
    const timer = setTimeout(() => {
      setConfigSaveError('')
      setConfigSaveSuccess('')
      setLastSavedConfigSignature(currentConfigSignature)
      setIsRebaseliningConfig(false)
    }, 180)
    return () => clearTimeout(timer)
  }, [currentConfigSignature, isRebaseliningConfig])

  useEffect(() => {
    if (!hasPendingConfigChanges) return
    if (configSaveSuccess) setConfigSaveSuccess('')
  }, [configSaveSuccess, hasPendingConfigChanges])

  async function handleSaveConfigEdits() {
    if (!canSaveConfig) {
      setConfigSaveError('Seu cargo não possui permissão para salvar configurações do painel de metas.')
      return
    }
    if (isSavingConfig || !hasPendingConfigChanges) return
    setIsSavingConfig(true)
    setConfigSaveError('')
    setConfigSaveSuccess('')
    try {
      const response = await fetch('/api/metas/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfigPayload),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao salvar edições do painel de metas.')
      }
      setMetaConfigs(mergedMetaConfigs)
      setLastSavedConfigSignature(currentConfigSignature)
      setConfigSaveSuccess('Edições salvas com sucesso.')
    } catch (error) {
      setConfigSaveError(error instanceof Error ? error.message : 'Falha ao salvar edições do painel de metas.')
    } finally {
      setIsSavingConfig(false)
    }
  }

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
          supervisorCode?: string | null
          supervisorName?: string | null
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
            supervisorCode: seller.supervisorCode == null ? null : String(seller.supervisorCode),
            supervisorName: seller.supervisorName == null ? null : String(seller.supervisorName),
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

  // ── Sankhya configured targets (financial + weight per brand) ─────────

  useEffect(() => {
    const controller = new AbortController()
    setSankhyaTargetsLoading(true)
    setSankhyaTargetsError('')
    setSankhyaConnected(false)
    setSankhyaNoDataForPeriod(false)
    setSankhyaDiagnostics(null)
    fetch(
      `/api/metas/sankhya-targets?year=${year}&month=${month + 1}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar metas configuradas do Sankhya.')
        setSankhyaTargets(payload.sellers ?? [])
        setSankhyaConnected(true)
        if (payload.noDataForPeriod) setSankhyaNoDataForPeriod(true)
        if (payload.diagnostics) setSankhyaDiagnostics(payload.diagnostics)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setSankhyaTargetsError(err instanceof Error ? err.message : 'Falha ao carregar metas configuradas do Sankhya.')
      })
      .finally(() => { if (!controller.signal.aborted) setSankhyaTargetsLoading(false) })
    return () => controller.abort()
  }, [month, year])

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
            const rows = ((payload.rows ?? []) as Array<{
              sellerCode: string
              sellerName: string
              soldKg: number
              returnKg: number
              soldClients?: number
            }>).map((row) => ({
              ...row,
              soldClients: Number(row.soldClients ?? 0),
            }))
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
          profileType: normalizeSellerProfileType(item.profileType),
          supervisorCode: item.supervisorCode == null ? null : String(item.supervisorCode),
          supervisorName: item.supervisorName == null ? null : String(item.supervisorName),
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
    if (!canViewSellers) {
      setAllowlist([])
      setAllowlistError('Seu cargo não possui permissão para visualizar vendedores da meta.')
      return
    }
    void loadAllowlist()
  }, [canViewSellers, view])

  useEffect(() => {
    if (view !== 'products') return
    if (!canViewProducts) {
      setProductAllowlist([])
      setProductAllowlistError('Seu cargo não possui permissão para visualizar produtos da meta.')
      return
    }
    void loadProductAllowlist()
  }, [canViewProducts, view])

  useEffect(() => {
    if (view !== 'config') return
    if (!canViewSellers) return
    if (allowlistLoading) return
    if (allowlist.length > 0) return
    void loadAllowlist()
  }, [allowlist.length, allowlistLoading, canViewSellers, view])

  useEffect(() => {
    if (view !== 'config') return
    if (!canViewConfig) return
    if (productAllowlistLoading) return
    if (productAllowlist.length > 0) return
    void loadProductAllowlist()
  }, [canViewConfig, productAllowlist.length, productAllowlistLoading, view])

  useEffect(() => {
    if (view !== 'dashboard') return
    if (dashboardFocusProductsPrefetchAttemptedRef.current) return
    if (productAllowlistLoading) return
    if (productAllowlist.length > 0) return
    if (!canViewProducts && !canViewConfig) return
    const hasFocusCodes = ruleBlocks.some((block) => String(block.focusProductCode ?? '').trim().length > 0)
    if (!hasFocusCodes) return
    dashboardFocusProductsPrefetchAttemptedRef.current = true
    void loadProductAllowlist()
  }, [canViewConfig, canViewProducts, productAllowlist.length, productAllowlistLoading, ruleBlocks, view])

  useEffect(() => {
    if (allowlist.length === 0) return
    setRuleBlocks((prev) => {
      let changed = false
      const next = prev.map((block) => {
        if (block.sellerIds.length === 0) return block
        const resolvedProfile = resolveBlockProfileType(block)
        if (normalizeSellerProfileType(block.sellerProfileType) === resolvedProfile) return block
        changed = true
        return { ...block, sellerProfileType: resolvedProfile }
      })
      return changed ? next : prev
    })
  }, [allowlist.length, resolveBlockProfileType])

  function addSellerToAllowlistFromModal() {
    const selectedSeller = sellers.find((seller) => seller.id === addAllowlistModal.selectedSellerId)
    if (!selectedSeller) return

    const nextProfileType = normalizeSellerProfileType(addAllowlistModal.profileType)
    const nextCode = toSellerCodeFromId(selectedSeller.id)
    const normalizedName = normalizeSellerNameForLookup(selectedSeller.name)

    setAllowlist((prev) => {
      const existingIndex = prev.findIndex((item) => {
        const itemCode = normalizeEntityCode(String(item.code ?? ''))
        const itemName = normalizeSellerNameForLookup(item.name)
        return (nextCode && itemCode === nextCode) || itemName === normalizedName
      })

      if (existingIndex >= 0) {
        return prev.map((item, index) =>
          index === existingIndex
            ? {
              ...item,
              code: nextCode || item.code || null,
              name: selectedSeller.name,
              active: true,
              profileType: nextProfileType,
              supervisorCode: item.supervisorCode ?? null,
              supervisorName: item.supervisorName ?? null,
            }
            : item
        )
      }

      return [
        ...prev,
        {
          code: nextCode || null,
          partnerCode: null,
          name: selectedSeller.name,
          active: true,
          profileType: nextProfileType,
          supervisorCode: null,
          supervisorName: null,
        },
      ]
    })

    setAllowlistError('')
    setAllowlistSuccess('Vendedor adicionado/atualizado na lista. Clique em "Salvar lista" para persistir.')
    closeAddAllowlistModal()
  }

  async function saveAllowlist() {
    if (!canSaveSellers) {
      setAllowlistError('Seu cargo não possui permissão para salvar vendedores da meta.')
      return
    }
    setAllowlistSaving(true)
    setAllowlistError('')
    setAllowlistSuccess('')

    const payload = {
      sellers: allowlist.map((seller) => ({
        code: seller.code && seller.code.trim().length > 0 ? seller.code.trim() : null,
        partnerCode: seller.partnerCode && seller.partnerCode.trim().length > 0 ? seller.partnerCode.trim() : null,
        name: seller.name.trim(),
        active: seller.active,
        profileType: normalizeSellerProfileType(seller.profileType),
        supervisorCode: seller.supervisorCode && seller.supervisorCode.trim().length > 0 ? seller.supervisorCode.trim() : null,
        supervisorName: seller.supervisorName && seller.supervisorName.trim().length > 0 ? seller.supervisorName.trim() : null,
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
          profileType: normalizeSellerProfileType(item.profileType),
          supervisorCode: item.supervisorCode == null ? null : String(item.supervisorCode),
          supervisorName: item.supervisorName == null ? null : String(item.supervisorName),
        }))
      )
      setAllowlistSuccess('Lista de vendedores da meta atualizada.')
      // Recarrega visao de desempenho imediatamente.
      setSellersLoading(true)
      setSellersError('')
      const perfResponse = await fetch(`/api/metas/sellers-performance?year=${year}&month=${month + 1}&companyScope=${companyScopeFilter}`)
      const perfData = await perfResponse.json().catch(() => ({}))
      if (perfResponse.ok) {
        const remoteSellers = (perfData?.sellers ?? []) as Array<{
          id: string
          name: string
          login: string
          supervisorCode?: string | null
          supervisorName?: string | null
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
              supervisorCode: seller.supervisorCode == null ? null : String(seller.supervisorCode),
              supervisorName: seller.supervisorName == null ? null : String(seller.supervisorName),
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
    if (!canRemoveSellers) {
      setAllowlistError('Seu cargo não possui permissão para remover vendedores da meta.')
      return
    }
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
            profileType: normalizeSellerProfileType(s.profileType),
            supervisorCode: s.supervisorCode && s.supervisorCode.trim().length > 0 ? s.supervisorCode.trim() : null,
            supervisorName: s.supervisorName && s.supervisorName.trim().length > 0 ? s.supervisorName.trim() : null,
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
          profileType: normalizeSellerProfileType(item.profileType),
          supervisorCode: item.supervisorCode == null ? null : String(item.supervisorCode),
          supervisorName: item.supervisorName == null ? null : String(item.supervisorName),
        }))
      )
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao remover vendedor.')
      void loadAllowlist()
    }
  }

  async function syncAllowlistFromSankhya() {
    if (!canSaveSellers) {
      setAllowlistError('Seu cargo não possui permissão para sincronizar vendedores da meta.')
      return
    }
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
          profileType: normalizeSellerProfileType(item.profileType),
          supervisorCode: item.supervisorCode == null ? null : String(item.supervisorCode),
          supervisorName: item.supervisorName == null ? null : String(item.supervisorName),
        }))
      )
      const imported = Number(data?.imported ?? 0)
      const added = Number(data?.added ?? 0)
      setAllowlistSuccess(
        imported > 0
          ? `Sincronizacao concluida: ${added} novo(s) vendedor(es) adicionado(s) e ${imported} registro(s) processado(s) do Sankhya.`
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
    if (!canSaveProducts) {
      setProductAllowlistError('Seu cargo não possui permissão para salvar produtos da meta.')
      return
    }
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
    if (!canRemoveProducts) {
      setProductAllowlistError('Seu cargo não possui permissão para remover produtos da meta.')
      return
    }
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
    if (!canSaveProducts) {
      setProductAllowlistError('Seu cargo não possui permissão para sincronizar produtos da meta.')
      return
    }
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
      const added = Number(data?.added ?? 0)
      setProductAllowlistSuccess(
        imported > 0
          ? `Sincronizacao concluida: ${added} novo(s) produto(s) adicionado(s) e ${imported} registro(s) processado(s) do Sankhya.`
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

  const sellerIncludedDateEntries = useMemo(() => {
    return (activeMonth?.sellerIncludedDates ?? []).map((entry) => {
      const sellerName = sellers.find((seller) => seller.id === entry.sellerId)?.name ?? entry.sellerName ?? entry.sellerId
      return { ...entry, sellerName }
    })
  }, [activeMonth?.sellerIncludedDates, sellers])

  const sellerSpecificDatesFooterSummary = useMemo(() => {
    const entries = sellerIncludedDateEntries
    if (entries.length === 0) return ''
    const uniqueSellerCount = new Set(entries.map((entry) => entry.sellerId)).size
    const uniqueDateCount = new Set(entries.map((entry) => entry.date)).size
    const preview = entries
      .slice(0, 3)
      .map((entry) => `${entry.sellerName} (${formatDateBr(entry.date)})`)
      .join(', ')
    const more = entries.length > 3 ? ` e mais ${entries.length - 3}` : ''
    return ` Exceções ativas para este mês: ${entries.length} data(s) específica(s), envolvendo ${uniqueSellerCount} vendedor(es) em ${uniqueDateCount} data(s). ${preview}${more}.`
  }, [sellerIncludedDateEntries])

  const cycle = useMemo(
    () => buildCycle(
      activeMonth?.week1StartDate ?? '',
      activeMonth?.closingWeekEndDate ?? '',
      year,
      month,
      blockedSet,
      activeMonth?.weekPeriods
    ),
    [activeMonth?.closingWeekEndDate, activeMonth?.week1StartDate, activeMonth?.weekPeriods, blockedSet, month, year]
  )
  const stageEnds = useMemo(() => ({
    w1: cycle.weeks.find((w) => w.key === 'W1')?.end ?? '',
    w2: cycle.weeks.find((w) => w.key === 'W2')?.end ?? '',
    w3: cycle.weeks.find((w) => w.key === 'W3')?.end ?? '',
    closing: cycle.weeks.find((w) => w.key === 'CLOSING')?.end ?? '',
  }), [cycle.weeks])
  const distributionBySellerProduct = useMemo(() => {
    const bySeller = new Map<string, SellerDistributionRow[]>()
    for (const row of distributionRows) {
      const sellerCode = normalizeEntityCode(String(row.sellerCode ?? '').trim())
      const clientCode = normalizeEntityCode(String(row.clientCode ?? '').trim())
      if (!sellerCode || !clientCode) continue
      if (!bySeller.has(sellerCode)) bySeller.set(sellerCode, [])
      bySeller.get(sellerCode)!.push(row)
    }
    return bySeller
  }, [distributionRows])
  const distributionItemsBySeller = useMemo(() => {
    const bySeller = new Map<string, SellerDistributionItemsRow>()
    for (const row of distributionSellerItemsRows) {
      const sellerCode = normalizeEntityCode(String(row.sellerCode ?? '').trim())
      if (!sellerCode) continue
      bySeller.set(sellerCode, row)
    }
    return bySeller
  }, [distributionSellerItemsRows])

  useEffect(() => {
    const controller = new AbortController()
    setDistributionLoading(true)
    setDistributionError('')
    setDistributionDiagnostics(null)

    const params = new URLSearchParams({
      year: String(year),
      month: String(month + 1),
      companyScope: companyScopeFilter,
      w1End: stageEnds.w1,
      w2End: stageEnds.w2,
      w3End: stageEnds.w3,
      closingEnd: stageEnds.closing,
    })

    fetch(`/api/metas/sellers-performance/item-distribution?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao carregar distribuicao de itens.')
        }
        return payload
      })
      .then((data) => {
        const rows = Array.isArray(data?.rows) ? data.rows : []
        const sellerItemsRows = Array.isArray(data?.sellerItems) ? data.sellerItems : []
        const mapped = rows.map((row: Record<string, unknown>) => ({
          sellerCode: normalizeEntityCode(String(row.sellerCode ?? '').trim()),
          clientCode: normalizeEntityCode(String(row.clientCode ?? '').trim()),
          productsW1: Math.max(Math.floor(parseDecimal(String(row.productsW1 ?? 0), 0)), 0),
          productsW2: Math.max(Math.floor(parseDecimal(String(row.productsW2 ?? 0), 0)), 0),
          productsW3: Math.max(Math.floor(parseDecimal(String(row.productsW3 ?? 0), 0)), 0),
          productsClosing: Math.max(Math.floor(parseDecimal(String(row.productsClosing ?? 0), 0)), 0),
          productsMonth: Math.max(Math.floor(parseDecimal(String(row.productsMonth ?? 0), 0)), 0),
        })) as SellerDistributionRow[]
        const mappedSellerItems = sellerItemsRows.map((row: Record<string, unknown>) => ({
          sellerCode: normalizeEntityCode(String(row.sellerCode ?? '').trim()),
          itemsW1: Math.max(Math.floor(parseDecimal(String(row.itemsW1 ?? 0), 0)), 0),
          itemsW2: Math.max(Math.floor(parseDecimal(String(row.itemsW2 ?? 0), 0)), 0),
          itemsW3: Math.max(Math.floor(parseDecimal(String(row.itemsW3 ?? 0), 0)), 0),
          itemsClosing: Math.max(Math.floor(parseDecimal(String(row.itemsClosing ?? 0), 0)), 0),
          itemsMonth: Math.max(Math.floor(parseDecimal(String(row.itemsMonth ?? 0), 0)), 0),
        })) as SellerDistributionItemsRow[]
        setDistributionRows(mapped)
        setDistributionSellerItemsRows(mappedSellerItems)
        setDistributionDiagnostics(((data?.diagnostics as DistributionDiagnostics | undefined) ?? null))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setDistributionRows([])
        setDistributionSellerItemsRows([])
        setDistributionDiagnostics(null)
        setDistributionError(error instanceof Error ? error.message : 'Falha ao carregar distribuicao de itens.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setDistributionLoading(false)
      })

    return () => controller.abort()
  }, [companyScopeFilter, month, stageEnds.closing, stageEnds.w1, stageEnds.w2, stageEnds.w3, year])

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
        const blockProfileType = resolveBlockProfileType(block)
        const rewardMode = getRewardModeFromProfile(blockProfileType)
        const percentRewardCap = getPercentRewardCap(blockProfileType)
        const blockRules = block.rules
        const blockPointsTarget = blockRules.reduce((sum, rule) => sum + rule.points, 0)
        const blockRewardTarget = blockRules.reduce((sum, rule) => sum + rule.rewardValue, 0)
        const activePointsTarget = blockRules.filter((r) => stageStarted.has(r.stage)).reduce((sum, rule) => sum + rule.points, 0)
        const sellerIncludedDates = new Set(
          (activeMonth?.sellerIncludedDates ?? [])
            .filter((entry) => entry.sellerId === seller.id)
            .map((entry) => entry.date)
        )

        const stageMetrics = STAGES.reduce(
          (acc, stage) => {
            acc[stage.key] = { orderCount: 0, totalValue: 0, clientCodes: new Set<string>() }
            return acc
          },
          {} as Record<StageKey, { orderCount: number; totalValue: number; clientCodes: Set<string> }>
        )

        // Count ALL distinct clients from the month (regardless of cycle dates)
        const allMonthClientCodes = new Set<string>()
        for (const order of seller.orders) {
          if (order.clientCode) allMonthClientCodes.add(order.clientCode)
        }

        for (const order of seller.orders) {
          let stage = findStageForDate(order.negotiatedAt, cycle.weeks)
          if (!stage && sellerIncludedDates.has(order.negotiatedAt)) {
            stage = findStageForIncludedDate(order.negotiatedAt, cycle.weeks)
          }
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

        // totalDistinctClients = all unique clients in the month (not just those within cycle dates)
        const totalDistinctClients = allMonthClientCodes.size
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
        // Resolve effective weight targets: Sankhya value when available, manual-by-period when Sankhya connected but no period data, legacy targetKg otherwise
        const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
        const sankhyaSellerData = sankhyaTargets.find((t) => t.sellerCode === sellerCode)
        const effectiveWeightTargets = (block.weightTargets ?? []).map((wt) => {
          if (!wt.brand) return wt
          // Prefer Sankhya live data
          if (sankhyaSellerData) {
            const sk = sankhyaSellerData.weightTargets.find((w) => w.brand.toUpperCase() === wt.brand.toUpperCase())
            if (sk) return { ...wt, targetKg: sk.targetKg }
          }
          // Sankhya connected — use period-specific manual value (0 if not set for this period)
          if (sankhyaConnected) {
            const manualVal = wt.manualKgByPeriod?.[periodKey] ?? 0
            return { ...wt, targetKg: manualVal }
          }
          // Sankhya not connected — use legacy targetKg
          return wt
        })
        const weightTargetRatios = getSellerWeightTargetRatios(effectiveWeightTargets, brandWeightRows, sellerCode)
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
        // Meta financeira: resolve with period-specific logic
        // Priority: 1) Sankhya live data, 2) manual for this exact period,
        // 3) for future periods — most recent manual value as fallback, 4) legacy monthlyTarget
        const sankhyaFinancialTarget = sankhyaSellerData?.financialTarget ?? null
        const resolvedMonthlyTarget = (() => {
          if ((sankhyaFinancialTarget ?? 0) > 0) return sankhyaFinancialTarget!
          if (!sankhyaConnected) return block.monthlyTarget > 0 ? block.monthlyTarget : 0
          // Sankhya connected but no data for this period
          const manualMap = block.manualFinancialByPeriod ?? {}
          const exactVal = manualMap[periodKey]
          if (exactVal && exactVal > 0) return exactVal
          // For future/current periods: use most recent past manual value as fallback
          const now = new Date()
          const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          if (periodKey >= currentPeriodKey) {
            const sortedKeys = Object.keys(manualMap).sort()
            const fallbackKey = [...sortedKeys].reverse().find((k) => manualMap[k] > 0)
            if (fallbackKey) return manualMap[fallbackKey]
          }
          return 0
        })()
        const monthlyTargetSafe = resolvedMonthlyTarget > 0 ? resolvedMonthlyTarget : teamAverageValueSafe

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
              const { resolvedItems, clientsPct } = parseDistribuicaoTarget(rule.targetText, totalActiveProducts)
              const baseTotalClients = Math.max(officialBaseClients > 0 ? officialBaseClients : totalDistinctClients, 0)
              const requiredClients = clientsPct > 0 && baseTotalClients > 0
                ? Math.ceil(baseTotalClients * (clientsPct / 100))
                : 0
              const sellerRows = distributionBySellerProduct.get(sellerCode) ?? []
              const sellerItemsRow = distributionItemsBySeller.get(sellerCode)
              const soldItemsStage = getDistribuicaoItemsByStage(sellerItemsRow, rule.stage)
              const clientsWithAnyItems = sellerRows.reduce((sum, row) => {
                const productsByStage = getDistribuicaoProductsByStage(row, rule.stage)
                return sum + (productsByStage >= 1 ? 1 : 0)
              }, 0)
              if (!distributionLoading && !distributionError && resolvedItems > 0 && requiredClients > 0 && totalActiveProducts > 0) {
                const itemsProgress = soldItemsStage / Math.max(resolvedItems, 1)
                const clientsProgress = clientsWithAnyItems / Math.max(requiredClients, 1)
                progress = Math.min(itemsProgress, clientsProgress)
              } else if (resolvedItems > 0 && clientsPct > 0 && baseTotalClients > 0) {
                // Fallback while distribution matrix is unavailable.
                const fallbackRequiredClients = Math.ceil(baseTotalClients * (clientsPct / 100))
                const clientsAchieved = cumStage.distinctClients
                progress = clientsAchieved / Math.max(fallbackRequiredClients, 1)
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
                const mode = resolveFocusTargetMode(block)
                const baseTotalClients = Math.max(officialBaseClients > 0 ? officialBaseClients : totalDistinctClients, 0)
                if (!focusCode) {
                  progress = 0
                  break
                }
                if (mode === 'BASE_CLIENTS') {
                  const targetBasePct = Math.max(block.focusTargetBasePct ?? 0, 0)
                  const requiredBaseClients = targetBasePct > 0
                    ? Math.ceil(baseTotalClients * (targetBasePct / 100))
                    : 0
                  progress = requiredBaseClients > 0
                    ? focusSoldClients / Math.max(requiredBaseClients, 1)
                    : 0
                  break
                }
                const { volumePct } = parseItemFocoTarget(rule.targetText)
                const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
                if (focusTargetKg <= 0 || volumePct <= 0) {
                  progress = 0
                  break
                }
                const requiredKg = focusTargetKg * (volumePct / 100)
                progress = requiredKg > 0 ? focusSoldKg / requiredKg : 0
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
          if (rewardMode === 'PERCENT') return sum
          if (!prize.active || prize.type !== 'CASH') return sum
          const monthlyTargetBase = Math.max(block.monthlyTarget, 0)
          const rewardValue = Math.max(prize.rewardValue, 0)
          return sum + (prize.cashMode === 'FIXED' ? rewardValue : (monthlyTargetBase * rewardValue) / 100)
        }, 0)

        const campaignCashAchieved = prizes.reduce((sum, prize) => {
          if (rewardMode === 'PERCENT') return sum
          if (!prize.active || prize.type !== 'CASH') return sum
          if (pointsAchieved < prize.minPoints) return sum
          const monthlyTargetBase = Math.max(block.monthlyTarget, 0)
          const rewardValue = Math.max(prize.rewardValue, 0)
          return sum + (prize.cashMode === 'FIXED' ? rewardValue : (monthlyTargetBase * rewardValue) / 100)
        }, 0)

        const extraBonusEligible = rewardMode === 'CURRENCY' && pointsAchieved >= extraMinPoints
        const extraBonusAchieved = extraBonusEligible ? Math.max(extraBonus, 0) : 0
        const rewardAchieved =
          rewardMode === 'PERCENT'
            ? Math.min(Math.max(kpiRewardAchieved, 0), percentRewardCap)
            : kpiRewardAchieved + campaignCashAchieved + extraBonusAchieved

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
          kpiRewardAchieved:
            rewardMode === 'PERCENT'
              ? Math.min(Math.max(kpiRewardAchieved, 0), percentRewardCap)
              : kpiRewardAchieved,
          rewardAchieved,
          rewardTarget:
            rewardMode === 'PERCENT'
              ? percentRewardCap
              : blockRewardTarget + campaignCashTarget + Math.max(extraBonus, 0),
          rewardMode,
          status,
          gapToTarget: Math.max(blockPointsTarget - pointsAchieved, 0),
          ruleProgress,
          blockId: block.id,
        }
      })
      .sort((a, b) => b.pointsAchieved - a.pointsAchieved)
  }, [activeMonth?.sellerIncludedDates, brandWeightRows, cycle.weeks, extraBonus, extraMinPoints, focusProductRows, prizes, productAllowlist, resolveBlockProfileType, ruleBlocks, sankhyaTargets, sellers])

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
  // Sum of weight targets only for blocks that belong to sellers in this view's scope
  const corporateTotalWeightTarget = useMemo(() => {
    const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const blockIdsInScope = new Set(snapshots.map((s) => s.blockId))
    return ruleBlocks
      .filter((block) => blockIdsInScope.has(block.id))
      .reduce((sum, block) => sum + (block.weightTargets ?? []).reduce((s, wt) => {
        const sk = sankhyaTargets.flatMap((t) => t.weightTargets).find((w) => w.brand.toUpperCase() === wt.brand.toUpperCase())
        const val = sk ? sk.targetKg : sankhyaConnected ? (wt.manualKgByPeriod?.[periodKey] ?? 0) : wt.targetKg
        return s + (val > 0 ? val : 0)
      }, 0), 0)
  }, [ruleBlocks, snapshots, sankhyaTargets, sankhyaConnected, year, month])
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
  const filteredSellerAllowlist = useMemo(() => {
    return allowlist
      .map((seller, index) => ({ seller, index }))
      .filter((entry) => !allowlistShowOnlyInactive || !entry.seller.active)
  }, [allowlist, allowlistShowOnlyInactive])

  const sellerAllowlistStats = useMemo(() => {
    const total = allowlist.length
    const active = allowlist.filter((seller) => seller.active).length
    const inactive = Math.max(total - active, 0)
    return { total, active, inactive }
  }, [allowlist])

  const supervisorAllowlistOptions = useMemo(() => {
    return allowlist
      .filter((seller) => normalizeSellerProfileType(seller.profileType) === 'SUPERVISOR')
      .map((seller) => ({
        key: String(seller.code ?? '').trim() || `name:${normalizeSellerNameForLookup(seller.name)}`,
        code: String(seller.code ?? '').trim() || null,
        name: seller.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [allowlist])

  const filteredProductAllowlist = useMemo(() => {
    const codeFilter = productCodeFilter.trim().toUpperCase()
    const descriptionFilter = productDescriptionFilter.trim().toUpperCase()
    const brandFilter = productBrandFilter.trim().toUpperCase()

    return productAllowlist.filter((product) => {
      const codeOk = codeFilter.length === 0 || product.code.toUpperCase().includes(codeFilter)
      const descriptionOk =
        descriptionFilter.length === 0 || product.description.toUpperCase().includes(descriptionFilter)
      const brandOk = brandFilter.length === 0 || product.brand.toUpperCase().includes(brandFilter)
      const statusOk = !productShowOnlyInactive || !product.active
      return codeOk && descriptionOk && brandOk && statusOk
    })
  }, [productAllowlist, productCodeFilter, productDescriptionFilter, productBrandFilter, productShowOnlyInactive])

  const sortedProductAllowlist = useMemo(() => {
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
    return filteredProductAllowlist
      .map((product, index) => ({ product, index }))
      .sort((a, b) => {
        const left = a.product
        const right = b.product
        let compare = 0
        switch (productSort.key) {
          case 'active':
            compare = Number(left.active) - Number(right.active)
            break
          case 'code':
            compare = collator.compare(left.code ?? '', right.code ?? '')
            break
          case 'description':
            compare = collator.compare(left.description ?? '', right.description ?? '')
            break
          case 'brand':
            compare = collator.compare(left.brand ?? '', right.brand ?? '')
            break
          case 'unit':
            compare = collator.compare(left.unit ?? '', right.unit ?? '')
            break
          case 'mobility':
            compare = collator.compare(left.mobility ?? '', right.mobility ?? '')
            break
          default:
            compare = 0
            break
        }
        if (compare === 0) compare = a.index - b.index
        return productSort.direction === 'asc' ? compare : -compare
      })
      .map((entry) => entry.product)
  }, [filteredProductAllowlist, productSort.direction, productSort.key])

  function toggleProductSort(key: ProductSortKey) {
    setProductSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const productAllowlistStats = useMemo(() => {
    const total = productAllowlist.length
    const active = productAllowlist.filter((product) => product.active).length
    const inactive = Math.max(total - active, 0)
    return { total, active, inactive }
  }, [productAllowlist])

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
    const monetarySnapshots = snapshots.filter((snapshot) => snapshot.rewardMode === 'CURRENCY')
    let totalEarned = 0
    let totalTarget = 0
    let totalKpiHit = 0
    let totalKpiTarget = 0
    for (const s of snapshots) {
      const block = ruleBlocks.find((b) => b.id === s.blockId) ?? ruleBlocks[0]
      totalKpiTarget += block.rules.length
      totalKpiHit += block.rules.reduce((sum, rule) => {
        const progress = s.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
        return sum + (progress >= 1 ? 1 : 0)
      }, 0)
    }
    for (const s of monetarySnapshots) {
      groups[s.status] += s.rewardAchieved
      totalEarned += s.rewardAchieved
      totalTarget += s.rewardTarget
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

  const sellerWeightPerformanceRows = useMemo(() => {
    const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const soldBySellerBrand = new Map<string, number>()
    for (const row of brandWeightRows) {
      const sellerCode = normalizeEntityCode(String(row.sellerCode ?? ''))
      const brand = String(row.brand ?? '').trim().toUpperCase()
      const totalKg = Number(row.totalKg ?? 0)
      if (!sellerCode || !brand || !Number.isFinite(totalKg) || totalKg <= 0) continue
      const key = `${sellerCode}::${brand}`
      soldBySellerBrand.set(key, (soldBySellerBrand.get(key) ?? 0) + totalKg)
    }

    const sankhyaBySellerBrand = new Map<string, Map<string, number>>()
    for (const sellerTarget of sankhyaTargets) {
      const sellerCode = normalizeEntityCode(String(sellerTarget.sellerCode ?? ''))
      if (!sellerCode) continue
      const byBrand = new Map<string, number>()
      for (const target of sellerTarget.weightTargets ?? []) {
        const brand = String(target.brand ?? '').trim().toUpperCase()
        const targetKg = Number(target.targetKg ?? 0)
        if (!brand || !Number.isFinite(targetKg) || targetKg <= 0) continue
        byBrand.set(brand, targetKg)
      }
      sankhyaBySellerBrand.set(sellerCode, byBrand)
    }
    const supervisorByCode = new Map<string, { key: string; name: string }>()
    const supervisorByName = new Map<string, { key: string; name: string }>()
    for (const supervisor of supervisorAllowlistOptions) {
      const normalizedSupervisorCode = normalizeEntityCode(String(supervisor.code ?? ''))
      const normalizedSupervisorName = normalizeSellerNameForLookup(String(supervisor.name ?? ''))
      const entry = { key: supervisor.key, name: supervisor.name }
      if (normalizedSupervisorCode) supervisorByCode.set(normalizedSupervisorCode, entry)
      if (normalizedSupervisorName) supervisorByName.set(normalizedSupervisorName, entry)
    }

    return snapshots
      .map((snapshot) => {
        const sellerCode = toSellerCodeFromId(snapshot.seller.id)
        const sellerName = snapshot.seller.name
        const sellerShortName = getSellerShortName(sellerName)
        const block =
          ruleBlocks.find((candidate) => candidate.id === snapshot.blockId) ??
          findBlockForSeller(snapshot.seller.id, ruleBlocks) ??
          DEFAULT_RULE_BLOCKS[0]
        const sankhyaByBrand = sankhyaBySellerBrand.get(sellerCode)
        const allowlistEntry = resolveAllowlistSellerEntry(sellerCode, sellerName, sellerShortName)
        const sellerSupervisorCode = normalizeEntityCode(
          String(allowlistEntry?.supervisorCode ?? snapshot.seller.supervisorCode ?? '')
        )
        const sellerSupervisorName = String(
          allowlistEntry?.supervisorName ?? snapshot.seller.supervisorName ?? ''
        ).trim()
        const sellerSupervisorNameNormalized = normalizeSellerNameForLookup(sellerSupervisorName)
        const resolvedSupervisor =
          (sellerSupervisorCode ? supervisorByCode.get(sellerSupervisorCode) : undefined) ??
          (sellerSupervisorNameNormalized ? supervisorByName.get(sellerSupervisorNameNormalized) : undefined)
        const supervisorKey =
          resolvedSupervisor?.key ??
          (sellerSupervisorCode
            ? `code:${sellerSupervisorCode}`
            : sellerSupervisorNameNormalized
              ? `name:${sellerSupervisorNameNormalized}`
              : null)
        const supervisorName =
          resolvedSupervisor?.name ??
          (sellerSupervisorName.length > 0
            ? sellerSupervisorName
            : sellerSupervisorCode
              ? `Supervisor ${sellerSupervisorCode}`
              : null)

        const groups = (block.weightTargets ?? [])
          .map((target) => {
            const brand = String(target.brand ?? '').trim().toUpperCase()
            if (!brand) return null
            const sankhyaTarget = sankhyaByBrand?.get(brand)
            const fallbackTarget = sankhyaConnected
              ? Number(target.manualKgByPeriod?.[periodKey] ?? 0)
              : Number(target.targetKg ?? 0)
            const rawTargetKg = sankhyaTarget ?? fallbackTarget
            const targetKg = Number.isFinite(rawTargetKg) && rawTargetKg > 0 ? rawTargetKg : 0
            const soldKg = Math.max(soldBySellerBrand.get(`${sellerCode}::${brand}`) ?? 0, 0)
            const ratio = targetKg > 0 ? soldKg / targetKg : 0
            return { brand, targetKg, soldKg, ratio }
          })
          .filter((group): group is { brand: string; targetKg: number; soldKg: number; ratio: number } => Boolean(group))

        const groupsWithTarget = groups.filter((group) => group.targetKg > 0)
        const totalTargetKg = groupsWithTarget.reduce((sum, group) => sum + group.targetKg, 0)
        const totalSoldKg = groupsWithTarget.reduce((sum, group) => sum + group.soldKg, 0)
        const overallRatio = totalTargetKg > 0 ? totalSoldKg / totalTargetKg : 0
        const groupsHit = groupsWithTarget.filter((group) => group.ratio >= 1).length

        return {
          sellerId: snapshot.seller.id,
          sellerCode,
          sellerName,
          sellerShortName,
          supervisorKey,
          supervisorCode: sellerSupervisorCode || null,
          supervisorName,
          blockTitle: block.title,
          groupsWithTarget,
          groupsConfigured: groupsWithTarget.length,
          groupsHit,
          totalTargetKg,
          totalSoldKg,
          overallRatio,
        }
      })
      .sort((a, b) => {
        if (b.overallRatio !== a.overallRatio) return b.overallRatio - a.overallRatio
        if (b.totalSoldKg !== a.totalSoldKg) return b.totalSoldKg - a.totalSoldKg
        return a.sellerShortName.localeCompare(b.sellerShortName, 'pt-BR')
      })
  }, [
    brandWeightRows,
    month,
    resolveAllowlistSellerEntry,
    ruleBlocks,
    sankhyaConnected,
    sankhyaTargets,
    snapshots,
    supervisorAllowlistOptions,
    year,
  ])

  const weightBrandOrderIndex = useMemo(() => {
    const order = new Map<string, number>()
    let index = 0
    for (const block of ruleBlocks) {
      for (const target of block.weightTargets ?? []) {
        const brand = String(target.brand ?? '').trim().toUpperCase()
        if (!brand || order.has(brand)) continue
        order.set(brand, index)
        index += 1
      }
    }
    return order
  }, [ruleBlocks])

  const performanceSupervisorOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>()
    for (const seller of sellers) {
      if (!seller.supervisorCode || !seller.supervisorName) continue
      const key = seller.supervisorCode
      if (!map.has(key)) map.set(key, { key, name: seller.supervisorName })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [sellers])

  const weightSupervisorOptions = useMemo(() => {
    const map = new Map<string, { key: string; code: string | null; name: string; sellers: number; sellersWithGoals: number }>()
    for (const row of sellerWeightPerformanceRows) {
      if (!row.supervisorKey || !row.supervisorName) continue
      const current = map.get(row.supervisorKey) ?? {
        key: row.supervisorKey,
        code: row.supervisorCode ?? null,
        name: row.supervisorName,
        sellers: 0,
        sellersWithGoals: 0,
      }
      current.sellers += 1
      if (row.groupsConfigured > 0) current.sellersWithGoals += 1
      map.set(row.supervisorKey, current)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [sellerWeightPerformanceRows])

  useEffect(() => {
    if (weightPanelView !== 'SUPERVISOR') return
    if (weightSupervisorOptions.length === 0) {
      if (weightPanelSupervisorKey !== '') setWeightPanelSupervisorKey('')
      return
    }
    const exists = weightSupervisorOptions.some((option) => option.key === weightPanelSupervisorKey)
    if (!exists) {
      const preferred = weightSupervisorOptions.find((option) => option.sellersWithGoals > 0) ?? weightSupervisorOptions[0]
      setWeightPanelSupervisorKey(preferred.key)
    }
  }, [weightPanelSupervisorKey, weightPanelView, weightSupervisorOptions])

  const weightScopedSellerRows = useMemo(() => {
    if (weightPanelView !== 'SUPERVISOR') return sellerWeightPerformanceRows
    if (!weightPanelSupervisorKey) return []
    return sellerWeightPerformanceRows.filter((row) => row.supervisorKey === weightPanelSupervisorKey)
  }, [sellerWeightPerformanceRows, weightPanelSupervisorKey, weightPanelView])

  const weightOverviewByBrand = useMemo(() => {
    const byBrand = new Map<string, { brand: string; targetKg: number; soldKg: number; sellerCount: number; hitSellers: number }>()
    for (const seller of weightScopedSellerRows) {
      for (const group of seller.groupsWithTarget) {
        const current = byBrand.get(group.brand) ?? {
          brand: group.brand,
          targetKg: 0,
          soldKg: 0,
          sellerCount: 0,
          hitSellers: 0,
        }
        current.targetKg += group.targetKg
        current.soldKg += group.soldKg
        current.sellerCount += 1
        if (group.ratio >= 1) current.hitSellers += 1
        byBrand.set(group.brand, current)
      }
    }
    return Array.from(byBrand.values())
      .map((entry) => ({
        ...entry,
        ratio: entry.targetKg > 0 ? entry.soldKg / entry.targetKg : 0,
      }))
      .sort((a, b) => {
        const aOrder = weightBrandOrderIndex.get(a.brand) ?? Number.POSITIVE_INFINITY
        const bOrder = weightBrandOrderIndex.get(b.brand) ?? Number.POSITIVE_INFINITY
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.brand.localeCompare(b.brand, 'pt-BR')
      })
  }, [weightBrandOrderIndex, weightScopedSellerRows])

  const weightExecutiveSummary = useMemo(() => {
    // In SELLER mode, scope the summary to the selected seller only
    const sourceRows =
      weightPanelView === 'SELLER' && weightPanelSellerId
        ? weightScopedSellerRows.filter((row) => row.sellerId === weightPanelSellerId)
        : weightScopedSellerRows

    const sellersTracked = sourceRows.length
    const sellersWithGoals = sourceRows.filter((row) => row.groupsConfigured > 0).length
    const totalTargetKg = sourceRows.reduce((sum, row) => sum + row.totalTargetKg, 0)
    const totalSoldKg = sourceRows.reduce((sum, row) => sum + row.totalSoldKg, 0)
    const overallRatio = totalTargetKg > 0 ? totalSoldKg / totalTargetKg : 0
    const totalGroups = sourceRows.reduce((sum, row) => sum + row.groupsConfigured, 0)
    const hitGroups = sourceRows.reduce((sum, row) => sum + row.groupsHit, 0)
    return {
      sellersTracked,
      sellersWithGoals,
      totalTargetKg,
      totalSoldKg,
      overallRatio,
      totalGroups,
      hitGroups,
      brandsTracked: weightOverviewByBrand.length,
    }
  }, [weightOverviewByBrand.length, weightPanelView, weightPanelSellerId, weightScopedSellerRows])

  const hasAnyWeightGoals = useMemo(
    () => sellerWeightPerformanceRows.some((row) => row.groupsConfigured > 0),
    [sellerWeightPerformanceRows]
  )

  // Sum of individual seller weight targets (not block-level, avoids duplication)
  const corporateWeightTargetPerSeller = useMemo(
    () => sellerWeightPerformanceRows.reduce((sum, row) => sum + row.totalTargetKg, 0),
    [sellerWeightPerformanceRows]
  )

  useEffect(() => {
    if (sellerWeightPerformanceRows.length === 0) {
      if (weightPanelSellerId !== '') setWeightPanelSellerId('')
      return
    }
    const exists = sellerWeightPerformanceRows.some((row) => row.sellerId === weightPanelSellerId)
    if (!exists) setWeightPanelSellerId(sellerWeightPerformanceRows[0].sellerId)
  }, [sellerWeightPerformanceRows, weightPanelSellerId])

  const selectedWeightSellerDetails = useMemo(
    () =>
      sellerWeightPerformanceRows.find((row) => row.sellerId === weightPanelSellerId) ??
      sellerWeightPerformanceRows[0] ??
      null,
    [sellerWeightPerformanceRows, weightPanelSellerId]
  )

  const selectedWeightSupervisorSellerDetails = useMemo(() => {
    if (weightPanelView !== 'SUPERVISOR' || !weightPanelSellerId) return null
    return weightScopedSellerRows.find((row) => row.sellerId === weightPanelSellerId) ?? null
  }, [weightPanelSellerId, weightPanelView, weightScopedSellerRows])

  const weightPanelDrilledSellerDetails = useMemo(() => {
    if (weightPanelView === 'SELLER') return selectedWeightSellerDetails
    if (weightPanelView === 'SUPERVISOR') return selectedWeightSupervisorSellerDetails
    return null
  }, [selectedWeightSellerDetails, selectedWeightSupervisorSellerDetails, weightPanelView])

  const weightPanelDrilledSellerGroupRows = useMemo(() => {
    if (!weightPanelDrilledSellerDetails) return []
    return [...weightPanelDrilledSellerDetails.groupsWithTarget].sort((a, b) => {
      const aOrder = weightBrandOrderIndex.get(a.brand) ?? Number.POSITIVE_INFINITY
      const bOrder = weightBrandOrderIndex.get(b.brand) ?? Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.brand.localeCompare(b.brand, 'pt-BR')
    })
  }, [weightBrandOrderIndex, weightPanelDrilledSellerDetails])

  const weightFocusProgressRows = useMemo(() => {
    const sellerRankById = new Map<string, number>()
    sellerWeightPerformanceRows.forEach((row, index) => {
      sellerRankById.set(row.sellerId, index)
    })

    const scopedSellerIds = new Set(
      weightPanelDrilledSellerDetails
        ? [weightPanelDrilledSellerDetails.sellerId]
        : snapshots.map((snapshot) => snapshot.seller.id)
    )

    return snapshots
      .flatMap((snapshot) => {
        if (!scopedSellerIds.has(snapshot.seller.id)) return []
        const sellerId = snapshot.seller.id
        const block =
          ruleBlocks.find((candidate) => candidate.id === snapshot.blockId) ??
          findBlockForSeller(sellerId, ruleBlocks) ??
          null
        if (!block) return []

        const focusCode = (block.focusProductCode ?? '').trim()
        if (!focusCode) return []

        const focusTargetMode = resolveFocusTargetMode(block)
        const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
        const focusTargetBasePct = Math.max(block.focusTargetBasePct ?? 0, 0)
        const hasTarget = focusTargetMode === 'BASE_CLIENTS' ? focusTargetBasePct > 0 : focusTargetKg > 0
        if (!hasTarget) return []

        const sellerCode = toSellerCodeFromId(sellerId)
        const productRows = focusProductRows[focusCode] ?? []
        const sellerFocusRow = productRows.find((row) => normalizeEntityCode(String(row.sellerCode ?? '')) === sellerCode)
        const soldKg = Math.max(Number(sellerFocusRow?.soldKg ?? 0), 0)
        const soldClients = Math.max(Number(sellerFocusRow?.soldClients ?? 0), 0)
        const officialBaseClients = Math.max(snapshot.seller.baseClientCount ?? 0, 0)
        const baseTotalClients = officialBaseClients > 0 ? officialBaseClients : Math.max(snapshot.uniqueClients, 0)
        const requiredBaseClients = focusTargetBasePct > 0 ? Math.ceil(baseTotalClients * (focusTargetBasePct / 100)) : 0
        const baseCoveragePct = baseTotalClients > 0 ? (soldClients / baseTotalClients) * 100 : 0

        const itemFocoRule = block.rules.find((rule) => (rule.kpiType ?? inferKpiType(rule.kpi)) === 'ITEM_FOCO')
        const itemFocoParams = itemFocoRule ? parseItemFocoTarget(itemFocoRule.targetText) : { volumePct: 0, basePct: 0 }
        const volumeRequiredKg = focusTargetKg > 0
          ? focusTargetKg * (Math.max(itemFocoParams.volumePct, 0) / 100 || 1)
          : 0

        const progressRatio = focusTargetMode === 'BASE_CLIENTS'
          ? (requiredBaseClients > 0 ? soldClients / requiredBaseClients : 0)
          : (volumeRequiredKg > 0 ? soldKg / volumeRequiredKg : 0)
        const progressPct = progressRatio * 100
        const status = progressRatio >= 1 ? 'NO_ALVO' : progressRatio >= 0.8 ? 'QUASE_LA' : progressRatio >= 0.5 ? 'EM_PROGRESSO' : 'ATENCAO'
        const statusLabel =
          status === 'NO_ALVO'
            ? 'No alvo'
            : status === 'QUASE_LA'
              ? 'Quase lá'
              : status === 'EM_PROGRESSO'
                ? 'Em progresso'
                : 'Atenção'
        const statusClass =
          status === 'NO_ALVO'
            ? 'text-emerald-700'
            : status === 'QUASE_LA'
              ? 'text-cyan-700'
              : status === 'EM_PROGRESSO'
                ? 'text-amber-600'
                : 'text-rose-700'

        const focusProduct = productAllowlist.find(
          (product) => normalizeEntityCode(String(product.code ?? '')) === normalizeEntityCode(focusCode)
        )
        const focusProductLabel = String(focusProduct?.description ?? '').trim() || 'Item foco sem descricao'

        return [{
          sellerId,
          focusCode,
          focusProductLabel,
          focusTargetMode,
          focusTargetKg,
          focusTargetBasePct,
          soldKg,
          soldClients,
          requiredBaseClients,
          baseCoveragePct,
          progressPct,
          statusLabel,
          statusClass,
          rank: sellerRankById.get(sellerId) ?? Number.MAX_SAFE_INTEGER,
        }]
      })
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank
        return a.focusProductLabel.localeCompare(b.focusProductLabel, 'pt-BR')
      })
  }, [
    focusProductRows,
    productAllowlist,
    ruleBlocks,
    weightPanelDrilledSellerDetails,
    sellerWeightPerformanceRows,
    snapshots,
  ])

  const weightFocusCodesInScope = useMemo(
    () => Array.from(new Set(weightFocusProgressRows.map((row) => row.focusCode))),
    [weightFocusProgressRows]
  )

  const weightFocusSectionLoading = useMemo(
    () => weightFocusCodesInScope.some((code) => Boolean(focusProductLoading[code])),
    [focusProductLoading, weightFocusCodesInScope]
  )

  const weightFocusSectionErrors = useMemo(
    () => weightFocusCodesInScope.map((code) => focusProductError[code]).filter((msg): msg is string => Boolean(msg && msg.trim())),
    [focusProductError, weightFocusCodesInScope]
  )

  useEffect(() => {
    const leftEl = weightPanelLeftColumnRef.current
    const headerEl = weightRankingHeaderRef.current
    const fallbackHeight = 304
    if (!leftEl || !headerEl) {
      setWeightRankingListMaxHeight((prev) => (prev === fallbackHeight ? prev : fallbackHeight))
      return
    }

    let frameId = 0
    const syncHeights = () => {
      if (frameId) cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const leftHeight = leftEl.getBoundingClientRect().height
        const rightHeaderHeight = headerEl.getBoundingClientRect().height
        const verticalGap = 8 // space-y-2 between header and list
        const measured = leftHeight - rightHeaderHeight - verticalGap
        const next = Number.isFinite(measured) ? Math.max(measured - 1, 180) : fallbackHeight
        setWeightRankingListMaxHeight((prev) => (prev === next ? prev : next))
      })
    }

    syncHeights()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncHeights)
      observer.observe(leftEl)
      observer.observe(headerEl)
    }
    window.addEventListener('resize', syncHeights)

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      observer?.disconnect()
      window.removeEventListener('resize', syncHeights)
    }
  }, [snapshots.length, view, weightOverviewByBrand.length, weightPanelDrilledSellerGroupRows.length, weightPanelView, weightScopedSellerRows.length])

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
    <div className="mx-auto w-full max-w-7xl space-y-4 [&_button:not(:disabled)]:cursor-pointer">
      <Card className="relative border-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl">
        <div className="absolute inset-x-3 top-0 h-0.75 bg-linear-to-r from-primary-500 via-cyan-400 to-emerald-400" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Branding */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Gestão Comercial · Metas</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              {view === 'config'
                ? 'Configurações do Painel de Metas'
                : view === 'sellers'
                ? 'Lista de vendedores liberados'
                : view === 'products'
                ? 'Lista de produtos das metas'
                : 'Painel de Metas — Ouro Verde'}
            </h1>
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
                          onClick={() => {
                            const nextMonth = month === 0 ? 11 : month - 1
                            const nextYear = month === 0 ? year - 1 : year
                            handlePeriodChange(nextYear, nextMonth)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                        >
                          <ChevronLeft size={15} />
                        </button>

                        <div className="flex flex-1 items-center gap-2">
                          <select
                            value={month}
                            onChange={(e) => handleMonthChange(Number(e.target.value))}
                            className="flex-1 rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          >
                            {MONTHS.map((name, idx) => (
                              <option key={name} value={idx}>{name}</option>
                            ))}
                          </select>
                          <select
                            value={year}
                            onChange={(e) => handleYearChange(Number(e.target.value))}
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
                          onClick={() => {
                            const nextMonth = month === 11 ? 0 : month + 1
                            const nextYear = month === 11 ? year + 1 : year
                            handlePeriodChange(nextYear, nextMonth)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date()
                          handlePeriodChange(now.getFullYear(), now.getMonth())
                        }}
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

                {(canViewConfig || canViewSellers || canViewProducts) && (
                  <div className="h-5 w-px bg-white/20" />
                )}

                {canViewConfig && (
                  <button
                    type="button"
                    onClick={() => setView('config')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-500"
                  >
                    <Settings2 size={14} />
                    Configurações
                  </button>
                )}
                {canViewSellers && (
                  <button
                    type="button"
                    onClick={() => setView('sellers')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <Users size={14} />
                    Vendedores
                  </button>
                )}
                {canViewProducts && (
                  <button
                    type="button"
                    onClick={() => setView('products')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    <Boxes size={14} />
                    Produtos
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {view === 'config' ? (
        !canViewConfig ? (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-800">Sem permissão para acessar Configurações de Metas.</p>
            <p className="mt-1 text-xs text-amber-700">Solicite ao Desenvolvedor a liberação em Permissões por cargo.</p>
          </Card>
        ) : (
        <>
          {!canMutateConfig ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Modo somente leitura: sua permissão pode visualizar as configurações, mas não pode editar/salvar/remover dados.
            </div>
          ) : null}

          <fieldset
            disabled={!canMutateConfig}
            className={
              !canMutateConfig
                ? 'opacity-85 [&_button:disabled]:cursor-not-allowed! [&_button:disabled]:border-surface-300! [&_button:disabled]:bg-surface-100! [&_button:disabled]:text-surface-500! [&_button:disabled]:shadow-none!'
                : undefined
            }
          >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${hasPendingConfigChanges ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className={hasPendingConfigChanges ? 'font-semibold text-amber-700' : 'font-medium text-surface-600'}>
                {hasPendingConfigChanges ? 'Alterações pendentes de salvamento' : 'Todas as alterações estão salvas'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveConfigEdits}
              disabled={!canSaveConfig || !hasPendingConfigChanges || isSavingConfig}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
            >
              {isSavingConfig ? 'Salvando...' : 'Salvar edições'}
            </button>
          </div>

          {configSaveError ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{configSaveError}</div> : null}
          {configSaveSuccess ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{configSaveSuccess}</div> : null}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-primary-600" />
                <h2 className="text-base font-semibold text-surface-900">Calendário comercial</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {canMutateConfig ? (
                  <>
                    <label className={label}>
                      Mês
                      <select className={input} value={month} onChange={(event) => handleMonthChange(Number(event.target.value))}>
                        {MONTHS.map((monthName, index) => (
                          <option key={monthName} value={index}>
                            {monthName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      Ano
                      <input
                        className={input}
                        type="number"
                        min={2024}
                        max={2100}
                        value={year}
                        onChange={(event) => handleYearChange(Number(event.target.value))}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className={label}>
                      Mês
                      <div className={`${input} flex items-center justify-between`}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Mês anterior"
                          onClick={() => handleMonthChange(month === 0 ? 11 : month - 1)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleMonthChange(month === 0 ? 11 : month - 1)
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-600 hover:bg-surface-50"
                        >
                          <ChevronLeft size={14} />
                        </div>
                        <span className="text-sm font-semibold normal-case text-surface-900">{MONTHS[month]}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Próximo mês"
                          onClick={() => handleMonthChange(month === 11 ? 0 : month + 1)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleMonthChange(month === 11 ? 0 : month + 1)
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-600 hover:bg-surface-50"
                        >
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                    <div className={label}>
                      Ano
                      <div className={`${input} flex items-center justify-between`}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Ano anterior"
                          onClick={() => handleYearChange(Math.max(2024, year - 1))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleYearChange(Math.max(2024, year - 1))
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-600 hover:bg-surface-50"
                        >
                          <ChevronLeft size={14} />
                        </div>
                        <span className="text-sm font-semibold normal-case text-surface-900">{year}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Próximo ano"
                          onClick={() => handleYearChange(Math.min(2100, year + 1))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleYearChange(Math.min(2100, year + 1))
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-600 hover:bg-surface-50"
                        >
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={includeNational} onChange={(event) => setIncludeNational(event.target.checked)} /> Considerar feriados nacionais oficiais</label>
                <Badge variant="secondary">Dias úteis no mês: {cycle.totalBusinessDays}</Badge>
              </div>

              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Desconsiderar data (Feriados, etc.)</p>
                    <div className="mt-2 flex gap-2">
                      <input type="date" className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customDate) return
                          const list = activeMonth?.customOffDates ?? []
                          if (list.includes(customDate)) return
                          updateActiveMonthConfig({
                            customOffDates: [...list, customDate].sort(),
                          })
                          setCustomDate('')
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {(activeMonth?.customOffDates?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeMonth?.customOffDates.map((date) => (
                          <button
                            key={date}
                            type="button"
                            className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-100"
                            onClick={() =>
                              setConfirmModal({
                                open: true,
                                title: 'Excluir período desconsiderado',
                                message: `Deseja remover a data ${formatDateBr(date)} da lista de períodos desconsiderados? Essa ação não pode ser desfeita.`,
                                confirmLabel: 'Excluir',
                                variant: 'danger',
                                onConfirm: () =>
                                  updateActiveMonthConfig({
                                    customOffDates: (activeMonth?.customOffDates ?? []).filter((item) => item !== date),
                                  }),
                              })
                            }
                          >
                            {formatDateBr(date)} ×
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-surface-200 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Considerar data específica</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-[minmax(220px,1fr)_170px_auto]">
                      <select
                        className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800"
                        value={sellerIncludeSellerId}
                        onChange={(event) => setSellerIncludeSellerId(event.target.value)}
                      >
                        <option value="">Selecionar vendedor</option>
                        {sellers
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                          .map((seller) => (
                            <option key={seller.id} value={seller.id}>
                              {seller.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="date"
                        className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                        value={sellerIncludeDate}
                        min={`${year}-${String(month + 1).padStart(2, '0')}-01`}
                        max={toIsoDate(new Date(year, month + 1, 0))}
                        onChange={(event) => setSellerIncludeDate(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!sellerIncludeSellerId || !sellerIncludeDate) return
                          const seller = sellers.find((item) => item.id === sellerIncludeSellerId)
                          if (!seller) return
                          const list = activeMonth?.sellerIncludedDates ?? []
                          if (list.some((entry) => entry.sellerId === seller.id && entry.date === sellerIncludeDate)) return
                          const next = [
                            ...list,
                            { sellerId: seller.id, sellerName: seller.name, date: sellerIncludeDate },
                          ].sort((a, b) => (a.date === b.date ? a.sellerName.localeCompare(b.sellerName, 'pt-BR') : a.date.localeCompare(b.date)))
                          updateActiveMonthConfig({ sellerIncludedDates: next })
                          setSellerIncludeDate('')
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Plus size={12} /> Incluir
                      </button>
                    </div>

                    {sellerIncludedDateEntries.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sellerIncludedDateEntries.map((entry) => (
                          <button
                            key={`${entry.sellerId}-${entry.date}`}
                            type="button"
                            className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                            onClick={() =>
                              setConfirmModal({
                                open: true,
                                title: 'Excluir data específica',
                                message: `Deseja remover "${entry.sellerName} • ${formatDateBr(entry.date)}"? Essa ação não pode ser desfeita.`,
                                confirmLabel: 'Excluir',
                                variant: 'danger',
                                onConfirm: () =>
                                  updateActiveMonthConfig({
                                    sellerIncludedDates: (activeMonth?.sellerIncludedDates ?? []).filter(
                                      (item) => !(item.sellerId === entry.sellerId && item.date === entry.date)
                                    ),
                                  }),
                              })
                            }
                          >
                            {entry.sellerName} • {formatDateBr(entry.date)} ×
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-surface-500">
                        Sem exceções cadastradas. Use essa área para incluir sábados, domingos ou feriados para vendedores específicos.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Períodos por etapa</p>
                  <p className="text-[11px] text-surface-500">Defina início e fim individualmente para cada semana.</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {OPERATIONAL_STAGE_KEYS.map((stageKey) => {
                    const week = cycle.weeks.find((item) => item.key === stageKey)
                    const period = activeMonth?.weekPeriods?.[stageKey] ?? { start: '', end: '' }
                    const monthStartIso = `${year}-${String(month + 1).padStart(2, '0')}-01`
                    const monthEndIso = toIsoDate(new Date(year, month + 1, 0))
                    const isConfigured = Boolean(period.start && period.end)
                    return (
                      <div key={stageKey} className={`rounded-lg border p-2.5 text-xs ${isConfigured ? 'border-surface-200 bg-white' : 'border-dashed border-surface-300 bg-white/70'}`}>
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${stageColorMap[stageKey]}`} />
                          <p className="font-semibold text-surface-800">{week?.label ?? stageKey}</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                            Início
                            <input
                              type="date"
                              className="mt-1 w-full rounded-md border border-surface-200 bg-white px-2 py-1.5 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/35"
                              min={monthStartIso}
                              max={monthEndIso}
                              value={period.start}
                              onChange={(event) => updateStagePeriod(stageKey, 'start', event.target.value)}
                            />
                          </label>
                          <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                            Fim
                            <input
                              type="date"
                              className="mt-1 w-full rounded-md border border-surface-200 bg-white px-2 py-1.5 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/35"
                              min={period.start || monthStartIso}
                              max={monthEndIso}
                              value={period.end}
                              onChange={(event) => updateStagePeriod(stageKey, 'end', event.target.value)}
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-surface-500">Dias úteis: {week?.businessDays.length ?? 0}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {standby ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{!activeMonth?.week1StartDate ? 'Mês em standby: defina a data de início da 1ª semana para ativar o ciclo.' : `Período selecionado encerrou em ${formatDateBr(cycle.lastBusinessDate)}. O sistema permanece em standby até configurar o início do próximo ciclo.`}</div> : null}
            </Card>

            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2">
                <Building2 size={14} className="text-indigo-600" />
                <h2 className="text-base font-semibold text-surface-900">Escopo de empresas</h2>
              </div>
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: '1', label: 'Empresa 1' },
                    { value: '2', label: 'Empresa 2' },
                    { value: 'all', label: 'Ambas' },
                  ] as { value: CompanyScopeFilter; label: string }[]).map(({ value, label }) => {
                    const active = companyScopeFilter === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCompanyScopeFilter(value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm'
                            : 'border-indigo-200 bg-white/80 text-surface-600 hover:border-indigo-300 hover:text-surface-800'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

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
            </Card>
          </div>

          {/* ── Multi-block KPI system ─────────────────────── */}
          <div className="mt-4 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900">Grupos de parâmetros por vendedor</h2>
            </div>
            <button
              type="button"
              onClick={() => setAddGroupModal({ open: true, search: '', selectedSellerId: '', profileType: 'NOVATO' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <UserPlus size={12} /> Adicionar vendedor
            </button>
          </div>

          {(() => {
            const block = ruleBlocks.find((b) => b.id === selectedBlockId) ?? ruleBlocks[0]
            const activeBlockProfileType = resolveBlockProfileType(block)
            const blockRewardMode = getRewardModeFromProfile(activeBlockProfileType)
            const blockPercentRewardCap = getPercentRewardCap(activeBlockProfileType)
            const updateBlock = (patch: Partial<RuleBlock>) => setRuleBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, ...patch } : b))
            const updateBlockRule = (ruleId: string, patch: Partial<GoalRule>) => updateBlock({ rules: block.rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r) })
            const assignedSellers = sellers.filter((s) => block.sellerIds.includes(s.id))
            const unassignedSellers = sellers.filter((s) => !ruleBlocks.some((b) => b.id !== block.id && b.sellerIds.includes(s.id)) || block.sellerIds.includes(s.id))
            const sellersInBlock = sellers.filter((s) => findBlockForSeller(s.id, ruleBlocks).id === block.id)
            const otherSellerBlocksCount = ruleBlocks.filter((b) => b.id !== block.id && b.sellerIds.length > 0).length
            const otherSellerIdsForKpiApply = Array.from(
              new Set(
                ruleBlocks
                  .filter(
                    (candidate) =>
                      candidate.id !== block.id &&
                      candidate.sellerIds.length > 0 &&
                      resolveBlockProfileType(candidate) === activeBlockProfileType
                  )
                  .flatMap((candidate) => candidate.sellerIds)
              )
            )
            const focusTargetMode = resolveFocusTargetMode(block)
            const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
            const focusTargetBasePct = Math.max(block.focusTargetBasePct ?? 0, 0)
            const hasFocusTarget = focusTargetMode === 'BASE_CLIENTS' ? focusTargetBasePct > 0 : focusTargetKg > 0
            const monthStartIso = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const stageLabelMap = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<StageKey, string>

            function getStageEndIso(stage: StageKey) {
              return cycle.weeks.find((w) => w.key === stage)?.end ?? null
            }

            function getSellerCode(seller: Salesperson) {
              return normalizeEntityCode(seller.id.replace(/^sankhya-/, ''))
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
                        className="fixed z-70 w-96 rounded-xl border border-surface-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
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
                                const sellerSankhyaData = sankhyaTargets.find((t) => t.sellerCode === sellerCode)
                                const resolvedFinancial = (sellerSankhyaData?.financialTarget ?? 0) > 0
                                  ? sellerSankhyaData!.financialTarget
                                  : block.monthlyTarget
                                const monthlyTargetSafe = resolvedFinancial > 0 ? resolvedFinancial : 0
                                const required = parameterNumber > 0 ? monthlyTargetSafe * (parameterNumber / 100) : monthlyTargetSafe
                                const progressPct = required > 0 ? (revenue / required) * 100 : 0
                                title = 'Meta financeira acumulada'
                                lines = [
                                  { label: 'Faturado acumulado', value: currency(revenue) },
                                  { label: 'Meta do Vendedor', value: currency(monthlyTargetSafe) },
                                  { label: 'Meta desta etapa', value: required > 0 ? currency(required) : 'Não definido' },
                                ]
                                resultLabel = 'Atingimento da etapa'
                                resultValue = `${num(progressPct, 2)}%`
                                ok = required > 0 && revenue >= required
                              } else if (kpiType === 'VOLUME') {
                                const requiredGroups = Math.max(Math.floor(parameterNumber), 0)
                                const sellerSankhyaData = sankhyaTargets.find((t) => t.sellerCode === sellerCode)
                                const effectiveWt = (block.weightTargets ?? []).map((wt) => {
                                  if (!wt.brand || !sellerSankhyaData) return wt
                                  const sk = sellerSankhyaData.weightTargets.find((w) => w.brand.toUpperCase() === wt.brand.toUpperCase())
                                  return sk ? { ...wt, targetKg: sk.targetKg } : wt
                                })
                                const ratios = getSellerWeightTargetRatios(effectiveWt, brandWeightRows, sellerCode)
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
                                const totalActiveProducts = productAllowlist.filter((p) => p.active).length
                                const { resolvedItems, clientsPct } = parseDistribuicaoTarget(rule.targetText, totalActiveProducts)
                                const requiredClients = clientsPct > 0 && resolvedBaseClients > 0
                                  ? Math.ceil(resolvedBaseClients * (clientsPct / 100))
                                  : 0
                                const sellerRows = distributionBySellerProduct.get(sellerCode) ?? []
                                const sellerItemsRow = distributionItemsBySeller.get(sellerCode)
                                const soldItemsStage = getDistribuicaoItemsByStage(sellerItemsRow, rule.stage)
                                const clientsWithAnyItems = sellerRows.reduce((sum, row) => {
                                  const productsByStage = getDistribuicaoProductsByStage(row, rule.stage)
                                  return sum + (productsByStage > 0 ? 1 : 0)
                                }, 0)
                                const sellerRowsCount = sellerRows.length
                                const attemptsSummary = (distributionDiagnostics?.attempts ?? [])
                                  .map((item) => `${item.mode}:${item.error ? 'erro' : `${item.rows}/${item.sellerItemsRows ?? 0}`}`)
                                  .join(' | ')
                                title = 'Distribuição por clientes e itens'
                                if (distributionLoading || distributionError) {
                                  const coveragePct = resolvedBaseClients > 0 ? (distinctClientsCum / resolvedBaseClients) * 100 : 0
                                  lines = [
                                    { label: 'Base total de clientes do vendedor', value: `${resolvedBaseClients}` },
                                    { label: 'Parâmetro de base', value: `${num(clientsPct, 2)}%` },
                                    { label: 'Clientes únicos acumulados', value: `${distinctClientsCum}` },
                                    { label: 'Pedidos acumulados na etapa', value: `${orderCountCum}` },
                                    { label: 'Itens alvo resolvidos', value: `${num(resolvedItems, 0)} item(ns)` },
                                    { label: 'Status da distribuição por item', value: distributionLoading ? 'Carregando...' : 'Indisponível (fallback ativo)' },
                                  ]
                                  resultLabel = 'Resultado parcial'
                                  resultValue = `${num(coveragePct, 2)}% base`
                                  ok = false
                                } else {
                                  const itemsGoalOk = resolvedItems > 0 && soldItemsStage >= resolvedItems
                                  const clientsGoalOk = requiredClients > 0 && clientsWithAnyItems >= requiredClients
                                  lines = [
                                    { label: 'Produtos considerados na meta', value: `${totalActiveProducts}` },
                                    { label: 'Meta de itens (SKU únicos)', value: `${num(resolvedItems, 0)} item(ns)` },
                                    { label: 'Itens vendidos no período', value: `${num(soldItemsStage, 0)} item(ns)` },
                                    { label: 'Status itens', value: itemsGoalOk ? 'Conquistado' : 'Ainda não atingiu' },
                                    { label: 'Base total de clientes do vendedor', value: `${resolvedBaseClients}` },
                                    { label: 'Meta de clientes', value: `${requiredClients} (${num(clientsPct, 0)}% da base)` },
                                    { label: 'Clientes atendidos com qualquer SKU da meta', value: `${clientsWithAnyItems}` },
                                    { label: 'Status clientes', value: clientsGoalOk ? 'Conquistado' : 'Ainda não atingiu' },
                                  ]
                                  resultLabel = 'Resultado apurado'
                                  resultValue = `${num(soldItemsStage, 0)}/${num(resolvedItems, 0)} itens · ${num(clientsWithAnyItems, 0)}/${num(requiredClients, 0)} clientes`
                                  ok = resolvedItems > 0 && requiredClients > 0 && soldItemsStage >= resolvedItems && clientsWithAnyItems >= requiredClients
                                }
                              } else if (kpiType === 'ITEM_FOCO') {
                                const { volumePct } = parseItemFocoTarget(rule.targetText)
                                const focusCode = (block.focusProductCode ?? '').trim()
                                const focusRow = focusCode
                                  ? (focusProductRows[focusCode] ?? []).find((row) => row.sellerCode === sellerCode)
                                  : null
                                const soldKg = focusRow?.soldKg ?? 0
                                const soldClients = Number(focusRow?.soldClients ?? 0)
                                const baseTotalClients = resolvedBaseClients
                                const focusMode = resolveFocusTargetMode(block)
                                if (focusMode === 'BASE_CLIENTS') {
                                  const targetBasePct = Math.max(block.focusTargetBasePct ?? 0, 0)
                                  const requiredBaseClients = targetBasePct > 0
                                    ? Math.ceil(baseTotalClients * (targetBasePct / 100))
                                    : 0
                                  const baseCoveragePct = baseTotalClients > 0 ? (soldClients / baseTotalClients) * 100 : 0
                                  title = 'Item foco por base de clientes'
                                  lines = [
                                    { label: 'Critério da meta', value: 'Positivação da base de clientes' },
                                    { label: 'Base total de clientes do vendedor', value: `${baseTotalClients}` },
                                    { label: 'Meta parametrizada', value: `${num(targetBasePct, 2)}%` },
                                    { label: 'Meta de clientes', value: `${requiredBaseClients} cliente(s)` },
                                    { label: 'Clientes com item foco', value: `${soldClients}` },
                                    { label: 'Vendido do item foco (informativo)', value: `${num(soldKg, 2)} kg` },
                                  ]
                                  resultLabel = 'Resultado apurado'
                                  resultValue = requiredBaseClients > 0
                                    ? `${num(soldClients, 0)}/${num(requiredBaseClients, 0)} clientes (${num(baseCoveragePct, 2)}%)`
                                    : `${num(baseCoveragePct, 2)}% base`
                                  ok = requiredBaseClients > 0 && soldClients >= requiredBaseClients
                                } else {
                                  const focusTargetKg = Math.max(block.focusTargetKg ?? 0, 0)
                                  const requiredKg = focusTargetKg * (Math.max(volumePct, 0) / 100)
                                  title = 'Item foco por volume (kg)'
                                  lines = [
                                    { label: 'Critério da meta', value: 'Volume do item foco em kg' },
                                    { label: 'Meta do item foco (kg)', value: `${num(focusTargetKg, 2)} kg` },
                                    { label: 'Percentual mínimo aplicado', value: `${num(Math.max(volumePct, 0), 2)}%` },
                                    { label: 'Volume mínimo exigido', value: `${num(requiredKg, 2)} kg` },
                                    { label: 'Vendido do item foco', value: `${num(soldKg, 2)} kg` },
                                    { label: 'Clientes com item foco (informativo)', value: `${soldClients}` },
                                  ]
                                  resultLabel = 'Resultado apurado'
                                  resultValue = requiredKg > 0
                                    ? `${num(soldKg, 2)}/${num(requiredKg, 2)} kg`
                                    : `${num(soldKg, 2)} kg`
                                  ok = requiredKg > 0 && soldKg >= requiredKg
                                }
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
                    {isEditingBlockTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          className="min-w-64 rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          value={blockTitleDraft}
                          onChange={(e) => setBlockTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const normalized = blockTitleDraft.trim()
                              if (normalized) updateBlock({ title: normalized })
                              setIsEditingBlockTitle(false)
                            }
                            if (e.key === 'Escape') {
                              setIsEditingBlockTitle(false)
                              setBlockTitleDraft(block.title)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const normalized = blockTitleDraft.trim()
                            if (normalized) updateBlock({ title: normalized })
                            setIsEditingBlockTitle(false)
                          }}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingBlockTitle(false)
                            setBlockTitleDraft(block.title)
                          }}
                          className="rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-surface-600 hover:bg-surface-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                            Vendedor/Grupo ativo
                          </span>
                          <div className="relative min-w-72" ref={canMutateConfig ? undefined : readOnlyBlockPickerRef}>
                            {canMutateConfig ? (
                              <>
                                <select
                                  className="w-full appearance-none rounded-xl border border-surface-200 bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-surface-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                  value={selectedBlockId}
                                  onChange={(e) => setSelectedBlockId(e.target.value)}
                                >
                                  {ruleBlocks.map((optionBlock) => (
                                    <option key={optionBlock.id} value={optionBlock.id}>
                                      {stripLegacySellerCounterSuffix(optionBlock.title)}
                                      {` · ${SELLER_PROFILE_LABEL[resolveBlockProfileType(optionBlock)]}`}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
                              </>
                            ) : (
                              <>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setReadOnlyBlockPickerOpen((prev) => !prev)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      setReadOnlyBlockPickerOpen((prev) => !prev)
                                    }
                                  }}
                                  className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-surface-900 shadow-sm transition-all hover:bg-surface-50"
                                >
                                  {(() => {
                                    const selectedOption = ruleBlocks.find((optionBlock) => optionBlock.id === selectedBlockId) ?? block
                                    return `${stripLegacySellerCounterSuffix(selectedOption.title)} · ${SELLER_PROFILE_LABEL[resolveBlockProfileType(selectedOption)]}`
                                  })()}
                                </div>
                                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                {readOnlyBlockPickerOpen ? (
                                  <>
                                    <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl ring-1 ring-black/5">
                                      <ul className="max-h-64 overflow-y-auto py-1">
                                        {ruleBlocks.map((optionBlock) => {
                                          const active = selectedBlockId === optionBlock.id
                                          const label = `${stripLegacySellerCounterSuffix(optionBlock.title)} · ${SELLER_PROFILE_LABEL[resolveBlockProfileType(optionBlock)]}`
                                          return (
                                            <li key={optionBlock.id}>
                                              <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => {
                                                  setSelectedBlockId(optionBlock.id)
                                                  setReadOnlyBlockPickerOpen(false)
                                                }}
                                                onKeyDown={(event) => {
                                                  if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setSelectedBlockId(optionBlock.id)
                                                    setReadOnlyBlockPickerOpen(false)
                                                  }
                                                }}
                                                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                                                  active ? 'bg-primary-50 text-primary-700' : 'text-surface-700 hover:bg-surface-50'
                                                }`}
                                              >
                                                {label}
                                              </div>
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </div>
                                  </>
                                ) : null}
                              </>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          title="Editar nome do vendedor/grupo"
                          onClick={() => {
                            setBlockTitleDraft(block.title)
                            setIsEditingBlockTitle(true)
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-surface-200 bg-white px-3 text-surface-600 shadow-sm transition-all hover:border-surface-300 hover:bg-surface-50 hover:text-primary-700"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                    {block.sellerIds.length === 0 && (
                      <Badge variant="secondary">Grupo padrão — aplica a vendedores não atribuídos</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={otherSellerIdsForKpiApply.length === 0}
                      onClick={() =>
                        setApplyKpiModal({
                          open: true,
                          sourceBlockId: block.id,
                          selectedSellerIds: otherSellerIdsForKpiApply,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Users size={12} /> Aplicar a todos os vendedores
                    </button>
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
                          message: `Deseja excluir o grupo "${block.title}"? Os vendedores atribuídos voltarão ao grupo padrão e essa ação não pode ser desfeita.`,
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
                    <label className={label}>Meta financeira do mês (R$)</label>
                    {(() => {
                      const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                      const blockSellerCodes = block.sellerIds.map((sid) => {
                        const s = sellers.find((x) => x.id === sid)
                        return (s ? s.id : sid).replace(/^sankhya-/, '')
                      })
                      let sankhyaTotal: number | null = null
                      for (const sc of blockSellerCodes) {
                        const sd = sankhyaTargets.find((t) => t.sellerCode === sc)
                        if (sd && sd.financialTarget > 0) sankhyaTotal = (sankhyaTotal ?? 0) + sd.financialTarget
                      }

                      // Helper: get current manual value for this period + determine if it has a future fallback
                      const manualMap = block.manualFinancialByPeriod ?? {}
                      const exactManualVal = manualMap[periodKey] ?? 0
                      const now = new Date()
                      const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                      const isFutureOrCurrent = periodKey >= currentPeriodKey
                      const sortedKeys = Object.keys(manualMap).sort()
                      const fallbackKey = isFutureOrCurrent
                        ? [...sortedKeys].reverse().find((k) => manualMap[k] > 0 && k < periodKey)
                        : undefined
                      const displayVal = exactManualVal > 0 ? exactManualVal : (fallbackKey ? manualMap[fallbackKey] : 0)

                      const saveManual = (val: number) => {
                        updateBlock({ manualFinancialByPeriod: { ...manualMap, [periodKey]: val } })
                      }

                      if (sankhyaTargetsLoading) {
                        return (
                          <div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 text-xs text-surface-400">
                            <span className="animate-pulse">Carregando do Sankhya...</span>
                          </div>
                        )
                      }

                      // Case 1: Sankhya has live data for this period
                      if (sankhyaTotal !== null && sankhyaTotal > 0) {
                        return (
                          <>
                            <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <span className="text-sm font-semibold text-emerald-800">{currency(sankhyaTotal)}</span>
                            </div>
                            <p className="mt-1 text-[10px] text-emerald-700">
                              Coletado automaticamente do Sankhya para {blockSellerCodes.length === 1 ? 'este vendedor' : `${blockSellerCodes.length} vendedores`} neste bloco.
                            </p>
                          </>
                        )
                      }

                      // Case 2: Sankhya not connected — use legacy monthlyTarget
                      if (!sankhyaConnected) {
                        return (
                          <label className={label}>
                            <input
                              className={input}
                              type="number"
                              step="0.01"
                              min="0"
                              value={block.monthlyTarget || ''}
                              onChange={(e) => updateBlock({ monthlyTarget: parseDecimal(e.target.value, 0) })}
                            />
                            <p className="mt-1 text-[10px] text-surface-400">
                              {block.monthlyTarget > 0
                                ? `Cada vendedor neste bloco tem como referência ${currency(block.monthlyTarget)} no mês.`
                                : 'Sem meta financeira configurada — usa a média da equipe como referência.'}
                            </p>
                          </label>
                        )
                      }

                      // Case 3: Sankhya connected but no data for this period — period-specific manual input
                      return (
                        <label className={label}>
                          <input
                            className={`${input}${fallbackKey && exactManualVal === 0 ? ' border-surface-300 bg-surface-50 text-surface-500' : ''}`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            value={exactManualVal || ''}
                            onChange={(e) => saveManual(parseDecimal(e.target.value, 0))}
                          />
                          <p className="mt-1 text-[10px] text-surface-400">
                            {fallbackKey && exactManualVal === 0
                              ? `Usando ${currency(manualMap[fallbackKey])} de ${fallbackKey} como referência — sem meta definida para este período.`
                              : displayVal > 0
                                ? `Manual para ${periodKey}.`
                                : 'Período sem meta no Sankhya — insira manualmente.'}
                          </p>
                        </label>
                      )
                    })()}
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
                              message: `Deseja remover "${s.name}" do grupo "${block.title}"? O vendedor voltará a usar o grupo padrão e essa ação não pode ser desfeita.`,
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
                      {assignedSellers.length === 0 ? (
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
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* KPI rules table */}
                <div className="overflow-x-auto">
                  {blockRewardMode === 'PERCENT' ? (
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                      Perfil percentual: premiação acumulada de 0,00% até {num(blockPercentRewardCap, 2)}%.
                    </p>
                  ) : null}
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">Período</th><th className="px-3 py-2">KPI</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Parâmetro</th><th className="px-3 py-2">{blockRewardMode === 'PERCENT' ? 'Premiação (%)' : 'Premiação'}</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2 w-10"></th>
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
                              const itemFocoMode = resolveFocusTargetMode(block)
                              if (itemFocoMode === 'BASE_CLIENTS') {
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className="rounded bg-primary-50 px-2 py-1 text-[10px] font-semibold text-primary-700">
                                      Meta no card: {num(Math.max(block.focusTargetBasePct ?? 0, 0), 1)}% da base
                                    </span>
                                    {renderKpiInspector(rule, kpiType)}
                                  </div>
                                )
                              }
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="w-14 rounded border border-surface-200 px-1.5 py-1.5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="0"
                                    title="% mínimo aplicado sobre a meta em kg do item foco"
                                    value={parsed.volumePct || ''}
                                    onChange={(e) => updateBlockRule(rule.id, { targetText: formatItemFocoTarget(parseDecimal(e.target.value, 0), parsed.basePct) })}
                                  />
                                  <span className="text-[10px] text-surface-400">% meta kg</span>
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
                          <td className="px-3 py-2">
                            {blockRewardMode === 'PERCENT' ? (
                              <div className="flex items-center gap-1">
                                <input
                                  className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs"
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  max={blockPercentRewardCap}
                                  value={rule.rewardValue}
                                  onChange={(e) => updateBlockRule(rule.id, { rewardValue: parseDecimal(e.target.value, 0) })}
                                />
                                <span className="text-[10px] text-surface-400">%</span>
                              </div>
                            ) : (
                              <input className="w-24 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.01" value={rule.rewardValue} onChange={(e) => updateBlockRule(rule.id, { rewardValue: parseDecimal(e.target.value, 0) })} />
                            )}
                          </td>
                          <td className="px-3 py-2"><input className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.001" value={rule.points} onChange={(e) => updateBlockRule(rule.id, { points: parseDecimal(e.target.value, 0) })} /></td>
                          <td className="px-3 py-2"><button type="button" onClick={() => setConfirmModal({
                            open: true,
                            title: 'Excluir período/KPI',
                            message: `Deseja excluir o KPI "${rule.kpi}" do período "${STAGES.find((s) => s.key === rule.stage)?.label ?? rule.stage}"? Essa ação não pode ser desfeita.`,
                            confirmLabel: 'Excluir',
                            variant: 'danger',
                            onConfirm: () => updateBlock({ rules: block.rules.filter((r) => r.id !== rule.id) }),
                          })} className="rounded p-1 text-surface-400 hover:bg-rose-50 hover:text-rose-600" title="Remover KPI"><span className="text-xs">✕</span></button></td>
                        </tr>
                      ))}
                      <tr className="bg-surface-50 font-semibold">
                        <td className="px-3 py-2 text-xs text-surface-500" colSpan={4}>
                          Totais — {block.rules.length} KPIs
                          {(() => {
                            const blockSellerCodes = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return (s ? s.id : sid).replace(/^sankhya-/, '') })
                            const sankhyaFin = blockSellerCodes.reduce<number | null>((acc, sc) => { const sd = sankhyaTargets.find((t) => t.sellerCode === sc); if (sd && sd.financialTarget > 0) return (acc ?? 0) + sd.financialTarget; return acc }, null)
                            const displayTarget = sankhyaFin ?? (block.monthlyTarget > 0 ? block.monthlyTarget : null)
                            if (!displayTarget) return null
                            return <span className="ml-2 text-emerald-600">| Meta: {currency(displayTarget)}</span>
                          })()}
                          {block.sellerIds.length > 0 && <span className="ml-2 text-primary-600">| {block.sellerIds.length} vendedor(es)</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-surface-700">
                          {(() => {
                            const configuredReward = block.rules.reduce((sum, r) => sum + r.rewardValue, 0)
                            if (blockRewardMode === 'PERCENT') {
                              const exceedsCap = configuredReward > blockPercentRewardCap
                              return `${num(configuredReward, 2)}% de ${num(blockPercentRewardCap, 2)}%${exceedsCap ? ' (limitado ao teto)' : ''}`
                            }
                            return currency(configuredReward)
                          })()}
                        </td>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={otherSellerBlocksCount === 0}
                        onClick={() =>
                          setConfirmModal({
                            open: true,
                            title: 'Aplicar metas de peso a todos',
                            message: `Aplicar os grupos de produto e metas (kg) do bloco "${block.title}" para os outros ${otherSellerBlocksCount} bloco(s) de vendedores em ${MONTHS[month]} ${year}? Essa ação sobrescreve os dados atuais desses blocos no mês selecionado.`,
                            confirmLabel: 'Aplicar a todos',
                            variant: 'primary',
                            onConfirm: () =>
                              setRuleBlocks((prev) =>
                                prev.map((candidate) => {
                                  if (candidate.id === block.id || candidate.sellerIds.length === 0) return candidate
                                  const clonedTargets = (block.weightTargets ?? []).map((wt, index) => ({
                                    ...wt,
                                    id: `wt-${Date.now()}-${candidate.id}-${index}`,
                                  }))
                                  return { ...candidate, weightTargets: clonedTargets }
                                })
                              ),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Users size={11} /> Aplicar a todos os vendedores
                      </button>
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
                      {(() => {
                        // Show sync button only when Sankhya has brands for sellers in this block
                        const blockSellerCodes = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return (s ? s.id : sid).replace(/^sankhya-/, '') })
                        const sankhyaBrands = [...new Set(
                          blockSellerCodes.flatMap((sc) => (sankhyaTargets.find((t) => t.sellerCode === sc)?.weightTargets ?? []).map((w) => w.brand))
                        )]
                        if (sankhyaBrands.length === 0) return null
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              const existing = new Set((block.weightTargets ?? []).map((w) => w.brand.toUpperCase()))
                              const newTargets: WeightTarget[] = sankhyaBrands
                                .filter((brand) => !existing.has(brand.toUpperCase()))
                                .map((brand) => ({ id: `wt-sankhya-${Date.now()}-${brand}`, brand, targetKg: 0 }))
                              if (newTargets.length > 0) updateBlock({ weightTargets: [...(block.weightTargets ?? []), ...newTargets] })
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <RefreshCw size={11} /> Sincronizar grupos do Sankhya
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                  {(!block.weightTargets || block.weightTargets.length === 0) ? (
                    <p className="rounded-lg border border-dashed border-surface-200 bg-surface-50 px-3 py-4 text-center text-xs text-surface-400">
                      Nenhuma meta de peso definida. Clique em &quot;Adicionar grupo&quot; ou &quot;Sincronizar grupos do Sankhya&quot; para configurar.
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
                            // Effective target: Sankhya first, then period-specific manual, then legacy
                            const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                            const sankhyaTargetKg = wt.brand
                              ? sellerCodes.reduce<number | null>((acc, sc) => {
                                  const sd = sankhyaTargets.find((t) => t.sellerCode === sc)
                                  const sw = sd?.weightTargets.find((w) => w.brand.toUpperCase() === wt.brand.toUpperCase())
                                  if (sw) return (acc ?? 0) + sw.targetKg
                                  return acc
                                }, null)
                              : null
                            const manualKg = wt.manualKgByPeriod?.[periodKey] ?? (sankhyaConnected ? 0 : wt.targetKg)
                            const effectiveTargetKg = sankhyaTargetKg ?? manualKg
                            const rawProgress = effectiveTargetKg > 0 ? actualKg / effectiveTargetKg : 0
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
                                  {sankhyaTargetsLoading ? (
                                    <span className="text-surface-400 text-xs animate-pulse">Carregando...</span>
                                  ) : sankhyaTargetKg !== null ? (
                                    <span className="text-xs font-semibold text-surface-800">{num(sankhyaTargetKg, 2)} kg</span>
                                  ) : (() => {
                                    // No Sankhya data — show period-specific manual input
                                    const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                    const manualVal = sankhyaConnected
                                      ? (wt.manualKgByPeriod?.[periodKey] ?? 0)
                                      : wt.targetKg
                                    const saveManual = (val: number) => {
                                      if (sankhyaConnected) {
                                        const updated = (block.weightTargets ?? []).map((x) =>
                                          x.id === wt.id
                                            ? { ...x, manualKgByPeriod: { ...x.manualKgByPeriod, [periodKey]: val } }
                                            : x
                                        )
                                        updateBlock({ weightTargets: updated })
                                      } else {
                                        const updated = (block.weightTargets ?? []).map((x) => x.id === wt.id ? { ...x, targetKg: val } : x)
                                        updateBlock({ weightTargets: updated })
                                      }
                                    }
                                    return (
                                      <input
                                        className="w-32 rounded border border-surface-200 px-2 py-1.5 text-xs"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0"
                                        value={manualVal || ''}
                                        onChange={(e) => saveManual(parseDecimal(e.target.value, 0))}
                                      />
                                    )
                                  })()}
                                </td>
                                <td className="px-3 py-2 text-xs text-surface-700">
                                  {brandWeightLoading ? (
                                    <span className="text-surface-400">Carregando...</span>
                                  ) : brandWeightError ? (
                                    <span className="text-amber-600" title={brandWeightError}>—</span>
                                  ) : (
                                    <span className={actualKg >= effectiveTargetKg && effectiveTargetKg > 0 ? 'font-semibold text-emerald-600' : ''}>
                                      {num(actualKg, 2)} kg
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {effectiveTargetKg > 0 ? (
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
                                    onClick={() => setConfirmModal({
                                      open: true,
                                      title: 'Excluir grupo de produto',
                                      message: `Deseja excluir o grupo "${wt.brand || 'Sem marca'}" das metas de peso? Essa ação não pode ser desfeita.`,
                                      confirmLabel: 'Excluir',
                                      variant: 'danger',
                                      onConfirm: () => {
                                        const updated = (block.weightTargets ?? []).filter((x) => x.id !== wt.id)
                                        updateBlock({ weightTargets: updated })
                                      },
                                    })}
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
                              {(() => {
                                const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                const sc = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '') })
                                const resolveKg = (w: typeof block.weightTargets[0]) => {
                                  const sankhyaKg = w.brand ? sc.reduce<number | null>((acc, c) => { const sd = sankhyaTargets.find((t) => t.sellerCode === c); const sw = sd?.weightTargets.find((ww) => ww.brand.toUpperCase() === w.brand.toUpperCase()); if (sw) return (acc ?? 0) + sw.targetKg; return acc }, null) : null
                                  if (sankhyaKg !== null) return sankhyaKg
                                  return sankhyaConnected ? (w.manualKgByPeriod?.[periodKey] ?? 0) : w.targetKg
                                }
                                const countWithTarget = (block.weightTargets ?? []).filter((w) => resolveKg(w) > 0).length
                                return `Total — ${countWithTarget} metas de peso configuradas`
                              })()}
                            </td>
                            <td className="px-3 py-2 text-xs text-surface-700">
                              {(() => {
                                const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                const sc = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '') })
                                const resolveKg = (w: typeof block.weightTargets[0]) => {
                                  const sankhyaKg = w.brand ? sc.reduce<number | null>((acc, c) => { const sd = sankhyaTargets.find((t) => t.sellerCode === c); const sw = sd?.weightTargets.find((ww) => ww.brand.toUpperCase() === w.brand.toUpperCase()); if (sw) return (acc ?? 0) + sw.targetKg; return acc }, null) : null
                                  if (sankhyaKg !== null) return sankhyaKg
                                  return sankhyaConnected ? (w.manualKgByPeriod?.[periodKey] ?? 0) : w.targetKg
                                }
                                const total = (block.weightTargets ?? []).reduce((sum, w) => sum + resolveKg(w), 0)
                                return <>{num(total, 2)} kg</>
                              })()}
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
                                const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                const sc = block.sellerIds.map((sid) => { const s = sellers.find((x) => x.id === sid); return s ? s.id.replace(/^sankhya-/, '') : sid.replace(/^sankhya-/, '') })
                                const resolveKg = (w: typeof block.weightTargets[0]) => {
                                  const sankhyaKg = w.brand ? sc.reduce<number | null>((acc, c) => { const sd = sankhyaTargets.find((t) => t.sellerCode === c); const sw = sd?.weightTargets.find((ww) => ww.brand.toUpperCase() === w.brand.toUpperCase()); if (sw) return (acc ?? 0) + sw.targetKg; return acc }, null) : null
                                  if (sankhyaKg !== null) return sankhyaKg
                                  return sankhyaConnected ? (w.manualKgByPeriod?.[periodKey] ?? 0) : w.targetKg
                                }
                                const totalTarget = (block.weightTargets ?? []).reduce((sum, w) => sum + resolveKg(w), 0)
                                const totalActual = (block.weightTargets ?? []).reduce((sum, wt) => sum + brandWeightRows.filter((r) => wt.brand && r.brand === wt.brand.toUpperCase() && (sc.length === 0 || sc.some((c) => r.sellerCode === c))).reduce((s2, r) => s2 + r.totalKg, 0), 0)
                                if (totalTarget <= 0) return <span className="text-surface-400">—</span>
                                const pct = totalActual / totalTarget * 100
                                if (pct >= 100) return <span className="font-semibold text-emerald-600">+{num(pct - 100, 1)}% acima da meta ↑</span>
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
                    <button
                      type="button"
                      disabled={otherSellerBlocksCount === 0}
                      onClick={() =>
                        setConfirmModal({
                          open: true,
                          title: 'Aplicar item foco a todos',
                          message: `Aplicar o item foco e o critério da meta (${focusTargetMode === 'BASE_CLIENTS' ? `${num(focusTargetBasePct, 2)}% da base de clientes` : `${num(focusTargetKg, 2)} kg`}) do bloco "${block.title}" para os outros ${otherSellerBlocksCount} bloco(s) de vendedores em ${MONTHS[month]} ${year}? Essa ação sobrescreve o item foco atual dos demais blocos no mês selecionado.`,
                          confirmLabel: 'Aplicar a todos',
                          variant: 'primary',
                          onConfirm: () =>
                            setRuleBlocks((prev) =>
                              prev.map((candidate) => {
                                if (candidate.id === block.id || candidate.sellerIds.length === 0) return candidate
                                return {
                                  ...candidate,
                                  focusProductCode: block.focusProductCode ?? '',
                                  focusTargetKg: block.focusTargetKg ?? 0,
                                  focusTargetMode,
                                  focusTargetBasePct,
                                }
                              })
                            ),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Users size={11} /> Aplicar a todos os vendedores
                    </button>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-surface-200 bg-surface-50 p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr] md:items-end">
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
                      Critério da meta
                      <select
                        className={input}
                        value={focusTargetMode}
                        onChange={(e) => updateBlock({ focusTargetMode: e.target.value as FocusTargetMode })}
                      >
                        <option value="KG">Meta do item (kg)</option>
                        <option value="BASE_CLIENTS">% da base de clientes</option>
                      </select>
                    </label>
                    <label className={label}>
                      {focusTargetMode === 'BASE_CLIENTS' ? 'Meta da base de clientes (%)' : 'Meta do item (kg)'}
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={focusTargetMode === 'BASE_CLIENTS' ? (block.focusTargetBasePct ?? '') : (block.focusTargetKg ?? '')}
                        onChange={(e) =>
                          updateBlock(
                            focusTargetMode === 'BASE_CLIENTS'
                              ? { focusTargetBasePct: parseDecimal(e.target.value, 0) }
                              : { focusTargetKg: parseDecimal(e.target.value, 0) }
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    {(!block.focusProductCode || !hasFocusTarget) ? (
                      <p className="rounded-lg border border-dashed border-surface-200 bg-white px-3 py-4 text-center text-xs text-surface-400">
                        {focusTargetMode === 'BASE_CLIENTS'
                          ? 'Selecione um produto da lista e defina a meta de base (%) para acompanhar o item foco por vendedor.'
                          : 'Selecione um produto da lista e defina a meta (kg) para acompanhar o item foco por vendedor.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-surface-200 text-sm">
                          <thead>
                            <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Item foco</th>
                              <th className="px-3 py-2">{focusTargetMode === 'BASE_CLIENTS' ? 'Meta da base' : 'Meta (kg)'}</th>
                              <th className="px-3 py-2">{focusTargetMode === 'BASE_CLIENTS' ? 'Clientes com item foco' : 'Vendido (kg)'}</th>
                              <th className="px-3 py-2">Base total (clientes)</th>
                              <th className="px-3 py-2">{focusTargetMode === 'BASE_CLIENTS' ? 'Status da meta' : 'Positivação da base'}</th>
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
                              const targetBasePct = Math.max(block.focusTargetBasePct ?? 0, 0)
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
                              const requiredBaseClients = targetBasePct > 0 ? Math.ceil(baseTotalClients * (targetBasePct / 100)) : 0
                              const baseCoveragePct = baseTotalClients > 0 ? (soldClients / baseTotalClients) * 100 : 0
                              const baseOk = requiredBaseClients > 0 ? soldClients >= requiredBaseClients : false
                              const statusColor = focusTargetMode === 'BASE_CLIENTS'
                                ? (baseOk ? 'text-emerald-700' : 'text-rose-700')
                                : 'text-surface-700'
                              const sku = focusProduct?.code ?? focusCode
                              const itemNome = focusProduct?.description ?? 'Item não encontrado na lista'

                              return (
                                <tr key={`focus-item-${focusCode}`} className="hover:bg-surface-50/50">
                                  <td className="px-3 py-2 text-xs font-semibold text-surface-800">{sku || '—'}</td>
                                  <td className="px-3 py-2 text-xs text-surface-700">{itemNome}</td>
                                  {focusTargetMode === 'BASE_CLIENTS' ? (
                                    <>
                                      <td className="px-3 py-2 text-xs text-surface-700">
                                        {num(targetBasePct, 2)}%
                                        <div className="text-[10px] text-surface-500">
                                          meta: {requiredBaseClients} cliente(s)
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-surface-700">
                                        <div className="font-medium">{num(soldClients, 0)} cliente(s)</div>
                                        <div className="text-[10px] text-surface-500">
                                          vendido: {num(soldKg, 2)} kg (informativo)
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-3 py-2 text-xs text-surface-700">{num(targetKg, 2)} kg</td>
                                      <td className="px-3 py-2 text-xs text-surface-700">
                                        <div className="font-medium">{num(soldKg, 2)} kg</div>
                                        {itemFocoParams.volumePct > 0 ? (
                                          <div className={`text-[10px] ${volumeOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            mínimo {num(itemFocoParams.volumePct, 0)}% = {num(volumeRequiredKg, 2)} kg
                                          </div>
                                        ) : null}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-3 py-2 text-xs text-surface-700">{baseTotalClients}</td>
                                  <td className={`px-3 py-2 text-xs font-semibold ${statusColor}`}>
                                    {focusTargetMode === 'BASE_CLIENTS' ? (
                                      <>
                                        {baseOk ? 'Conquistado' : 'Ainda não atingiu'}
                                        <span className="ml-1 text-[10px] font-medium text-surface-500">
                                          ({num(baseCoveragePct, 1)}% da base)
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        {num(baseCoveragePct, 1)}%
                                        {requiredBaseClients > 0 ? (
                                          <span className="ml-1 text-[10px] font-medium text-surface-500">
                                            ({num(soldClients, 0)}/{requiredBaseClients} clientes)
                                          </span>
                                        ) : null}
                                      </>
                                    )}
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
          </fieldset>
        </>
        )
      ) : view === 'sellers' ? (
        !canViewSellers ? (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-800">Sem permissão para acessar Vendedores de Metas.</p>
            <p className="mt-1 text-xs text-amber-700">Solicite ao Desenvolvedor a liberação em Permissões por cargo.</p>
          </Card>
        ) : (
        <>
          {!canMutateSellers ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Modo somente leitura: sua permissão pode visualizar a tela de vendedores, mas não pode editar/salvar/remover.
            </div>
          ) : null}
          <fieldset
            disabled={!canMutateSellers}
            className={
              !canMutateSellers
                ? 'opacity-85 [&_button:disabled]:cursor-not-allowed! [&_button:disabled]:border-surface-300! [&_button:disabled]:bg-surface-100! [&_button:disabled]:text-surface-500! [&_button:disabled]:shadow-none!'
                : undefined
            }
          >
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
                  disabled={!canSaveSellers || allowlistSyncing}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {allowlistSyncing ? 'Sincronizando...' : 'Sincronizar Sankhya'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddAllowlistModal({ open: true, search: '', selectedSellerId: '', profileType: 'NOVATO' })}
                  disabled={!canEditSellers}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
                >
                  <Plus size={12} /> Adicionar vendedor
                </button>
                <button
                  type="button"
                  onClick={saveAllowlist}
                  disabled={!canSaveSellers || allowlistSaving}
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

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      Liberados: {sellerAllowlistStats.active}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                      Não liberados: {sellerAllowlistStats.inactive}
                    </span>
                    <span className="rounded-full border border-surface-200 bg-white px-2.5 py-1 font-medium text-surface-600">
                      Exibindo: {filteredSellerAllowlist.length} de {sellerAllowlistStats.total}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={sellerAllowlistStats.inactive === 0 && !allowlistShowOnlyInactive}
                    onClick={() => setAllowlistShowOnlyInactive((prev) => !prev)}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      allowlistShowOnlyInactive
                        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-surface-300 bg-white text-surface-700 hover:bg-surface-100'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {allowlistShowOnlyInactive ? 'Mostrar todos' : 'Ver somente não liberados'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">Ativo</th>
                        <th className="px-3 py-2">Nome do vendedor</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Supervisão</th>
                        <th className="px-3 py-2">Código vendedor</th>
                        <th className="px-3 py-2">Código parceiro</th>
                        <th className="px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {filteredSellerAllowlist.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-surface-500" colSpan={7}>
                            {allowlistShowOnlyInactive
                              ? 'Nenhum vendedor não liberado encontrado.'
                              : 'Nenhum vendedor encontrado.'}
                          </td>
                        </tr>
                      ) : (
                        filteredSellerAllowlist.map(({ seller, index }) => (
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
                              <select
                                className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                value={normalizeSellerProfileType(seller.profileType)}
                                onChange={(event) =>
                                  setAllowlist((prev) =>
                                    prev.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? (() => {
                                          const nextProfile = normalizeSellerProfileType(event.target.value)
                                          return {
                                            ...item,
                                            profileType: nextProfile,
                                            supervisorCode: nextProfile === 'SUPERVISOR' ? null : item.supervisorCode ?? null,
                                            supervisorName: nextProfile === 'SUPERVISOR' ? null : item.supervisorName ?? null,
                                          }
                                        })()
                                        : item
                                    )
                                  )
                                }
                              >
                                {SELLER_PROFILE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              {normalizeSellerProfileType(seller.profileType) === 'SUPERVISOR' ? (
                                <span className="text-xs text-surface-400">—</span>
                              ) : (
                                <select
                                  className="min-w-44 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                  value={
                                    String(seller.supervisorCode ?? '').trim() ||
                                    (String(seller.supervisorName ?? '').trim() ? `name:${normalizeSellerNameForLookup(String(seller.supervisorName ?? ''))}` : '')
                                  }
                                  onChange={(event) => {
                                    const selectedKey = event.target.value
                                    setAllowlist((prev) =>
                                      prev.map((item, itemIndex) => {
                                        if (itemIndex !== index) return item
                                        if (!selectedKey) {
                                          return { ...item, supervisorCode: null, supervisorName: null }
                                        }
                                        const selectedSupervisor = supervisorAllowlistOptions.find((option) => option.key === selectedKey || String(option.code ?? '') === selectedKey)
                                        return {
                                          ...item,
                                          supervisorCode: selectedSupervisor?.code ?? null,
                                          supervisorName: selectedSupervisor?.name ?? null,
                                        }
                                      })
                                    )
                                  }}
                                >
                                  <option value="">Sem supervisor</option>
                                  {supervisorAllowlistOptions
                                    .filter((option) => {
                                      const thisCode = String(seller.code ?? '').trim()
                                      const optionCode = String(option.code ?? '').trim()
                                      if (thisCode && optionCode && thisCode === optionCode) return false
                                      return normalizeSellerNameForLookup(option.name) !== normalizeSellerNameForLookup(seller.name)
                                    })
                                    .map((option) => (
                                      <option key={`seller-supervisor-${index}-${option.key}`} value={option.code ?? option.key}>
                                        {option.name}
                                      </option>
                                    ))}
                                </select>
                              )}
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
                                disabled={!canRemoveSellers}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-surface-500">
                  Critério de correspondência: código de vendedor, código de parceiro ou nome (normalizado).
                </p>
              </div>
            )}
          </Card>
          </fieldset>
        </>
        )
      ) : view === 'products' ? (
        !canViewProducts ? (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-800">Sem permissão para acessar Produtos de Metas.</p>
            <p className="mt-1 text-xs text-amber-700">Solicite ao Desenvolvedor a liberação em Permissões por cargo.</p>
          </Card>
        ) : (
        <>
          {!canMutateProducts ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Modo somente leitura: sua permissão pode visualizar a tela de produtos, mas não pode editar/salvar/remover.
            </div>
          ) : null}
          <fieldset
            disabled={!canMutateProducts}
            className={
              !canMutateProducts
                ? 'opacity-85 [&_button:disabled]:cursor-not-allowed! [&_button:disabled]:border-surface-300! [&_button:disabled]:bg-surface-100! [&_button:disabled]:text-surface-500! [&_button:disabled]:shadow-none!'
                : undefined
            }
          >
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
                  disabled={!canSaveProducts || productAllowlistSyncing}
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
                  disabled={!canEditProducts}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
                >
                  <Plus size={12} /> Adicionar produto
                </button>
                <button
                  type="button"
                  onClick={saveProductAllowlist}
                  disabled={!canSaveProducts || productAllowlistSaving}
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
                    Filtro por grupo/categoria
                    <input
                      className={input}
                      value={productBrandFilter}
                      onChange={(event) => setProductBrandFilter(event.target.value)}
                      placeholder="Ex.: GRAOS"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      Liberados: {productAllowlistStats.active}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                      Não liberados: {productAllowlistStats.inactive}
                    </span>
                    <span className="rounded-full border border-surface-200 bg-white px-2.5 py-1 font-medium text-surface-600">
                      Exibindo: {filteredProductAllowlist.length} de {productAllowlistStats.total}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={productAllowlistStats.inactive === 0 && !productShowOnlyInactive}
                    onClick={() => setProductShowOnlyInactive((prev) => !prev)}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      productShowOnlyInactive
                        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-surface-300 bg-white text-surface-700 hover:bg-surface-100'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {productShowOnlyInactive ? 'Mostrar todos' : 'Ver somente não liberados'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-surface-200 text-sm">
                    <thead>
                      <tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('active')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Ativo
                            {productSort.key === 'active' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('code')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Código
                            {productSort.key === 'code' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('description')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Descrição
                            {productSort.key === 'description' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('brand')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Grupo
                            {productSort.key === 'brand' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('unit')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Unidade padrão
                            {productSort.key === 'unit' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProductSort('mobility')}
                            className="inline-flex items-center gap-1.5 hover:text-surface-700"
                          >
                            Mobilidade
                            {productSort.key === 'mobility' ? (
                              productSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-surface-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {sortedProductAllowlist.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-surface-500" colSpan={7}>
                            {productShowOnlyInactive
                              ? 'Nenhum produto não liberado encontrado com os filtros atuais.'
                              : 'Nenhum produto encontrado com os filtros atuais.'}
                          </td>
                        </tr>
                      ) : (
                        sortedProductAllowlist.map((product, index) => (
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
                                disabled={!canRemoveProducts}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-surface-500">
                  Filtros corporativos aplicados na sincronização: Mobilidade = SIM, e grupos permitidos: CAFÉS, COLORÍFICOS/TEMPEROS, GRÃOS, RAÇÃO PASSAROS, RAÇÃO PET - CACHORRO e RAÇÃO PET - GATO.
                </p>
              </div>
            )}
          </Card>
          </fieldset>
        </>
        )
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
                  {corporateWeightTargetPerSeller > 0 ? (
                    <>
                      <p className="mt-1 text-2xl font-semibold text-surface-700">{num(corporateWeightTargetPerSeller, 2)} kg</p>
                      <p className="mt-1 text-[10px] text-surface-400">Soma das metas individuais dos vendedores</p>
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
                    corporateWeightTargetPerSeller > 0 && corporateTotalGrossWeight >= corporateWeightTargetPerSeller
                      ? 'text-emerald-600'
                      : 'text-surface-900'
                  }`}>{num(corporateTotalGrossWeight, 2)} kg</p>
                  {corporateWeightTargetPerSeller > 0 ? (
                    <p className="mt-1 text-[10px] text-surface-400">
                      {num(Math.min(corporateTotalGrossWeight / corporateWeightTargetPerSeller * 100, 999), 1)}% da meta de peso
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                    Metas de peso por grupo de produto
                  </p>
                  <p className="mt-0.5 text-[10px] text-surface-400">Visão geral, por vendedor e por supervisor — {MONTHS[month]} {year}</p>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-surface-200 bg-white text-[10px] font-semibold uppercase tracking-widest text-surface-500">
                  <button
                    type="button"
                    className={`px-3 py-1.5 transition-colors ${weightPanelView === 'GENERAL' ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-surface-50'}`}
                    onClick={() => setWeightPanelView('GENERAL')}
                  >
                    Visão geral
                  </button>
                  <button
                    type="button"
                    className={`border-l border-surface-200 px-3 py-1.5 transition-colors ${weightPanelView === 'SELLER' ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-surface-50'}`}
                    onClick={() => setWeightPanelView('SELLER')}
                  >
                    Por vendedor
                  </button>
                  <button
                    type="button"
                    className={`border-l border-surface-200 px-3 py-1.5 transition-colors ${weightPanelView === 'SUPERVISOR' ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-surface-50'}`}
                    onClick={() => {
                      setWeightPanelView('SUPERVISOR')
                      setWeightPanelSellerId('')
                    }}
                  >
                    Por supervisor
                  </button>
                </div>
              </div>

              {(brandWeightLoading || sankhyaTargetsLoading) && (
                <p className="mt-3 text-[10px] text-surface-400">Atualizando metas de peso e vendidos por grupo…</p>
              )}

              {(brandWeightError || sankhyaTargetsError) && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  {brandWeightError || sankhyaTargetsError}
                </div>
              )}

              {snapshots.length === 0 ? (
                <p className="py-8 text-center text-xs text-surface-400">Aguardando dados de vendedores…</p>
              ) : !hasAnyWeightGoals ? (
                <p className="py-8 text-center text-xs text-surface-400">Nenhuma meta de peso configurada para o período.</p>
              ) : (
                <div key={weightPanelView} className="mt-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Meta total (kg)</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-surface-900">{num(weightExecutiveSummary.totalTargetKg, 2)} kg</p>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Vendido (kg)</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-surface-900">{num(weightExecutiveSummary.totalSoldKg, 2)} kg</p>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Atingimento geral</p>
                      <p className={`mt-1 text-lg font-semibold tabular-nums ${
                        weightExecutiveSummary.overallRatio >= 1
                          ? 'text-emerald-600'
                          : weightExecutiveSummary.overallRatio >= 0.8
                            ? 'text-cyan-600'
                            : weightExecutiveSummary.overallRatio >= 0.5
                              ? 'text-amber-500'
                              : 'text-rose-600'
                      }`}>{num(weightExecutiveSummary.overallRatio * 100, 1)}%</p>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Grupos no alvo</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-surface-900">
                        {weightExecutiveSummary.hitGroups}/{weightExecutiveSummary.totalGroups}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.9fr_1.1fr]">
                    <div ref={weightPanelLeftColumnRef} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2.5">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700">
                          {weightPanelView === 'SUPERVISOR' ? 'Supervisor' : 'Vendedor'}
                        </label>
                        <select
                          className="min-w-56 rounded-lg border border-cyan-200 bg-white px-2 py-1 text-sm text-surface-800"
                          value={
                            weightPanelView === 'GENERAL'
                              ? '__ALL__'
                              : weightPanelView === 'SUPERVISOR'
                                ? weightPanelSupervisorKey
                                : weightPanelSellerId
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value
                            if (weightPanelView === 'SUPERVISOR') {
                              setWeightPanelSupervisorKey(nextValue)
                              setWeightPanelSellerId('')
                              return
                            }
                            if (nextValue === '__ALL__') {
                              setWeightPanelView('GENERAL')
                              return
                            }
                            setWeightPanelSellerId(nextValue)
                            setWeightPanelView('SELLER')
                          }}
                        >
                          {weightPanelView === 'SUPERVISOR' ? (
                            <>
                              {weightSupervisorOptions.length === 0 ? (
                                <option value="">Nenhum supervisor com vendedores vinculados</option>
                              ) : (
                                weightSupervisorOptions.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.name}
                                  </option>
                                ))
                              )}
                            </>
                          ) : (
                            <>
                              <option value="__ALL__">Todos</option>
                              {sellerWeightPerformanceRows.map((row) => (
                                <option key={row.sellerId} value={row.sellerId}>
                                  {row.sellerShortName} · {num(row.overallRatio * 100, 1)}%
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                        {weightPanelView === 'GENERAL' ? (
                          <span className="text-[10px] text-cyan-700">
                            {weightExecutiveSummary.hitGroups}/{weightExecutiveSummary.totalGroups} grupos no alvo
                          </span>
                        ) : weightPanelView === 'SELLER' ? (
                          selectedWeightSellerDetails && (
                            <span className="text-[10px] text-cyan-700">
                              {selectedWeightSellerDetails.groupsHit}/{selectedWeightSellerDetails.groupsConfigured} grupos no alvo
                            </span>
                          )
                        ) : null}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-surface-200">
                        <div className="overflow-x-auto">
                          {!weightPanelDrilledSellerDetails ? (
                            <table className="min-w-full text-xs">
                              <thead className="bg-surface-50 text-[10px] uppercase tracking-widest text-surface-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">Grupo</th>
                                  <th className="px-3 py-2 text-right">Meta (kg)</th>
                                  <th className="px-3 py-2 text-right">Vendido (kg)</th>
                                  <th className="px-3 py-2 text-left">Progresso</th>
                                  <th className="px-3 py-2 text-right">No alvo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weightOverviewByBrand.length === 0 ? (
                                  <tr className="border-t border-surface-100">
                                    <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-surface-400">
                                      Nenhum grupo de produto com meta de peso ativa neste período.
                                    </td>
                                  </tr>
                                ) : (
                                  weightOverviewByBrand.map((row) => {
                                    const progressPct = row.ratio * 100
                                    const barPct = Math.min(progressPct, 100)
                                    const progressClass =
                                      row.ratio >= 1 ? 'bg-emerald-500' : row.ratio >= 0.8 ? 'bg-cyan-500' : row.ratio >= 0.5 ? 'bg-amber-400' : 'bg-rose-500'
                                    const textClass =
                                      row.ratio >= 1 ? 'text-emerald-600' : row.ratio >= 0.8 ? 'text-cyan-600' : row.ratio >= 0.5 ? 'text-amber-500' : 'text-rose-600'
                                    return (
                                      <tr key={row.brand} className="border-t border-surface-100">
                                        <td className="px-3 py-2.5 font-semibold text-surface-700">{row.brand}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-700">{num(row.targetKg, 2)}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-900">{num(row.soldKg, 2)}</td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-full max-w-44 overflow-hidden rounded-full bg-surface-100">
                                              <div className={`h-full transition-[width] duration-700 ${progressClass}`} style={{ width: `${barPct}%` }} />
                                            </div>
                                            <span className={`text-[11px] font-semibold tabular-nums ${textClass}`}>
                                              {num(progressPct, 1)}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-surface-600">
                                          {row.hitSellers}/{row.sellerCount}
                                        </td>
                                      </tr>
                                    )
                                  })
                                )}
                              </tbody>
                            </table>
                          ) : (
                            <table className="min-w-full text-xs">
                              <thead className="bg-surface-50 text-[10px] uppercase tracking-widest text-surface-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">Grupo</th>
                                  <th className="px-3 py-2 text-right">Meta (kg)</th>
                                  <th className="px-3 py-2 text-right">Vendido (kg)</th>
                                  <th className="px-3 py-2 text-left">Progresso</th>
                                  <th className="px-3 py-2 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weightPanelDrilledSellerGroupRows.length === 0 ? (
                                  <tr className="border-t border-surface-100">
                                    <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-surface-400">
                                      Vendedor sem grupos de meta de peso configurados neste período.
                                    </td>
                                  </tr>
                                ) : (
                                  weightPanelDrilledSellerGroupRows.map((row) => {
                                    const progressPct = row.ratio * 100
                                    const barPct = Math.min(progressPct, 100)
                                    const progressClass =
                                      row.ratio >= 1 ? 'bg-emerald-500' : row.ratio >= 0.8 ? 'bg-cyan-500' : row.ratio >= 0.5 ? 'bg-amber-400' : 'bg-rose-500'
                                    const textClass =
                                      row.ratio >= 1 ? 'text-emerald-600' : row.ratio >= 0.8 ? 'text-cyan-600' : row.ratio >= 0.5 ? 'text-amber-500' : 'text-rose-600'
                                    return (
                                      <tr key={row.brand} className="border-t border-surface-100">
                                        <td className="px-3 py-2.5 font-semibold text-surface-700">{row.brand}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-700">{num(row.targetKg, 2)}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-900">{num(row.soldKg, 2)}</td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-full max-w-44 overflow-hidden rounded-full bg-surface-100">
                                              <div className={`h-full transition-[width] duration-700 ${progressClass}`} style={{ width: `${barPct}%` }} />
                                            </div>
                                            <span className={`text-[11px] font-semibold tabular-nums ${textClass}`}>
                                              {num(progressPct, 1)}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className={`px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide ${
                                          row.ratio >= 1 ? 'text-emerald-600' : row.ratio >= 0.8 ? 'text-cyan-600' : row.ratio >= 0.5 ? 'text-amber-500' : 'text-rose-600'
                                        }`}>
                                          {row.ratio >= 1 ? 'No alvo' : row.ratio >= 0.8 ? 'Quase lá' : row.ratio >= 0.5 ? 'Em progresso' : 'Atenção'}
                                        </td>
                                      </tr>
                                    )
                                  })
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div ref={weightRankingHeaderRef}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-500">Progresso por vendedor</p>
                      </div>
                      <div
                        ref={weightRankingListRef}
                        className="flex flex-col gap-2 overflow-y-auto pr-1"
                        style={{ maxHeight: `${Math.max(weightRankingListMaxHeight ?? 304, 180)}px` }}
                      >
                        {weightScopedSellerRows.length === 0 ? (
                          <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-center text-[11px] text-surface-500">
                            {weightPanelView === 'SUPERVISOR'
                              ? 'Nenhum vendedor ativo encontrado para o supervisor selecionado.'
                              : 'Nenhum vendedor encontrado no período.'}
                          </div>
                        ) : (
                          weightScopedSellerRows.map((row, index) => {
                            const progressPct = row.overallRatio * 100
                            const barPct = Math.min(progressPct, 100)
                            const isSelected =
                              (weightPanelView === 'SELLER' && selectedWeightSellerDetails?.sellerId === row.sellerId) ||
                              (weightPanelView === 'SUPERVISOR' && selectedWeightSupervisorSellerDetails?.sellerId === row.sellerId)
                            const barClass =
                              row.overallRatio >= 1 ? 'bg-emerald-500' : row.overallRatio >= 0.8 ? 'bg-cyan-500' : row.overallRatio >= 0.5 ? 'bg-amber-400' : 'bg-rose-500'
                            return (
                              <button
                                key={row.sellerId}
                                type="button"
                                className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                                  isSelected
                                    ? 'border-cyan-300 bg-cyan-50 shadow-sm'
                                    : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-sm'
                                }`}
                                onClick={() => {
                                  setWeightPanelSellerId(row.sellerId)
                                  if (weightPanelView !== 'SUPERVISOR') setWeightPanelView('SELLER')
                                }}
                              >
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <span className="truncate text-[11px] font-semibold text-surface-700">{row.sellerShortName}</span>
                                  <span className="text-[10px] text-surface-400">#{index + 1}</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                                  <div className={`h-full transition-[width] duration-700 ${barClass}`} style={{ width: `${barPct}%` }} />
                                </div>
                                <div className="mt-1.5 flex items-center justify-between text-[10px] text-surface-500">
                                  <span>{row.groupsHit}/{row.groupsConfigured} grupos</span>
                                  <span className="font-semibold tabular-nums text-surface-700">{num(progressPct, 1)}%</span>
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {(weightPanelView === 'SELLER' || (weightPanelView === 'SUPERVISOR' && Boolean(selectedWeightSupervisorSellerDetails))) && (
                    <>
                      {weightFocusSectionLoading ? (
                        <p className="px-1 py-1 text-[11px] text-surface-500">Carregando progresso de item foco...</p>
                      ) : weightFocusSectionErrors.length > 0 ? (
                        <div className="space-y-1 px-1 py-1">
                          {weightFocusSectionErrors.map((message, index) => (
                            <p key={`focus-error-${index}`} className="text-[11px] text-rose-700">{message}</p>
                          ))}
                        </div>
                      ) : weightFocusProgressRows.length === 0 ? (
                        <p className="px-1 py-2 text-center text-xs text-surface-400">
                          Item foco nao definido para o vendedor selecionado.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {weightFocusProgressRows.map((row) => {
                            const progressRatio = Math.max(row.progressPct / 100, 0)
                            const barPct = Math.min(row.progressPct, 100)
                            const progressClass =
                              progressRatio >= 1 ? 'bg-emerald-500' : progressRatio >= 0.8 ? 'bg-cyan-500' : progressRatio >= 0.5 ? 'bg-amber-400' : 'bg-rose-500'
                            const metaLabel = row.focusTargetMode === 'BASE_CLIENTS'
                              ? `${num(row.focusTargetBasePct, 1)}% da base (${row.requiredBaseClients} clientes)`
                              : `${num(row.focusTargetKg, 2)} kg`
                            const realizedLabel = row.focusTargetMode === 'BASE_CLIENTS'
                              ? `${num(row.soldClients, 0)} clientes (${num(row.baseCoveragePct, 1)}%)`
                              : `${num(row.soldKg, 2)} kg`
                            return (
                              <div key={`focus-compact-${row.sellerId}`} className="rounded-lg border border-surface-200 bg-surface-50/50 px-4 py-2.5">
                                <div className="grid gap-y-1 text-[10px] font-semibold uppercase tracking-widest text-surface-400 md:grid-cols-[minmax(240px,2.1fr)_minmax(210px,1.35fr)_minmax(210px,1.35fr)_minmax(250px,1.7fr)_minmax(120px,0.95fr)] md:items-center md:gap-x-2.5">
                                  <span>Item foco</span>
                                  <span>Meta</span>
                                  <span>Realizado</span>
                                  <span>Progresso</span>
                                  <span className="text-right">Status</span>
                                </div>
                                <div className="mt-1.5 grid gap-y-2 md:grid-cols-[minmax(240px,2.1fr)_minmax(210px,1.35fr)_minmax(210px,1.35fr)_minmax(250px,1.7fr)_minmax(120px,0.95fr)] md:items-center md:gap-x-2.5">
                                  <p className="truncate whitespace-nowrap text-sm font-semibold leading-snug text-surface-800">{row.focusProductLabel}</p>
                                  <p className="truncate whitespace-nowrap text-sm font-semibold tabular-nums leading-snug text-surface-700">{metaLabel}</p>
                                  <p className="truncate whitespace-nowrap text-sm font-semibold tabular-nums leading-snug text-surface-700">{realizedLabel}</p>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-100">
                                      <div className={`h-full transition-[width] duration-700 ${progressClass}`} style={{ width: `${barPct}%` }} />
                                    </div>
                                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-surface-700">{num(row.progressPct, 1)}%</span>
                                  </div>
                                  <span className={`text-right text-[10px] font-semibold uppercase tracking-wide ${row.statusClass}`}>{row.statusLabel}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>

          <Card className={executivePanelCardClass}>
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-500" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                  Desempenho individual de vendedores
                </p>
                <p className="mt-0.5 text-[10px] text-surface-400">
                  Clique no card do vendedor para expandir os detalhes completos no próprio bloco.
                </p>
              </div>
              <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-surface-200 bg-white text-[10px] font-semibold uppercase tracking-widest text-surface-500">
                {SELLER_PERFORMANCE_SCOPE_OPTIONS.map((option) => (
                  <button
                    key={`seller-performance-scope-${option.value}`}
                    type="button"
                    className={`border-l border-surface-200 px-3 py-1.5 transition-colors first:border-l-0 ${
                      sellerPerformanceScope === option.value ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-surface-50'
                    }`}
                    onClick={() => setSellerPerformanceScope(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
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
                      const snapshotBlock =
                        ruleBlocks.find((candidate) => candidate.id === snapshot.blockId) ??
                        findBlockForSeller(row.seller.id, ruleBlocks) ??
                        null
                      const resolvedProfileType = snapshotBlock
                        ? resolveBlockProfileType(snapshotBlock)
                        : (resolveSellerProfileForId(row.seller.id) ?? 'NOVATO')
                      const avgRatio = row.cells.length > 0
                        ? row.cells.reduce((sum, cell) => sum + cell.ratio, 0) / row.cells.length
                        : 0
                      const pointsRatio = snapshot.pointsTarget > 0 ? snapshot.pointsAchieved / snapshot.pointsTarget : 0
                      return {
                        id: row.seller.id,
                        nameShort: getSellerShortName(row.seller.name),
                        fullName: row.seller.name,
                        login: row.seller.login,
                        profileType: resolvedProfileType,
                        status: snapshot.status,
                        pointsAchieved: snapshot.pointsAchieved,
                        pointsTarget: snapshot.pointsTarget,
                        uniqueClients: snapshot.uniqueClients,
                        baseClients: Math.max(snapshot.seller.baseClientCount ?? 0, 0),
                        rewardAchieved: snapshot.rewardAchieved,
                        pointsRatio,
                        avgRatio,
                        snapshot,
                        cells: row.cells,
                      }
                    })
                    .filter((row): row is NonNullable<typeof row> => row !== null)

                    const filteredRows = sellerPerformanceScope === 'ALL'
                      ? rows
                      : sellerPerformanceScope === 'SUPERVISOR'
                        ? rows.filter((row) => {
                            const sellerData = sellers.find((s) => s.id === row.id)
                            if (!sellerData?.supervisorCode) return false
                            return performanceSupervisorKey ? sellerData.supervisorCode === performanceSupervisorKey : true
                          })
                        : rows.filter((row) => row.profileType === sellerPerformanceScope)
                    const filteredSellerIds = new Set(filteredRows.map((row) => row.id))
                    const filteredUniqueClientsSet = new Set<string>()
                    for (const seller of sellers) {
                      if (!filteredSellerIds.has(seller.id)) continue
                      for (const order of seller.orders) {
                        const code = (order.clientCode ?? '').trim()
                        if (code) filteredUniqueClientsSet.add(code)
                      }
                    }
                    const filteredUniqueClients = filteredUniqueClientsSet.size
                    const filteredTotalBaseClients = filteredRows.reduce((sum, row) => {
                      const sellerData = sellers.find((s) => s.id === row.id)
                      return sum + (sellerData?.baseClientCount ?? 0)
                    }, 0)
                    const periodClosed = hasMonthEnded(year, month, activeMonth?.closingWeekEndDate ?? '') && Boolean(cycle.lastBusinessDate)
                    const avgPoints = filteredRows.length > 0
                      ? filteredRows.reduce((sum, row) => sum + row.pointsAchieved, 0) / filteredRows.length
                      : 0
                    const avgGapToFull = filteredRows.length > 0
                      ? filteredRows.reduce((sum, row) => sum + Math.max(1 - row.pointsAchieved, 0), 0) / filteredRows.length
                      : 0
                    const kpiSummary = filteredRows.reduce(
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
                    const scopeLabel = sellerPerformanceScope === 'ALL'
                      ? 'Visão geral'
                      : sellerPerformanceScope === 'SUPERVISOR'
                        ? (performanceSupervisorOptions.find((o) => o.key === performanceSupervisorKey)?.name ?? 'Supervisor')
                        : SELLER_PROFILE_LABEL[sellerPerformanceScope]

                    return (
                      <>
                        {sellerPerformanceScope === 'SUPERVISOR' && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2.5">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700">Supervisor</label>
                            {performanceSupervisorOptions.length === 0 ? (
                              <span className="text-xs text-surface-500">Nenhum supervisor vinculado na lista de vendedores.</span>
                            ) : (
                              <select
                                className="min-w-56 rounded-lg border border-cyan-200 bg-white px-2 py-1 text-sm text-surface-800"
                                value={performanceSupervisorKey}
                                onChange={(e) => setPerformanceSupervisorKey(e.target.value)}
                              >
                                <option value="">Todos os supervisores</option>
                                {performanceSupervisorOptions.map((opt) => (
                                  <option key={opt.key} value={opt.key}>{opt.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
                          <div className="relative overflow-hidden rounded-xl border border-sky-200 bg-linear-to-br from-sky-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-sky-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-700">Vendedores monitorados</p>
                            <p className="mt-1 text-2xl font-bold text-sky-900 tabular-nums">{filteredRows.length}</p>
                            <p className="text-[10px] text-sky-700">{scopeLabel} no período selecionado</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-indigo-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-700">Clientes únicos atendidos</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-900 tabular-nums">
                              {num(filteredUniqueClients, 0)}
                              {filteredTotalBaseClients > 0 && (
                                <span className="font-bold text-indigo-700/80"> / {num(filteredTotalBaseClients, 0)}</span>
                              )}
                            </p>
                            <p className="text-[10px] text-indigo-700">Total em {scopeLabel.toLowerCase()}</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-cyan-200 bg-linear-to-br from-cyan-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-cyan-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700">Pontuação média da equipe</p>
                            <p className="mt-1 text-2xl font-bold text-cyan-900 tabular-nums">{num(avgPoints, 2)} pts</p>
                            <p className="text-[10px] text-cyan-700">Média geral de pontos alcançados no ciclo</p>
                          </div>
                          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white px-3 py-2.5 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-0.75 bg-emerald-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">Metas conquistadas no ciclo</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-900 tabular-nums">
                              {num(kpiSummary.hit, 0)}
                              <span className="font-bold text-emerald-700/80"> / {num(kpiSummary.total, 0)}</span>
                            </p>
                            <p className="text-[10px] text-emerald-700">
                              {periodClosed ? `Gap médio para 1,00 pt: ${num(avgGapToFull, 2)} pts` : 'Parcial até a data atual'}
                            </p>
                          </div>
                        </div>

                      <div className="space-y-1.5">
                        <div className="grid grid-cols-[44px_2.35fr_1fr_1fr_repeat(4,0.82fr)_24px] items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                          <span className="text-center">#</span>
                          <span>Vendedor</span>
                          <span className="text-center">Premiação atual</span>
                          <span className="text-center">Clientes atendidos</span>
                          {STAGES.filter((stage) => stage.key !== 'FULL').map((stage) => (
                            <span key={`head-compact-${stage.key}`} className="text-center">{stage.label}</span>
                          ))}
                          <span />
                        </div>
                        {filteredRows.length === 0 ? (
                          <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-4 text-center text-xs text-surface-500">
                            Nenhum vendedor encontrado para o filtro "{scopeLabel}".
                          </div>
                        ) : filteredRows.map((row, index) => {
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
                                  <span className={`text-center text-xs font-semibold tabular-nums ${isOpen ? 'text-slate-700' : 'text-surface-500'}`}>{index + 1}</span>
                                  <span className="block min-w-0 truncate text-sm font-semibold text-surface-900">{row.nameShort}</span>
                                  <span className="rounded-md border border-surface-200 bg-white px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-surface-800">
                                    {formatRewardValue(row.rewardAchieved, row.snapshot.rewardMode)}
                                  </span>
                                  <span className="rounded-md border border-surface-200 bg-white px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-surface-800">
                                    {num(row.uniqueClients, 0)}/{num(row.baseClients, 0)}
                                  </span>
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
                                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Painel do vendedor</p>
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
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                                          {formatRewardValue(row.snapshot.kpiRewardAchieved, row.snapshot.rewardMode)}
                                        </p>
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
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">KPIs e parâmetros do ciclo</p>
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
            <p className="text-xs text-surface-600">Período monitorado: {MONTHS[month]}/{year}. O ciclo considera somente dias úteis dentro dos períodos configurados para cada etapa (1ª, 2ª, 3ª semana e fechamento). Após o último dia útil configurado, entra em standby aguardando a definição do próximo ciclo.{sellerSpecificDatesFooterSummary}</p>
          </Card>
        </>
      )}

      {/* ── KPI apply modal (targeted sellers) ───────────────────── */}
      <Modal
        open={applyKpiModal.open}
        onClose={closeApplyKpiModal}
        title="Aplicar parâmetros de KPI"
        description={(() => {
          const sourceTitle = kpiApplySourceBlock?.title ?? 'grupo selecionado'
          const profileLabel = kpiApplySourceProfile ? SELLER_PROFILE_LABEL[kpiApplySourceProfile] : 'perfil selecionado'
          return `Selecione os vendedores do perfil "${profileLabel}" que receberão os parâmetros de KPI do bloco "${sourceTitle}".`
        })()}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeApplyKpiModal}
              className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={applyKpiModal.selectedSellerIds.length === 0}
              onClick={applyKpiRulesToSelectedSellers}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aplicar para selecionados
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-surface-800">
              <input
                type="checkbox"
                checked={allKpiApplyTargetsSelected}
                onChange={(event) =>
                  setApplyKpiModal((prev) => ({
                    ...prev,
                    selectedSellerIds: event.target.checked ? kpiApplyTargetOptions.map((option) => option.sellerId) : [],
                  }))
                }
                className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500/40"
              />
              Selecionar todos do perfil atual
            </label>
            <p className="mt-1 text-xs text-surface-500">
              {applyKpiModal.selectedSellerIds.length} de {kpiApplyTargetOptions.length} selecionado(s).
            </p>
          </div>

          {kpiApplyTargetOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              Não há vendedores de mesmo perfil em outros blocos para receber os parâmetros.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-surface-200 bg-white p-2">
              {kpiApplyTargetOptions.map((option) => (
                <label
                  key={option.sellerId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-surface-200 hover:bg-surface-50"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedKpiApplySellerIds.has(option.sellerId)}
                      onChange={(event) =>
                        setApplyKpiModal((prev) => ({
                          ...prev,
                          selectedSellerIds: event.target.checked
                            ? [...prev.selectedSellerIds, option.sellerId]
                            : prev.selectedSellerIds.filter((sellerId) => sellerId !== option.sellerId),
                        }))
                      }
                      className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500/40"
                    />
                    <div>
                      <p className="text-sm font-medium text-surface-800">{option.sellerName}</p>
                      <p className="text-[11px] text-surface-500">Bloco atual: {option.blockTitle}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Add seller to allowlist modal ───────────────────────── */}
      <Modal
        open={addAllowlistModal.open}
        onClose={closeAddAllowlistModal}
        title="Adicionar vendedor à lista"
        description="Selecione o vendedor e classifique o tipo para usar métricas e KPIs específicos."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeAddAllowlistModal}
              className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!addAllowlistModal.selectedSellerId}
              onClick={addSellerToAllowlistFromModal}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Adicionar / Atualizar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
            <Search size={14} className="text-surface-400 shrink-0" />
            <input
              autoFocus
              placeholder="Buscar vendedor..."
              className="flex-1 bg-transparent text-sm text-surface-800 placeholder-surface-400 outline-none"
              value={addAllowlistModal.search}
              onChange={(event) => setAddAllowlistModal((prev) => ({ ...prev, search: event.target.value }))}
            />
            {addAllowlistModal.search && (
              <button
                type="button"
                onClick={() => setAddAllowlistModal((prev) => ({ ...prev, search: '' }))}
                className="text-surface-400 hover:text-surface-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div>
            <p className={label}>Tipo de vendedor</p>
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              {SELLER_PROFILE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    addAllowlistModal.profileType === option.value
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="allowlist-seller-profile"
                      className="mt-0.5 h-3.5 w-3.5 accent-primary-600"
                      checked={addAllowlistModal.profileType === option.value}
                      onChange={() => setAddAllowlistModal((prev) => ({ ...prev, profileType: option.value }))}
                    />
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-[10px] text-surface-500">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {sellers.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              Nenhum vendedor carregado no período atual para seleção.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto rounded-xl border border-surface-200 divide-y divide-surface-100">
              {sellers
                .filter((seller) => !addAllowlistModal.search || seller.name.toLowerCase().includes(addAllowlistModal.search.toLowerCase()))
                .map((seller) => {
                  const initials = seller.name.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase()
                  const sellerCode = toSellerCodeFromId(seller.id)
                  const normalizedName = normalizeSellerNameForLookup(seller.name)
                  const existing = allowlist.find((item) => {
                    const itemCode = normalizeEntityCode(String(item.code ?? ''))
                    const itemName = normalizeSellerNameForLookup(item.name)
                    return (sellerCode && itemCode === sellerCode) || itemName === normalizedName
                  })
                  const suggestedProfile = normalizeSellerProfileType(existing?.profileType ?? sellerProfileByCode.get(sellerCode) ?? 'NOVATO')
                  const isSelected = addAllowlistModal.selectedSellerId === seller.id
                  return (
                    <li key={seller.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setAddAllowlistModal((prev) => ({
                            ...prev,
                            selectedSellerId: seller.id,
                            profileType: suggestedProfile,
                          }))
                        }
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected ? 'bg-primary-50' : 'hover:bg-surface-50'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                          isSelected ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-600'
                        }`}>
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${isSelected ? 'text-primary-700' : 'text-surface-800'}`}>{seller.name}</p>
                          <p className="text-[10px] text-surface-500">
                            {sellerCode ? `Código ${sellerCode}` : 'Sem código'} · Tipo sugerido: {SELLER_PROFILE_LABEL[suggestedProfile]}
                          </p>
                        </div>
                        {existing ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Já está na lista
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      </Modal>

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
        onClose={() => setAddGroupModal({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })}
        title="Adicionar grupo de parâmetros"
        description="Selecione um vendedor e o tipo de perfil para criar um grupo com KPIs/parametrizações específicas."
        size="md"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setAddGroupModal({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })}
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
                const selectedProfileType = normalizeSellerProfileType(addGroupModal.profileType)
                const source =
                  ruleBlocks.find((b) => b.sellerProfileType === selectedProfileType && b.sellerIds.length > 0)
                  ?? (ruleBlocks.find((b) => b.id === selectedBlockId) ?? ruleBlocks[0])
                const cloned: RuleBlock = {
                  ...source,
                  id: newId,
                  title: stripLegacySellerCounterSuffix(seller.name).split(' ').slice(0, 2).join(' '),
                  sellerProfileType: selectedProfileType,
                  sellerIds: [seller.id],
                  rules: cloneRulesWithFreshIds(source.rules, `rule-${selectedProfileType}-${newId}`),
                }
                setRuleBlocks((prev) => [...prev, cloned])
                setSelectedBlockId(newId)
                setAddGroupModal({ open: false, search: '', selectedSellerId: '', profileType: 'NOVATO' })
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
                  const sellerCode = toSellerCodeFromId(s.id)
                  const sellerProfile = sellerProfileByCode.get(sellerCode) ?? 'NOVATO'
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={alreadyInBlock}
                        onClick={() => setAddGroupModal((prev) => ({ ...prev, selectedSellerId: s.id, profileType: sellerProfile }))}
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
                          <div className="text-[10px] text-surface-500">Tipo: {SELLER_PROFILE_LABEL[sellerProfile]}</div>
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
          <div>
            <p className={label}>Tipo de vendedor para este grupo</p>
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              {SELLER_PROFILE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    addGroupModal.profileType === option.value
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="group-seller-profile"
                      className="mt-0.5 h-3.5 w-3.5 accent-primary-600"
                      checked={addGroupModal.profileType === option.value}
                      onChange={() => setAddGroupModal((prev) => ({ ...prev, profileType: option.value }))}
                    />
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-[10px] text-surface-500">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-surface-400">
              Se já existir um grupo desse tipo, os KPIs/parâmetros serão herdados automaticamente desse perfil.
            </p>
          </div>
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
