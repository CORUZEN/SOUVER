'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
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

type StageKey = 'W1' | 'W2' | 'W3' | 'CLOSING'
type RuleFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
type PrizeType = 'CASH' | 'BENEFIT'

interface GoalRule {
  id: string
  stage: StageKey
  frequency: RuleFrequency
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
  minPoints: number
  active: boolean
}

interface MonthConfig {
  week1StartDate: string
  customOffDates: string[]
}

interface SellerOrder {
  orderNumber: string
  negotiatedAt: string
  totalValue: number
}

interface Salesperson {
  id: string
  name: string
  login: string
  orders: SellerOrder[]
  totalValue: number
  totalOrders: number
}

interface SellerAllowlistEntry {
  code: string | null
  partnerCode: string | null
  name: string
  active: boolean
}

interface RuleProgress {
  ruleId: string
  progress: number
}

interface SellerSnapshot {
  seller: Salesperson
  totalOrders: number
  totalValue: number
  averageTicket: number
  pointsAchieved: number
  pointsTarget: number
  rewardAchieved: number
  rewardTarget: number
  status: 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'
  gapToTarget: number
  ruleProgress: RuleProgress[]
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
]

const DEFAULT_RULES: GoalRule[] = [
  { id: 'w1-base', stage: 'W1', frequency: 'WEEKLY', kpi: 'Base de clientes', description: 'Cobertura da base até o fechamento da 1ª semana.', targetText: '40%', rewardValue: 193.49, points: 0.04 },
  { id: 'w1-volume', stage: 'W1', frequency: 'WEEKLY', kpi: 'Volume', description: 'Categorias no período da 1ª semana.', targetText: '2 categorias', rewardValue: 145.12, points: 0.03 },
  { id: 'w2-base', stage: 'W2', frequency: 'WEEKLY', kpi: 'Base de clientes', description: 'Cobertura da base até o fechamento da 2ª semana.', targetText: '80%', rewardValue: 193.49, points: 0.04 },
  { id: 'w3-dist', stage: 'W3', frequency: 'WEEKLY', kpi: 'Distribuição de itens', description: 'Positivação da base na 3ª semana.', targetText: '27 itens', rewardValue: 483.73, points: 0.1 },
  { id: 'closing-fin', stage: 'CLOSING', frequency: 'MONTHLY', kpi: 'Meta financeira', description: 'Atingir meta financeira no fechamento do mês.', targetText: '100%', rewardValue: 96.75, points: 0.02 },
  { id: 'closing-margin', stage: 'CLOSING', frequency: 'MONTHLY', kpi: 'Rentabilidade', description: 'Margem de contribuição dentro da parametrização.', targetText: '33%', rewardValue: 967.46, points: 0.2 },
]

