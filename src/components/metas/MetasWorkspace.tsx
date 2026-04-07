'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Settings2,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

type StageKey = 'W1' | 'W2' | 'W3' | 'CLOSING' | 'FULL'
type RuleFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
type PrizeType = 'CASH' | 'BENEFIT'
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

interface CampaignPrize {
  id: string
  title: string
  frequency: 'MONTHLY' | 'QUARTERLY'
  type: PrizeType
  rewardValue: number
  benefitDescription: string
  minPoints: number
  active: boolean
}

interface MonthConfig {
  week1StartDate: string
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

interface Salesperson {
  id: string
  name: string
  login: string
  orders: SellerOrder[]
  totalValue: number
  totalGrossWeight: number
  totalOrders: number
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

interface PerformanceDiagnostics {
  selectedMonthOrders: number
}

interface RuleProgress {
  ruleId: string
  progress: number
}

interface SellerSnapshot {
  seller: Salesperson
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  averageTicket: number
  pointsAchieved: number
  pointsTarget: number
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
  { type: 'VOLUME', label: 'Volume', defaultDescription: 'Categorias trafegando no período.' },
  { type: 'META_FINANCEIRA', label: 'Meta financeira', defaultDescription: 'Atingir a meta financeira no fechamento do período.' },
  { type: 'DISTRIBUICAO', label: 'Distribuição de itens', defaultDescription: 'Positivação de itens na base de clientes.' },
  { type: 'DEVOLUCAO', label: 'Devolução', defaultDescription: 'Racional sobre os valores devolvidos x valores faturados.' },
  { type: 'INADIMPLENCIA', label: 'Inadimplência acumulativa', defaultDescription: 'Racional sobre o percentual x valores faturados.' },
  { type: 'ITEM_FOCO', label: 'Item foco do mês', defaultDescription: 'Entrega do volume e positivação.' },
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

const DEFAULT_RULES: GoalRule[] = [
  // ── 1ª Semana ──
  { id: 'w1-base', stage: 'W1', frequency: 'WEEKLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento da 1ª semana.', targetText: '40%', rewardValue: 193.49, points: 0.04 },
  { id: 'w1-volume', stage: 'W1', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Categorias trafegando dentro do tempo decorrido até o fechamento da 1ª semana.', targetText: '2 categorias', rewardValue: 145.12, points: 0.03 },
  { id: 'w1-fin', stage: 'W1', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 1ª semana.', targetText: '30%', rewardValue: 96.75, points: 0.02 },
  // ── 2ª Semana ──
  { id: 'w2-base', stage: 'W2', frequency: 'WEEKLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento da 2ª semana.', targetText: '80%', rewardValue: 193.49, points: 0.04 },
  { id: 'w2-volume', stage: 'W2', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Categorias trafegando dentro do tempo decorrido até o fechamento da 2ª semana.', targetText: '3 categorias', rewardValue: 145.12, points: 0.03 },
  { id: 'w2-fin', stage: 'W2', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 2ª semana.', targetText: '60%', rewardValue: 96.75, points: 0.02 },
  // ── 3ª Semana ──
  { id: 'w3-volume', stage: 'W3', frequency: 'WEEKLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Categorias trafegando dentro do tempo decorrido até o fechamento da 3ª semana.', targetText: '4 categorias', rewardValue: 145.12, points: 0.03 },
  { id: 'w3-dist', stage: 'W3', frequency: 'WEEKLY', kpiType: 'DISTRIBUICAO', kpi: 'Distribuição de itens', description: 'Ter 50% dos itens positivados em 30% da base de clientes.', targetText: '50%|30', rewardValue: 483.73, points: 0.1 },
  { id: 'w3-fin', stage: 'W3', frequency: 'WEEKLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento da 3ª semana.', targetText: '80%', rewardValue: 241.87, points: 0.05 },
  // ── Fechamento ──
  { id: 'closing-base', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'BASE_CLIENTES', kpi: 'Base de clientes', description: 'Cobertura da base de clientes até o fechamento do mês.', targetText: '85%', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-volume', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'VOLUME', kpi: 'Volume', description: 'Categorias entregues até o fechamento do mês.', targetText: '6 categorias', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-dist', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'DISTRIBUICAO', kpi: 'Distribuição de itens', description: 'Ter 80% dos itens positivados em 40% da base de clientes.', targetText: '80%|40', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-devol', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'DEVOLUCAO', kpi: 'Devolução', description: 'Racional sobre os valores devolvidos x valores faturados no mês.', targetText: 'Até 0,5%', rewardValue: 241.87, points: 0.05 },
  { id: 'closing-inadimp', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'INADIMPLENCIA', kpi: 'Inadimplência acumulativa', description: 'Racional sobre o percentual x valores faturados no mês.', targetText: 'Até 3%', rewardValue: 241.87, points: 0.05 },
  { id: 'closing-foco', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'ITEM_FOCO', kpi: 'Item foco do mês', description: 'Entrega do volume e positivação.', targetText: '100% V + 40% D', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-fin', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'META_FINANCEIRA', kpi: 'Meta financeira', description: 'Atingir a meta financeira no fechamento do mês (faturado).', targetText: '120%', rewardValue: 96.75, points: 0.02 },
  { id: 'closing-rentab', stage: 'CLOSING', frequency: 'MONTHLY', kpiType: 'RENTABILIDADE', kpi: 'Rentabilidade', description: 'Apresentar margem de contribuição dentro do percentual parametrizado.', targetText: '33%', rewardValue: 967.46, points: 0.2 },
]

const DEFAULT_RULE_BLOCKS: RuleBlock[] = [
  { id: 'default', title: 'Bloco padrão', monthlyTarget: 0, sellerIds: [], rules: DEFAULT_RULES },
]

function findBlockForSeller(sellerId: string, blocks: RuleBlock[]): RuleBlock {
  const specific = blocks.find((b) => b.sellerIds.includes(sellerId))
  if (specific) return specific
  return blocks.find((b) => b.sellerIds.length === 0) ?? blocks[0]
}

const DEFAULT_PRIZES: CampaignPrize[] = [
  { id: 'month', title: 'Campanha VDD do mês', frequency: 'MONTHLY', type: 'CASH', rewardValue: 1000, benefitDescription: '', minPoints: 0.6, active: true },
  { id: 'quarter', title: 'Campanha VDD do trimestre', frequency: 'QUARTERLY', type: 'BENEFIT', rewardValue: 0, benefitDescription: '', minPoints: 18, active: true },
]

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

function parseTargetNumber(targetText: string) {
  const match = targetText.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return parseDecimal(match[1], 0)
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

function buildCycle(startIso: string, year: number, month: number, blocked: Set<string>) {
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
  const weekStages = STAGES.filter((s) => s.key !== 'FULL')

  weekStages.forEach((stage, index) => {
    const stageStart = addDays(baseStart, index * 7)
    if (stageStart > monthEnd) {
      weeks.push({
        key: stage.key,
        label: stage.label,
        start: null,
        end: null,
        businessDays: [],
      })
      return
    }

    const rawStageEnd = stage.key === 'CLOSING' ? monthEnd : addDays(stageStart, 4)
    const stageEnd = rawStageEnd > monthEnd ? monthEnd : rawStageEnd
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
  for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor = addDays(cursor, 1)) {
    const weekday = cursor.getDay()
    const iso = toIsoDate(cursor)
    if (weekday >= 1 && weekday <= 5 && !blocked.has(iso)) fullBusiness.push(iso)
  }
  weeks.push({
    key: 'FULL',
    label: 'Todo o período',
    start: toIsoDate(monthStart),
    end: toIsoDate(monthEnd),
    businessDays: fullBusiness,
  })

  let lastBusinessDate: string | null = null
  for (let d = new Date(monthEnd); d >= monthStart; d = addDays(d, -1)) {
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

function hasMonthEnded(year: number, month: number) {
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return new Date().getTime() > monthEnd.getTime()
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

  const activeKey = monthKey(year, month)
  const activeMonth = monthConfigs[activeKey]
  const prevActiveKeyRef = useRef(activeKey)
  const input = 'mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      const loadedYear = typeof data.year === 'number' ? data.year : now.getFullYear()
      const loadedMonth = typeof data.month === 'number' ? data.month : now.getMonth()
      if (typeof data.year === 'number') setYear(data.year)
      if (typeof data.month === 'number') setMonth(data.month)
      if (data.monthConfigs && typeof data.monthConfigs === 'object') setMonthConfigs(data.monthConfigs as Record<string, MonthConfig>)

      const migrateBlocks = (raw: unknown): RuleBlock[] => {
        if (Array.isArray(raw)) return (raw as RuleBlock[]).map((b) => ({
          ...b,
          monthlyTarget: b.monthlyTarget ?? 0,
          sellerIds: b.sellerIds ?? [],
          rules: b.rules.map((r) => ({ ...r, kpiType: r.kpiType ?? inferKpiType(r.kpi) })),
        }))
        return DEFAULT_RULE_BLOCKS
      }

      if (data.metaConfigs && typeof data.metaConfigs === 'object') {
        const mc = data.metaConfigs as Record<string, MetaConfig>
        // Normalize blocks inside each meta config
        const normalized = Object.fromEntries(
          Object.entries(mc).map(([k, v]) => [k, { ...v, ruleBlocks: migrateBlocks(v.ruleBlocks) }])
        )
        setMetaConfigs(normalized)
        const key = monthKey(loadedYear, loadedMonth)
        const cfg = normalized[key]
        if (cfg) {
          setRuleBlocks(cfg.ruleBlocks)
          setPrizes(cfg.prizes)
          setIncludeNational(cfg.includeNational)
          setSalaryBase(cfg.salaryBase)
          setBasePremiation(cfg.basePremiation)
          setExtraBonus(cfg.extraBonus)
          setExtraMinPoints(cfg.extraMinPoints)
        }
      } else {
        // Legacy migration: flat ruleBlocks/rules at root level → create single metaConfig entry
        let blocks = DEFAULT_RULE_BLOCKS
        if (Array.isArray(data.ruleBlocks)) {
          blocks = migrateBlocks(data.ruleBlocks)
        } else if (Array.isArray(data.rules)) {
          blocks = [{ id: 'default', title: 'Bloco padrão', monthlyTarget: 0, sellerIds: [], rules: (data.rules as GoalRule[]).map((r) => ({ ...r, kpiType: r.kpiType ?? inferKpiType(r.kpi) })) }]
        }
        const legacyPrizes = Array.isArray(data.prizes) ? (data.prizes as CampaignPrize[]).map((p) => ({ ...p, benefitDescription: p.benefitDescription ?? '' })) : DEFAULT_PRIZES
        const cfg: MetaConfig = {
          ruleBlocks: blocks,
          prizes: legacyPrizes,
          includeNational: typeof data.includeNational === 'boolean' ? data.includeNational : true,
          salaryBase: typeof data.salaryBase === 'number' ? data.salaryBase : 1612.44,
          basePremiation: typeof data.basePremiation === 'number' ? data.basePremiation : 4837.32,
          extraBonus: typeof data.extraBonus === 'number' ? data.extraBonus : 400,
          extraMinPoints: typeof data.extraMinPoints === 'number' ? data.extraMinPoints : 0.6,
        }
        const key = monthKey(loadedYear, loadedMonth)
        setMetaConfigs({ [key]: cfg })
        setRuleBlocks(cfg.ruleBlocks)
        setPrizes(cfg.prizes)
        setIncludeNational(cfg.includeNational)
        setSalaryBase(cfg.salaryBase)
        setBasePremiation(cfg.basePremiation)
        setExtraBonus(cfg.extraBonus)
        setExtraMinPoints(cfg.extraMinPoints)
      }
    } catch {
      // ignore bad payload
    }
  }, [])

  useEffect(() => {
    if (activeMonth) return
    setMonthConfigs((prev) => ({
      ...prev,
      [activeKey]: {
        week1StartDate: firstMonday(year, month),
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
        setPrizes(cfg.prizes)
        setIncludeNational(cfg.includeNational)
        setSalaryBase(cfg.salaryBase)
        setBasePremiation(cfg.basePremiation)
        setExtraBonus(cfg.extraBonus)
        setExtraMinPoints(cfg.extraMinPoints)
      } else {
        // Inherit from closest previous month that has config
        const source = Object.keys(updated).sort().reverse().find((k) => k < activeKey)
        if (source) {
          const src = updated[source]
          setRuleBlocks(src.ruleBlocks)
          setPrizes(src.prizes)
          setIncludeNational(src.includeNational)
          setSalaryBase(src.salaryBase)
          setBasePremiation(src.basePremiation)
          setExtraBonus(src.extraBonus)
          setExtraMinPoints(src.extraMinPoints)
        }
        // If no previous month exists, keep current defaults
      }

      return updated
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const merged: Record<string, MetaConfig> = {
      ...metaConfigs,
      [activeKey]: { ruleBlocks, prizes, includeNational, salaryBase, basePremiation, extraBonus, extraMinPoints },
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year, month, monthConfigs, metaConfigs: merged })
    )
  }, [activeKey, basePremiation, extraBonus, extraMinPoints, includeNational, metaConfigs, month, monthConfigs, prizes, ruleBlocks, salaryBase, year])

  useEffect(() => {
    const controller = new AbortController()
    setSellersLoading(true)
    setSellersError('')

    fetch(`/api/metas/sellers-performance?year=${year}&month=${month + 1}`, { signal: controller.signal })
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
          totalValue?: number
          totalGrossWeight?: number
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number; grossWeight?: number; clientCode?: string }>
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

          return {
            id: seller.id,
            name: seller.name,
            login: seller.login,
            totalValue: Number(seller.totalValue ?? 0),
            totalGrossWeight: Number(seller.totalGrossWeight ?? 0),
            totalOrders: Number(seller.totalOrders ?? normalizedOrders.length),
            orders: normalizedOrders,
          }
        })

        setSellers(mapped)
        setPerformanceDiagnostics(
          (data?.diagnostics as PerformanceDiagnostics | undefined) ?? {
            selectedMonthOrders: mapped.reduce((sum, seller) => sum + seller.totalOrders, 0),
          }
        )
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
  }, [month, year])

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
          totalValue?: number
          totalGrossWeight?: number
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number; grossWeight?: number; clientCode?: string }>
        }>
        setSellers(
          remoteSellers.map((seller) => ({
            id: seller.id,
            name: seller.name,
            login: seller.login,
            totalValue: Number(seller.totalValue ?? 0),
            totalGrossWeight: Number(seller.totalGrossWeight ?? 0),
            totalOrders: Number(seller.totalOrders ?? (seller.orders ?? []).length),
            orders: (seller.orders ?? [])
              .filter((order) => typeof order.negotiatedAt === 'string' && order.negotiatedAt.length >= 10)
              .map((order) => ({
                orderNumber: String(order.orderNumber ?? ''),
                negotiatedAt: String(order.negotiatedAt).slice(0, 10),
                totalValue: Number(order.totalValue ?? 0),
                grossWeight: Number(order.grossWeight ?? 0),
                clientCode: String(order.clientCode ?? ''),
              })),
          }))
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

  const cycle = useMemo(() => buildCycle(activeMonth?.week1StartDate ?? '', year, month, blockedSet), [activeMonth?.week1StartDate, blockedSet, month, year])
  const pointsTarget = useMemo(() => rules.reduce((sum, rule) => sum + rule.points, 0), [rules])
  const rewardTarget = useMemo(() => rules.reduce((sum, rule) => sum + rule.rewardValue, 0), [rules])

  const nextDate = useMemo(() => new Date(year, month + 1, 1), [month, year])
  const nextKey = monthKey(nextDate.getFullYear(), nextDate.getMonth())
  const nextConfigured = Boolean(monthConfigs[nextKey]?.week1StartDate)
  const standby = !activeMonth?.week1StartDate || (hasMonthEnded(year, month) && !nextConfigured)

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
          const lockedClients = Math.max(cumStage.distinctClients, 1)
          const lockedTicket = cumStage.orderCount > 0 ? cumStage.totalValue / cumStage.orderCount : 0

          // KPIs that always interpret parameter as percentage
          const pctKpis: KpiType[] = ['BASE_CLIENTES', 'META_FINANCEIRA', 'RENTABILIDADE', 'DEVOLUCAO', 'INADIMPLENCIA']
          const asPct = pctKpis.includes(kpiType) && rawNumber > 0
            ? Math.max(rawNumber / 100, 0.00001)
            : (rule.targetText.includes('%') && rawNumber > 0 ? Math.max(rawNumber / 100, 0.00001) : null)

          let progress = 0

          switch (kpiType) {
            case 'META_FINANCEIRA':
              if (asPct) {
                progress = cumStage.totalValue / (monthlyTargetSafe * asPct)
              } else {
                progress = cumStage.totalValue / monthlyTargetSafe
              }
              break
            case 'RENTABILIDADE':
              // Use stage-locked average ticket so past stages don't shift
              progress = (lockedTicket / teamAverageTicketSafe) / (asPct ?? 1)
              break
            case 'BASE_CLIENTES':
              // Distinct clients reached in this stage vs total client base (% coverage)
              // totalDistinctClients can only grow → past KPIs can only stay same or decrease, never improve
              if (asPct) {
                const clientCoverage = cumStage.distinctClients / Math.max(totalDistinctClients, 1)
                progress = clientCoverage / asPct
              } else {
                progress = cumStage.distinctClients > 0 ? 1 : 0
              }
              break
            case 'VOLUME':
              if (rawNumber > 0 && !rule.targetText.includes('%')) {
                progress = cumStage.orderCount / rawNumber
              } else if (asPct) {
                progress = (cumStage.totalValue / lockedValue) / asPct
              } else {
                progress = cumStage.orderCount > 0 ? 1 : 0
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
              // Use stage-locked distinct clients so past KPIs don't shift
              if (resolvedItems > 0 && clientsPct > 0 && lockedClients > 0) {
                const requiredClients = Math.ceil(lockedClients * clientsPct)
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
            case 'INADIMPLENCIA':
              progress = 0
              break
            case 'ITEM_FOCO':
              // Stage-locked: compare stage value against cumulative value up to this stage
              progress = stage.orderCount > 0 ? Math.min(stage.totalValue / lockedValue, 1) : 0
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

        const rewardAchieved = blockRules.reduce((sum, rule) => {
          const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
          return sum + (progress >= 1 ? rule.rewardValue : 0)
        }, 0)

        const ratio = activePointsTarget > 0 ? pointsAchieved / activePointsTarget : 0

        const hasSuperTarget = blockRules.some((rule) => {
          if (rule.kpiType !== 'META_FINANCEIRA') return false
          const pct = parseFloat(rule.targetText.replace('%', ''))
          return pct > 100 && (ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0) >= 1
        })

        const status: SellerSnapshot['status'] = hasSuperTarget ? 'SUPEROU' : ratio >= 0.85 ? 'NO_ALVO' : ratio >= 0.65 ? 'ATENCAO' : 'CRITICO'

        return {
          seller,
          totalOrders: seller.totalOrders,
          totalValue: seller.totalValue,
          totalGrossWeight: seller.totalGrossWeight,
          averageTicket,
          pointsAchieved,
          pointsTarget: blockPointsTarget,
          rewardAchieved,
          rewardTarget: blockRewardTarget,
          status,
          gapToTarget: Math.max(blockPointsTarget - pointsAchieved, 0),
          ruleProgress,
          blockId: block.id,
        }
      })
      .sort((a, b) => b.pointsAchieved - a.pointsAchieved)
  }, [cycle.weeks, productAllowlist, ruleBlocks, sellers])

  useEffect(() => {
    if (snapshots.length === 0) return
    if (!snapshots.some((snapshot) => snapshot.seller.id === selectedSellerId)) {
      setSelectedSellerId(snapshots[0].seller.id)
    }
  }, [selectedSellerId, snapshots])

  const selectedSeller = snapshots.find((snapshot) => snapshot.seller.id === selectedSellerId) ?? snapshots[0]

  const byStatus = useMemo(
    () => ({
      superou: snapshots.filter((s) => s.status === 'SUPEROU').length,
      noAlvo: snapshots.filter((s) => s.status === 'NO_ALVO').length,
      atencao: snapshots.filter((s) => s.status === 'ATENCAO').length,
      critico: snapshots.filter((s) => s.status === 'CRITICO').length,
    }),
    [snapshots]
  )

  const selectedCampaignProjection = useMemo(() => {
    if (!selectedSeller) return 0
    return prizes.reduce((sum, prize) => {
      if (!prize.active) return sum
      return selectedSeller.pointsAchieved >= prize.minPoints ? sum + prize.rewardValue : sum
    }, 0)
  }, [prizes, selectedSeller])

  const statusLabel: Record<SellerSnapshot['status'], string> = {
    SUPEROU: 'Superou',
    NO_ALVO: 'Meta Batida',
    ATENCAO: 'Atenção',
    CRITICO: 'Crítico',
  }

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

  const statusSeries = useMemo(
    () => [
      { label: 'Superou', value: byStatus.superou, color: 'bg-emerald-500' },
      { label: 'Meta Batida', value: byStatus.noAlvo, color: 'bg-cyan-500' },
      { label: 'Atenção', value: byStatus.atencao, color: 'bg-amber-500' },
      { label: 'Crítico', value: byStatus.critico, color: 'bg-rose-500' },
    ],
    [byStatus]
  )

  const stageSeries = useMemo(
    () =>
      STAGES.filter((s) => s.key !== 'FULL').map((stage) => {
        const stageRules = rules.filter((rule) => rule.stage === stage.key)
        const stageTarget = stageRules.reduce((sum, rule) => sum + rule.points, 0)
        if (stageTarget <= 0 || snapshots.length === 0) {
          return { key: stage.key, label: stage.label, target: stageTarget, achieved: 0, ratio: 0 }
        }

        const achievedAverage =
          snapshots.reduce((sumSellers, snapshot) => {
            const sellerStagePoints = stageRules.reduce((sumRules, rule) => {
              const progress = snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
              return sumRules + rule.points * Math.min(progress, 1)
            }, 0)
            return sumSellers + sellerStagePoints
          }, 0) / snapshots.length

        return {
          key: stage.key,
          label: stage.label,
          target: stageTarget,
          achieved: achievedAverage,
          ratio: stageTarget > 0 ? achievedAverage / stageTarget : 0,
        }
      }),
    [rules, snapshots]
  )

  const executiveMetricCardClass =
    'group relative overflow-hidden border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'

  const executivePanelCardClass =
    'group relative overflow-hidden border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'

  const stageRuleMap = useMemo(
    () =>
      Object.fromEntries(
        STAGES.filter((s) => s.key !== 'FULL').map((stage) => [stage.key, rules.filter((rule) => rule.stage === stage.key)])
      ) as Record<StageKey, GoalRule[]>,
    [rules]
  )

  const lineChartData = useMemo(() => {
    const width = 560
    const height = 240
    const padLeft = 54
    const padRight = 18
    const padTop = 18
    const padBottom = 40
    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom

    const maxStagePoint = Math.max(
      0.001,
      ...stageSeries.flatMap((stage) => [stage.target, stage.achieved])
    )

    const yFor = (value: number) =>
      height - padBottom - (Math.min(value, maxStagePoint) / maxStagePoint) * plotHeight

    const buildPoints = (pick: (item: (typeof stageSeries)[number]) => number) =>
      stageSeries.map((stage, index) => {
        const x = padLeft + (index * plotWidth) / Math.max(stageSeries.length - 1, 1)
        const y = yFor(pick(stage))
        return { x, y }
      })

    const actualPoints = buildPoints((stage) => stage.achieved)
    const targetPoints = buildPoints((stage) => stage.target)
    const actualPath = smoothLinePath(actualPoints)
    const targetPath = smoothLinePath(targetPoints)
    const areaPath = `${actualPath} L ${actualPoints.at(-1)?.x ?? 0} ${height - padBottom} L ${actualPoints[0]?.x ?? 0} ${height - padBottom} Z`

    const guideSteps = [1, 0.75, 0.5, 0.25, 0]
    const guides = guideSteps.map((step) => {
      const value = maxStagePoint * step
      return {
        y: yFor(value),
        label: num(value, 2),
      }
    })

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      guides,
      actualPoints,
      targetPoints,
      actualPath,
      targetPath,
      areaPath,
    }
  }, [stageSeries])

  const sellerBars = useMemo(() => snapshots.slice(0, 6), [snapshots])
  const maxSellerPoints = useMemo(
    () => Math.max(0.001, ...sellerBars.map((seller) => seller.pointsAchieved)),
    [sellerBars]
  )

  const donutModel = useMemo(() => {
    const radius = 44
    const circumference = 2 * Math.PI * radius
    const total = Math.max(1, statusSeries.reduce((sum, item) => sum + item.value, 0))
    const palette = ['#10b981', '#06b6d4', '#f59e0b', '#f43f5e']

    let offset = 0
    const segments = statusSeries.map((item, index) => {
      const ratio = item.value / total
      const length = ratio * circumference
      const segment = {
        ...item,
        color: palette[index % palette.length],
        dash: `${length} ${circumference - length}`,
        offset: -offset,
      }
      offset += length
      return segment
    })

    return {
      radius,
      circumference,
      total,
      segments,
    }
  }, [statusSeries])

  const sellerHeatmap = useMemo(
    () =>
      snapshots.slice(0, 5).map((snapshot) => {
        const cells = STAGES.filter((s) => s.key !== 'FULL').map((stage) => {
          const stageRules = stageRuleMap[stage.key] ?? []
          const stageTarget = stageRules.reduce((sum, rule) => sum + rule.points, 0)
          const stageAchieved = stageRules.reduce((sum, rule) => {
            const progress =
              snapshot.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
            return sum + rule.points * Math.min(progress, 1)
          }, 0)
          const ratio = stageTarget > 0 ? stageAchieved / stageTarget : 0
          return { stage: stage.label, ratio }
        })
        return { seller: snapshot.seller, cells }
      }),
    [snapshots, stageRuleMap]
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
      <Card className="relative overflow-hidden border-surface-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-surface-400" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500">Metas comerciais</p>
            <h1 className="mt-1 text-2xl font-semibold text-surface-900">PAINEL DE METAS - OURO VERDE</h1>
            <p className="mt-1 text-sm text-surface-600">Visão executiva de desempenho, progresso de metas e previsão de premiação.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setView((current) => (current === 'config' ? 'dashboard' : 'config'))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <Settings2 size={14} />
              {view === 'config' ? 'Voltar para dashboard' : 'Configuração geral de metas'}
            </button>
            <button
              type="button"
              onClick={() => setView((current) => (current === 'sellers' ? 'dashboard' : 'sellers'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
            >
              <Users size={14} />
              {view === 'sellers' ? 'Voltar para dashboard' : 'Vendedores da meta'}
            </button>
            <button
              type="button"
              onClick={() => setView((current) => (current === 'products' ? 'dashboard' : 'products'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50"
            >
              <Boxes size={14} />
              {view === 'products' ? 'Voltar para dashboard' : 'Produtos da meta'}
            </button>
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

              <div className="grid gap-3 md:grid-cols-3">
                <label className={label}>Mês<select className={input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}</select></label>
                <label className={label}>Ano<input className={input} type="number" min={2024} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
                <label className={label}>Início da 1ª semana<input className={input} type="date" min={`${year}-${String(month + 1).padStart(2, '0')}-01`} max={toIsoDate(new Date(year, month + 1, 0))} value={activeMonth?.week1StartDate ?? ''} onChange={(event) => setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: event.target.value, customOffDates: activeMonth?.customOffDates ?? [] } }))} /></label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={includeNational} onChange={(event) => setIncludeNational(event.target.checked)} /> Considerar feriados nacionais oficiais</label>
                <Badge variant="secondary">Dias úteis no mês: {cycle.totalBusinessDays}</Badge>
              </div>

              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Datas personalizadas de bloqueio</p>
                <div className="mt-2 flex gap-2">
                  <input type="date" className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customDate) return
                      const list = activeMonth?.customOffDates ?? []
                      if (list.includes(customDate)) return
                      setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: activeMonth?.week1StartDate ?? firstMonday(year, month), customOffDates: [...list, customDate].sort() } }))
                      setCustomDate('')
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                {(activeMonth?.customOffDates?.length ?? 0) > 0 ? <div className="mt-2 flex flex-wrap gap-2">{activeMonth?.customOffDates.map((date) => <button key={date} type="button" className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-surface-600 hover:bg-surface-100" onClick={() => setMonthConfigs((prev) => ({ ...prev, [activeKey]: { week1StartDate: activeMonth?.week1StartDate ?? firstMonday(year, month), customOffDates: (activeMonth?.customOffDates ?? []).filter((item) => item !== date) } }))}>{formatDateBr(date)} ×</button>)}</div> : null}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-4">{cycle.weeks.filter((w) => w.key !== 'FULL').map((week) => <div key={week.key} className="rounded-lg border border-surface-200 bg-white p-2.5 text-xs"><p className="font-semibold text-surface-700">{week.label}</p><p className="mt-1 text-surface-600">{formatDateBr(week.start)} - {formatDateBr(week.end)}</p><p className="text-surface-500">Dias úteis: {week.businessDays.length}</p></div>)}</div>

              {standby ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{!activeMonth?.week1StartDate ? 'Mês em standby: defina a data de início da 1ª semana para ativar o ciclo.' : `Mês selecionado encerrou em ${formatDateBr(cycle.lastBusinessDate)}. O sistema permanece em standby até configurar o início do mês seguinte.`}</div> : null}
            </Card>

            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2"><CircleDollarSign size={16} className="text-emerald-600" /><h2 className="text-base font-semibold text-surface-900">Parâmetros de premiação</h2></div>
              <label className={label}>Salário base<input className={input} type="number" step="0.01" value={salaryBase} onChange={(event) => setSalaryBase(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>Base de premiação<input className={input} type="number" step="0.01" value={basePremiation} onChange={(event) => setBasePremiation(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>Bônus extra de meta<input className={input} type="number" step="0.01" value={extraBonus} onChange={(event) => setExtraBonus(parseDecimal(event.target.value, 0))} /></label>
              <label className={label}>Pontos mínimos do bônus<input className={input} type="number" step="0.01" value={extraMinPoints} onChange={(event) => setExtraMinPoints(parseDecimal(event.target.value, 0))} /></label>
              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm text-surface-700">
                <p>Potencial de KPIs: <strong>{currency(rewardTarget)}</strong> | {num(pointsTarget, 3)} pts</p>
                <p>Base de premiação: <strong>{currency(basePremiation)}</strong></p>
              </div>
            </Card>
          </div>

          {/* ── Multi-block KPI system ─────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900">Blocos de regras de KPIs e metas</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                const source = ruleBlocks.find((b) => b.id === selectedBlockId) ?? ruleBlocks[0]
                const newId = `block-${Date.now()}`
                const cloned: RuleBlock = {
                  ...source,
                  id: newId,
                  title: `${source.title} (cópia)`,
                  sellerIds: [],
                  rules: source.rules.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
                }
                setRuleBlocks((prev) => [...prev, cloned])
                setSelectedBlockId(newId)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <Plus size={12} /> Novo bloco de KPIs
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
                      <Badge variant="secondary">Bloco padrão — aplica a vendedores não atribuídos</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                        onClick={() => {
                          setRuleBlocks((prev) => prev.filter((b) => b.id !== block.id))
                          setSelectedBlockId((prev) => prev === block.id ? ruleBlocks.find((b) => b.id !== block.id)?.id ?? '' : prev)
                        }}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Excluir bloco
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
                          <button type="button" onClick={() => updateBlock({ sellerIds: block.sellerIds.filter((id) => id !== s.id) })} className="ml-0.5 text-primary-400 hover:text-primary-700">✕</button>
                        </span>
                      ))}
                      <select
                        className="rounded-lg border border-dashed border-surface-300 bg-white px-2 py-1 text-xs text-surface-500"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return
                          updateBlock({ sellerIds: [...block.sellerIds, e.target.value] })
                        }}
                      >
                        <option value="">+ Adicionar vendedor</option>
                        {unassignedSellers.filter((s) => !block.sellerIds.includes(s.id)).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
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
                          <td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.kpiType ?? 'CUSTOM'} onChange={(e) => { const sel = KPI_CATALOG.find((k) => k.type === e.target.value); const defaultTarget = e.target.value === 'DISTRIBUICAO' ? '0%|0' : '0%'; updateBlockRule(rule.id, { kpiType: e.target.value as KpiType, kpi: sel?.label ?? rule.kpi, description: sel?.defaultDescription || rule.description, targetText: defaultTarget }) }}>{KPI_CATALOG.map((k) => <option key={k.type} value={k.type}>{k.label}</option>)}</select></td>
                          <td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.description} onChange={(e) => updateBlockRule(rule.id, { description: e.target.value })} /></td>
                          <td className="px-3 py-2">{rule.kpiType === 'DISTRIBUICAO' ? (() => {
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
                              </div>
                            )
                          })() : <input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.targetText} onChange={(e) => updateBlockRule(rule.id, { targetText: e.target.value })} />}</td>
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
                  <label className={label}>Tipo<select className={input} value={prize.type} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, type: event.target.value as PrizeType } : item))}><option value="CASH">Financeira</option><option value="BENEFIT">Benefício</option></select></label>
                  {prize.type === 'CASH' ? (
                    <label className={label}>Valor (R$)<input className={input} type="number" step="0.01" value={prize.rewardValue} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, rewardValue: parseDecimal(event.target.value, 0) } : item))} /></label>
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
          <Card className="relative overflow-hidden border-surface-200">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary-500" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left: month / year navigation */}
              <div className="flex items-center gap-3">
                <CalendarDays size={18} className="text-primary-600" />
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => {
                    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else { setMonth((m) => m - 1) }
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-baseline gap-2">
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  >
                    {MONTHS.map((name, idx) => (
                      <option key={name} value={idx}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
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
                    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else { setMonth((m) => m + 1) }
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => { const now = new Date(); setMonth(now.getMonth()); setYear(now.getFullYear()) }}
                  className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                >
                  Hoje
                </button>
              </div>

              {/* Right: status badge + business days */}
              <div className="flex items-center gap-3">
                {standby ? (
                  <Badge variant="secondary">
                    Período em standby — configure o calendário operacional
                  </Badge>
                ) : (
                  <>
                    <Badge variant="secondary">
                      {cycle.totalBusinessDays} dias úteis
                    </Badge>
                    {sellersLoading && (
                      <span className="text-xs text-surface-400">Carregando dados…</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Cycle weeks mini-bar */}
            {!standby && cycle.weeks.length > 0 && (
              <div className="mt-3 flex gap-2">
                {cycle.weeks.filter((w) => w.key !== 'FULL').map((week) => {
                  const today = toIsoDate(new Date())
                  const isActive = week.start && week.end && today >= week.start && today <= week.end
                  return (
                    <div
                      key={week.key}
                      className={`flex-1 rounded-lg border px-3 py-2 text-center transition-all ${
                        isActive
                          ? 'border-primary-300 bg-primary-50 ring-1 ring-primary-200'
                          : 'border-surface-200 bg-surface-50'
                      }`}
                    >
                      <div className={`mx-auto mb-1 h-1 w-8 rounded-full ${stageColorMap[week.key]}`} />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-surface-500">{week.label}</p>
                      <p className="text-xs font-medium text-surface-700">
                        {week.start ? `${formatDateBr(week.start)} – ${formatDateBr(week.end)}` : '—'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-surface-400">{week.businessDays.length} dias úteis</p>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Vendedores monitorados</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900 transition-transform duration-300 group-hover:scale-[1.02]">{snapshots.length}</p>
              <p className="mt-2 text-xs text-surface-500">Base ativa para gestão comercial</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta geral da fábrica</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{num(factoryGoalRatio * 100, 1)}%</p>
              <p className="mt-2 text-xs text-surface-600">{onTargetCount}/{snapshots.length || 0} vendedores meta batida</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta Batida ou acima</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{onTargetCount}</p>
              <p className="mt-2 text-xs text-surface-500">Colaboradores com aderência positiva</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Risco operacional</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{byStatus.critico + byStatus.atencao}</p>
              <p className="mt-2 text-xs text-surface-500">Vendedores que exigem acompanhamento</p>
            </Card>
          </div>

          <div className="mt-1 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-primary-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Pedidos no mês</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{num(corporateTotalOrders, 0)}</p>
              <p className="mt-2 text-xs text-surface-500">Consolidado empresarial dos vendedores monitorados</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Peso bruto total</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{num(corporateTotalGrossWeight, 2)} kg</p>
              <p className="mt-2 text-xs text-surface-500">Soma do peso bruto dos pedidos no período</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Faturamento total</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{currency(corporateTotalRevenue)}</p>
              <p className="mt-2 text-xs text-surface-500">Valor total dos pedidos no mês selecionado</p>
            </Card>

            <Card className={executiveMetricCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Ticket médio</p>
              <p className="mt-2 text-3xl font-semibold text-surface-900">{currency(corporateAverageTicket)}</p>
              <p className="mt-2 text-xs text-surface-500">Faturamento médio por pedido consolidado</p>
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

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                Tendência de evolução (linha)
              </p>
              <div className="mt-4 rounded-xl border border-surface-200 bg-gradient-to-b from-slate-50 to-white p-4">
                <svg
                  viewBox={`0 0 ${lineChartData.width} ${lineChartData.height}`}
                  className="h-52 w-full"
                >
                  <defs>
                    <linearGradient id="line-area-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                    </linearGradient>
                    <filter id="line-soft-shadow" x="-15%" y="-20%" width="130%" height="150%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1e3a8a" floodOpacity="0.18" />
                    </filter>
                  </defs>

                  {lineChartData.guides.map((guide) => (
                    <g key={`guide-${guide.y}`}>
                      <line
                        x1={lineChartData.padLeft}
                        x2={lineChartData.width - lineChartData.padRight}
                        y1={guide.y}
                        y2={guide.y}
                        stroke="#dbe4ef"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={lineChartData.padLeft - 8}
                        y={guide.y + 4}
                        textAnchor="end"
                        className="fill-surface-400 text-[9px] font-medium"
                      >
                        {guide.label}
                      </text>
                    </g>
                  ))}

                  <path d={lineChartData.areaPath} fill="url(#line-area-gradient)" />
                  <path
                    d={lineChartData.targetPath}
                    fill="none"
                    stroke="#0f766e"
                    strokeDasharray="6 5"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d={lineChartData.actualPath}
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    filter="url(#line-soft-shadow)"
                  />
                  {lineChartData.targetPoints.map((point, index) => (
                    <circle
                      key={`target-${STAGES[index].key}`}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      fill="#ffffff"
                      stroke="#0f766e"
                      strokeWidth="1.5"
                    />
                  ))}
                  {lineChartData.actualPoints.map((point, index) => (
                    <g key={`actual-${STAGES[index].key}`}>
                      <circle cx={point.x} cy={point.y} r="4.5" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1.4" />
                      <circle cx={point.x} cy={point.y} r="2.8" fill="#1d4ed8" />
                    </g>
                  ))}

                  {lineChartData.actualPoints.map((point, index) => (
                    <text
                      key={`label-${STAGES[index].key}`}
                      x={point.x}
                      y={lineChartData.height - 14}
                      textAnchor="middle"
                      className="fill-surface-500 text-[9px] font-semibold uppercase tracking-[0.06em]"
                    >
                      {STAGES[index].label}
                    </text>
                  ))}
                </svg>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-600">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Atingido médio</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-teal-700" />Meta planejada</span>
              </div>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                Ranking de pontuação
              </p>
              <div className="mt-4 space-y-1.5">
                {sellerBars.map((seller, idx) => {
                  const ratio = maxSellerPoints > 0 ? seller.pointsAchieved / maxSellerPoints : 0
                  const statusColor =
                    seller.status === 'SUPEROU' ? 'bg-emerald-500' :
                    seller.status === 'NO_ALVO' ? 'bg-cyan-500' :
                    seller.status === 'ATENCAO' ? 'bg-amber-500' : 'bg-rose-500'
                  const statusBorder =
                    seller.status === 'SUPEROU' ? 'border-emerald-200' :
                    seller.status === 'NO_ALVO' ? 'border-cyan-200' :
                    seller.status === 'ATENCAO' ? 'border-amber-200' : 'border-rose-200'
                  return (
                    <div key={seller.seller.id} className={`group flex items-center gap-3 rounded-lg border ${statusBorder} bg-white px-3 py-2 transition-colors hover:bg-surface-50`}>
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-surface-400">{idx + 1}º</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-surface-800">{seller.seller.name}</span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-surface-700">{num(seller.pointsAchieved, 2)} pts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-200">
                            <div className={`h-full rounded-full ${statusColor} transition-[width] duration-700`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                          </div>
                          <span className="shrink-0 text-[10px] font-medium tabular-nums text-surface-500">{num(ratio * 100, 0)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {sellerBars.length === 0 && (
                  <p className="py-4 text-center text-xs text-surface-400">Nenhum vendedor encontrado</p>
                )}
              </div>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                Composição de status (pizza)
              </p>
              <div className="mt-4 flex items-center gap-4 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0">
                  <circle cx="60" cy="60" r={donutModel.radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
                  <g transform="rotate(-90 60 60)">
                    {donutModel.segments.map((segment) => (
                      <circle
                        key={segment.label}
                        cx="60"
                        cy="60"
                        r={donutModel.radius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="14"
                        strokeDasharray={segment.dash}
                        strokeDashoffset={segment.offset}
                      />
                    ))}
                  </g>
                  <text x="60" y="56" textAnchor="middle" className="fill-surface-500 text-[9px] font-semibold uppercase tracking-[0.08em]">
                    Geral
                  </text>
                  <text x="60" y="72" textAnchor="middle" className="fill-surface-900 text-[14px] font-bold">
                    {num(factoryGoalRatio * 100, 0)}%
                  </text>
                </svg>
                <div className="flex-1 space-y-2">
                  {donutModel.segments.map((segment) => (
                    <div key={`legend-${segment.label}`} className="flex items-center justify-between text-xs text-surface-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                        {segment.label}
                      </span>
                      <span className="font-semibold">{segment.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                Mapa de calor por etapa
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="min-w-[420px] space-y-2">
                  <div className="grid grid-cols-[1.3fr_repeat(4,1fr)] gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                    <span>Vendedor</span>
                    {STAGES.map((stage) => (
                      <span key={`head-${stage.key}`} className="text-center">{stage.label}</span>
                    ))}
                  </div>
                  {sellerHeatmap.map((row) => (
                    <div key={`heat-${row.seller.id}`} className="grid grid-cols-[1.3fr_repeat(4,1fr)] gap-2">
                      <div className="truncate rounded-md border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700">{row.seller.name}</div>
                      {row.cells.map((cell) => (
                        <div key={`cell-${row.seller.id}-${cell.stage}`} className={`rounded-md px-2 py-1 text-center text-[11px] font-semibold ${heatCellClass(cell.ratio)}`}>
                          {num(cell.ratio * 100, 0)}%
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta corporativa da fábrica</p>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-200/90">
                <div className="h-full bg-surface-600 transition-[width] duration-700" style={{ width: `${Math.min(factoryGoalRatio * 100, 100)}%` }} />
              </div>
              <p className="mt-3 text-sm font-medium text-surface-700">Critério: todos os vendedores precisam bater a meta.</p>
              <p className="mt-1 text-xs text-surface-600">{factoryGoalMet ? 'Meta geral atingida.' : `Faltam ${factoryGap} vendedor(es) para atingir a meta geral.`}</p>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Distribuição por status</p>
              <div className="mt-4 space-y-2.5">
                {statusSeries.map((item) => {
                  const ratio = snapshots.length > 0 ? item.value / snapshots.length : 0
                  return (
                    <div key={item.label} className="rounded-lg border border-surface-200/70 bg-white/80 px-2.5 py-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-surface-600"><span>{item.label}</span><span className="font-semibold">{item.value}</span></div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-200">
                        <div className={`h-full transition-[width] duration-700 ${item.color}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Aderência por etapa</p>
              <div className="mt-4 space-y-2.5">
                {stageSeries.map((stage) => (
                  <div key={stage.key} className="rounded-lg border border-surface-200/70 bg-white/80 px-2.5 py-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-surface-600"><span>{stage.label}</span><span className="font-semibold">{num(stage.achieved, 3)} / {num(stage.target, 3)} pts</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-200">
                      <div
                        className={`h-full transition-[width] duration-700 ${stageColorMap[stage.key as StageKey]}`}
                        style={{ width: `${Math.min(stage.ratio * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              <div className="mb-4 flex items-center gap-2"><Users size={16} className="text-surface-600" /><h2 className="text-lg font-semibold text-surface-900">Desempenho individual de vendedores</h2></div>
              <div className="space-y-2.5">
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
                  snapshots.map((snapshot) => {
                    const ratio = snapshot.pointsTarget > 0 ? snapshot.pointsAchieved / snapshot.pointsTarget : 0
                    return (
                      <button
                        type="button"
                        key={snapshot.seller.id}
                        onClick={() => setSelectedSellerId(snapshot.seller.id)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-300 ${
                          selectedSeller?.seller.id === snapshot.seller.id
                            ? 'border-surface-300 bg-surface-50 shadow-sm'
                            : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900">{snapshot.seller.name}</p>
                            <p className="text-xs text-surface-500">{snapshot.seller.login}</p>
                          </div>
                          <Badge
                            variant={
                              snapshot.status === 'SUPEROU' || snapshot.status === 'NO_ALVO'
                                ? 'success'
                                : snapshot.status === 'ATENCAO'
                                  ? 'warning'
                                  : 'error'
                            }
                          >
                            {statusLabel[snapshot.status]}
                          </Badge>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-200">
                          <div className="h-full bg-surface-600 transition-[width] duration-700" style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-surface-600">
                          <span>
                            {num(snapshot.pointsAchieved, 3)} / {num(snapshot.pointsTarget, 3)} pts
                          </span>
                          <span>Faltam {num(snapshot.gapToTarget, 3)} pts</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </Card>

            <Card className={executivePanelCardClass}>
              <div className="absolute inset-x-0 top-0 h-1 bg-surface-300" />
              {selectedSeller ? (
                <>
                  <div className="mb-4 flex items-center gap-2"><UserRound size={16} className="text-surface-600" /><h2 className="text-[1.65rem] font-semibold leading-none text-surface-900">{selectedSeller.seller.name}</h2></div>
                  <div className="mb-2"><Badge variant="secondary">{findBlockForSeller(selectedSeller.seller.id, ruleBlocks).title}</Badge></div>
                  <div className="grid gap-2">
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Pontuação:</span> {num(selectedSeller.pointsAchieved, 3)} / {num(selectedSeller.pointsTarget, 3)} pts</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Pedidos no mês:</span> {num(selectedSeller.totalOrders, 0)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Faturamento no mês:</span> {currency(selectedSeller.totalValue)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Peso bruto no mês:</span> {num(selectedSeller.totalGrossWeight, 2)} kg</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Premiação por KPIs:</span> {currency(selectedSeller.rewardAchieved)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Campanhas elegíveis:</span> {currency(selectedCampaignProjection)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Gap para meta:</span> {num(selectedSeller.gapToTarget, 3)} pts</div>
                  </div>
                  <div className="mt-3 space-y-2">{(() => { const sellerBlock = findBlockForSeller(selectedSeller.seller.id, ruleBlocks); return sellerBlock.rules.map((rule) => { const progress = selectedSeller.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0; const done = progress >= 1; return <div key={rule.id} className="rounded-lg border border-surface-200 bg-white px-3 py-2 shadow-sm transition-colors hover:border-surface-300"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-surface-800">{rule.kpi} ({rule.targetText})</p>{done ? <TrendingUp size={14} className="text-surface-600" /> : <TrendingDown size={14} className="text-surface-500" />}</div><p className="text-[11px] text-surface-500">{rule.description}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-200"><div className={`h-full transition-[width] duration-700 ${done ? 'bg-surface-600' : 'bg-surface-500'}`} style={{ width: `${Math.min(progress * 100, 100)}%` }} /></div></div>}) })()}</div>
                </>
              ) : (
                <p className="text-sm text-surface-500">Selecione um vendedor para ver detalhes.</p>
              )}
            </Card>
          </div>

          <Card className="border-surface-200">
            <p className="text-xs text-surface-600">Período monitorado: {MONTHS[month]}/{year}. O ciclo considera somente dias úteis dentro do mês selecionado e semanas fixas por janela de segunda a sexta. Após o último dia útil, entra em standby aguardando a definição do início do próximo mês.</p>
          </Card>
        </>
      )}
    </div>
  )
}