const DEFAULT_PRIZES: CampaignPrize[] = [
  { id: 'month', title: 'Campanha VDD do mês', frequency: 'MONTHLY', type: 'CASH', rewardValue: 1000, minPoints: 0.6, active: true },
  { id: 'quarter', title: 'Campanha VDD do trimestre', frequency: 'QUARTERLY', type: 'BENEFIT', rewardValue: 0, minPoints: 18, active: true },
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

  STAGES.forEach((stage, index) => {
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

  let lastBusinessDate: string | null = null
  for (let d = new Date(monthEnd); d >= monthStart; d = addDays(d, -1)) {
    const wd = d.getDay()
    const iso = toIsoDate(d)
    if (wd >= 1 && wd <= 5 && !blocked.has(iso)) {
      lastBusinessDate = iso
      break
    }
  }

  const totalBusinessDays = weeks.reduce((sum, week) => sum + week.businessDays.length, 0)
  return { weeks, totalBusinessDays, lastBusinessDate }
}

function hasMonthEnded(year: number, month: number) {
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return new Date().getTime() > monthEnd.getTime()
}

export default function MetasWorkspace() {
  const now = new Date()
  const [view, setView] = useState<'dashboard' | 'config' | 'sellers'>('dashboard')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [includeNational, setIncludeNational] = useState(true)
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthConfig>>({})
  const [rules, setRules] = useState<GoalRule[]>(DEFAULT_RULES)
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
  const [allowlist, setAllowlist] = useState<SellerAllowlistEntry[]>([])
  const [allowlistLoading, setAllowlistLoading] = useState(false)
  const [allowlistSaving, setAllowlistSaving] = useState(false)
  const [allowlistSyncing, setAllowlistSyncing] = useState(false)
  const [allowlistError, setAllowlistError] = useState('')
  const [allowlistSuccess, setAllowlistSuccess] = useState('')

  const activeKey = monthKey(year, month)
  const activeMonth = monthConfigs[activeKey]
  const input = 'mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      if (typeof data.year === 'number') setYear(data.year)
      if (typeof data.month === 'number') setMonth(data.month)
      if (typeof data.includeNational === 'boolean') setIncludeNational(data.includeNational)
      if (data.monthConfigs && typeof data.monthConfigs === 'object') setMonthConfigs(data.monthConfigs as Record<string, MonthConfig>)
      if (Array.isArray(data.rules)) setRules(data.rules as GoalRule[])
      if (Array.isArray(data.prizes)) setPrizes(data.prizes as CampaignPrize[])
      if (typeof data.salaryBase === 'number') setSalaryBase(data.salaryBase)
      if (typeof data.basePremiation === 'number') setBasePremiation(data.basePremiation)
      if (typeof data.extraBonus === 'number') setExtraBonus(data.extraBonus)
      if (typeof data.extraMinPoints === 'number') setExtraMinPoints(data.extraMinPoints)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year, month, includeNational, monthConfigs, rules, prizes, salaryBase, basePremiation, extraBonus, extraMinPoints })
    )
  }, [basePremiation, extraBonus, extraMinPoints, includeNational, month, monthConfigs, prizes, rules, salaryBase, year])

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
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number }>
        }>

        const mapped = remoteSellers.map((seller) => {
          const normalizedOrders = (seller.orders ?? [])
            .filter((order) => typeof order.negotiatedAt === 'string' && order.negotiatedAt.length >= 10)
            .map((order) => ({
              orderNumber: String(order.orderNumber ?? ''),
              negotiatedAt: String(order.negotiatedAt).slice(0, 10),
              totalValue: Number(order.totalValue ?? 0),
            }))

          return {
            id: seller.id,
            name: seller.name,
            login: seller.login,
            totalValue: Number(seller.totalValue ?? 0),
            totalOrders: Number(seller.totalOrders ?? normalizedOrders.length),
            orders: normalizedOrders,
          }
        })

        setSellers(mapped)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSellers([])
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
          totalOrders?: number
          orders?: Array<{ orderNumber?: string; negotiatedAt?: string; totalValue?: number }>
        }>
        setSellers(
          remoteSellers.map((seller) => ({
            id: seller.id,
            name: seller.name,
            login: seller.login,
            totalValue: Number(seller.totalValue ?? 0),
            totalOrders: Number(seller.totalOrders ?? (seller.orders ?? []).length),
            orders: (seller.orders ?? [])
              .filter((order) => typeof order.negotiatedAt === 'string' && order.negotiatedAt.length >= 10)
              .map((order) => ({
                orderNumber: String(order.orderNumber ?? ''),
                negotiatedAt: String(order.negotiatedAt).slice(0, 10),
                totalValue: Number(order.totalValue ?? 0),
              })),
          }))
        )
      }
      setSellersLoading(false)
    } catch (error) {
      setAllowlistError(error instanceof Error ? error.message : 'Falha ao salvar vendedores da meta.')
    } finally {
      setAllowlistSaving(false)
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
    const teamAverageValue =
      sellers.length > 0 ? sellers.reduce((sum, seller) => sum + seller.totalValue, 0) / sellers.length : 0

    const teamAverageTicket = (() => {
      const tickets = sellers
        .filter((seller) => seller.totalOrders > 0)
        .map((seller) => seller.totalValue / Math.max(seller.totalOrders, 1))
      if (tickets.length === 0) return 0
      return tickets.reduce((sum, value) => sum + value, 0) / tickets.length
    })()

    return sellers
      .map((seller) => {
        const stageMetrics = STAGES.reduce(
          (acc, stage) => {
            acc[stage.key] = { orderCount: 0, totalValue: 0 }
            return acc
          },
          {} as Record<StageKey, { orderCount: number; totalValue: number }>
        )

        for (const order of seller.orders) {
          const stage = findStageForDate(order.negotiatedAt, cycle.weeks)
          if (!stage) continue
          stageMetrics[stage].orderCount += 1
          stageMetrics[stage].totalValue += order.totalValue
        }

        const averageTicket = seller.totalOrders > 0 ? seller.totalValue / seller.totalOrders : 0
        const totalValueSafe = Math.max(seller.totalValue, 0.00001)
        const teamAverageValueSafe = Math.max(teamAverageValue, 0.00001)
        const teamAverageTicketSafe = Math.max(teamAverageTicket, 0.00001)

        const ruleProgress = rules.map((rule) => {
          const targetPct =
            rule.targetText.includes('%') && parseTargetNumber(rule.targetText)
              ? Math.max((parseTargetNumber(rule.targetText) ?? 0) / 100, 0.00001)
              : null
          const targetAmount = parseTargetNumber(rule.targetText)
          const stage = stageMetrics[rule.stage]
          const kpi = rule.kpi.toLowerCase()
          let progress = 0

          if (kpi.includes('meta financeira')) {
            progress = seller.totalValue / teamAverageValueSafe
          } else if (kpi.includes('rentabilidade')) {
            progress = (averageTicket / teamAverageTicketSafe) / (targetPct ?? 1)
          } else if (targetPct !== null) {
            const stageShare = stage.totalValue / totalValueSafe
            progress = stageShare / targetPct
          } else if (targetAmount && targetAmount > 0) {
            progress = stage.orderCount / targetAmount
          } else {
            progress = stage.orderCount > 0 ? 1 : 0
          }

          return { ruleId: rule.id, progress: Math.max(0, Math.min(progress, 1.4)) }
        })

        const pointsAchieved = rules.reduce((sum, rule) => {
          const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
          return sum + rule.points * Math.min(progress, 1)
        }, 0)

        const rewardAchieved = rules.reduce((sum, rule) => {
          const progress = ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0
          return sum + (progress >= 1 ? rule.rewardValue : 0)
        }, 0)

        const ratio = pointsTarget > 0 ? pointsAchieved / pointsTarget : 0
        const status: SellerSnapshot['status'] = ratio >= 1.05 ? 'SUPEROU' : ratio >= 0.85 ? 'NO_ALVO' : ratio >= 0.65 ? 'ATENCAO' : 'CRITICO'

        return {
          seller,
          totalOrders: seller.totalOrders,
          totalValue: seller.totalValue,
          averageTicket,
          pointsAchieved,
          pointsTarget,
          rewardAchieved,
          rewardTarget,
          status,
          gapToTarget: Math.max(pointsTarget - pointsAchieved, 0),
          ruleProgress,
        }
      })
      .sort((a, b) => b.pointsAchieved - a.pointsAchieved)
  }, [cycle.weeks, pointsTarget, rewardTarget, rules, sellers])

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
      STAGES.map((stage) => {
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
        STAGES.map((stage) => [stage.key, rules.filter((rule) => rule.stage === stage.key)])
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
        const cells = STAGES.map((stage) => {
          const stageRules = stageRuleMap[stage.key]
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

              <div className="mt-3 grid gap-2 md:grid-cols-4">{cycle.weeks.map((week) => <div key={week.key} className="rounded-lg border border-surface-200 bg-white p-2.5 text-xs"><p className="font-semibold text-surface-700">{week.label}</p><p className="mt-1 text-surface-600">{formatDateBr(week.start)} - {formatDateBr(week.end)}</p><p className="text-surface-500">Dias úteis: {week.businessDays.length}</p></div>)}</div>

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

          <Card className="border-surface-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Target size={16} className="text-primary-600" /><h2 className="text-base font-semibold text-surface-900">Matriz de KPIs e metas</h2></div>
              <button type="button" onClick={() => setRules((prev) => [...prev, { id: `rule-${Date.now()}`, stage: 'W1', frequency: 'WEEKLY', kpi: 'Novo KPI', description: 'Descreva a regra', targetText: '0%', rewardValue: 0, points: 0 }])} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={12} /> Novo KPI</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200 text-sm">
                <thead><tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500"><th className="px-3 py-2">Período</th><th className="px-3 py-2">Freq.</th><th className="px-3 py-2">KPI</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Parâmetro</th><th className="px-3 py-2">Premiação</th><th className="px-3 py-2">Pontos</th></tr></thead>
                <tbody className="divide-y divide-surface-100">{rules.map((rule) => <tr key={rule.id}><td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.stage} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, stage: event.target.value as StageKey } : item))}>{STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></td><td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.frequency} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, frequency: event.target.value as RuleFrequency } : item))}><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option></select></td><td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.kpi} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, kpi: event.target.value } : item))} /></td><td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.description} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, description: event.target.value } : item))} /></td><td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.targetText} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, targetText: event.target.value } : item))} /></td><td className="px-3 py-2"><input className="w-24 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.01" value={rule.rewardValue} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, rewardValue: parseDecimal(event.target.value, 0) } : item))} /></td><td className="px-3 py-2"><input className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.001" value={rule.points} onChange={(event) => setRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, points: parseDecimal(event.target.value, 0) } : item))} /></td></tr>)}</tbody>
              </table>
            </div>
          </Card>

          <Card className="border-surface-200">
            <h2 className="mb-3 text-base font-semibold text-surface-900">Campanhas de premiação (mensal e trimestral)</h2>
            <div className="space-y-2">
              {prizes.map((prize) => <div key={prize.id} className="grid gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 md:grid-cols-6 md:items-end"><label className={label}>Campanha<input className={input} value={prize.title} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, title: event.target.value } : item))} /></label><label className={label}>Frequência<select className={input} value={prize.frequency} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, frequency: event.target.value as CampaignPrize['frequency'] } : item))}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option></select></label><label className={label}>Tipo<select className={input} value={prize.type} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, type: event.target.value as PrizeType } : item))}><option value="CASH">Financeira</option><option value="BENEFIT">Benefício</option></select></label><label className={label}>Valor<input className={input} type="number" step="0.01" value={prize.rewardValue} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, rewardValue: parseDecimal(event.target.value, 0) } : item))} /></label><label className={label}>Pontos mínimos<input className={input} type="number" step="0.01" value={prize.minPoints} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, minPoints: parseDecimal(event.target.value, 0) } : item))} /></label><label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={prize.active} onChange={(event) => setPrizes((prev) => prev.map((item) => item.id === prize.id ? { ...item, active: event.target.checked } : item))} /> Ativa</label></div>)}
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
                            <input
                              className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs"
                              value={seller.name}
                              onChange={(event) =>
                                setAllowlist((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, name: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs"
                              value={seller.code ?? ''}
                              onChange={(event) =>
                                setAllowlist((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, code: event.target.value || null } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs"
                              value={seller.partnerCode ?? ''}
                              onChange={(event) =>
                                setAllowlist((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, partnerCode: event.target.value || null } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setAllowlist((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
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
      ) : (
        <>
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
                Pontuação por vendedor (barras)
              </p>
              <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="flex h-36 items-end gap-2">
                  {sellerBars.map((seller) => {
                    const ratio = seller.pointsAchieved / maxSellerPoints
                    return (
                      <div key={seller.seller.id} className="flex flex-1 flex-col items-center gap-2">
                        <div className="relative w-full rounded-t-md bg-gradient-to-t from-blue-700 to-cyan-500 transition-all duration-700" style={{ height: `${Math.max(8, ratio * 100)}%` }}>
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-surface-600">
                            {num(seller.pointsAchieved, 2)}
                          </span>
                        </div>
                        <span className="line-clamp-1 max-w-full text-[10px] text-surface-500">{seller.seller.name.split(' ')[0]}</span>
                      </div>
                    )
                  })}
                </div>
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
                  <div className="grid gap-2">
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Pontuação:</span> {num(selectedSeller.pointsAchieved, 3)} / {num(selectedSeller.pointsTarget, 3)} pts</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Pedidos no mês:</span> {num(selectedSeller.totalOrders, 0)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Faturamento no mês:</span> {currency(selectedSeller.totalValue)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Premiação por KPIs:</span> {currency(selectedSeller.rewardAchieved)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Campanhas elegíveis:</span> {currency(selectedCampaignProjection)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-700"><span className="font-medium">Gap para meta:</span> {num(selectedSeller.gapToTarget, 3)} pts</div>
                  </div>
                  <div className="mt-3 space-y-2">{rules.map((rule) => { const progress = selectedSeller.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0; const done = progress >= 1; return <div key={rule.id} className="rounded-lg border border-surface-200 bg-white px-3 py-2 shadow-sm transition-colors hover:border-surface-300"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-surface-800">{rule.kpi} ({rule.targetText})</p>{done ? <TrendingUp size={14} className="text-surface-600" /> : <TrendingDown size={14} className="text-surface-500" />}</div><p className="text-[11px] text-surface-500">{rule.description}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-200"><div className={`h-full transition-[width] duration-700 ${done ? 'bg-surface-600' : 'bg-surface-500'}`} style={{ width: `${Math.min(progress * 100, 100)}%` }} /></div></div>})}</div>
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
