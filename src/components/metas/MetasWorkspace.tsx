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

interface Salesperson {
  id: string
  name: string
  login: string
}

interface RuleProgress {
  ruleId: string
  progress: number
}

interface SellerSnapshot {
  seller: Salesperson
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

const MOCK_SELLERS: Salesperson[] = [
  { id: 's1', name: 'Ana Oliveira', login: 'ana.oliveira' },
  { id: 's2', name: 'Bruno Santos', login: 'bruno.santos' },
  { id: 's3', name: 'Carla Nascimento', login: 'carla.nascimento' },
  { id: 's4', name: 'Diego Rocha', login: 'diego.rocha' },
  { id: 's5', name: 'Elisa Mendes', login: 'elisa.mendes' },
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

function hash(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
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
  const [view, setView] = useState<'dashboard' | 'config'>('dashboard')
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
  const [sellers, setSellers] = useState<Salesperson[]>(MOCK_SELLERS)
  const [selectedSellerId, setSelectedSellerId] = useState(MOCK_SELLERS[0].id)

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
    fetch('/api/users?limit=50')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const users = (data?.users ?? []) as Array<{ id: string; fullName?: string; name?: string; login: string; isActive?: boolean }>
        const mapped = users
          .filter((user) => user.isActive !== false)
          .map((user) => ({ id: user.id, name: user.fullName ?? user.name ?? user.login, login: user.login }))
        if (mapped.length > 0) setSellers(mapped)
      })
      .catch(() => null)
  }, [])

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
    return sellers
      .map((seller) => {
        const ruleProgress = rules.map((rule) => ({
          ruleId: rule.id,
          progress: 0.45 + (hash(`${activeKey}-${seller.id}-${rule.id}`) % 70) / 100,
        }))

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
  }, [activeKey, pointsTarget, rewardTarget, rules, sellers])

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

  const onTargetCount = byStatus.superou + byStatus.noAlvo
  const factoryGoalRatio = snapshots.length > 0 ? onTargetCount / snapshots.length : 0
  const factoryGoalMet = snapshots.length > 0 && onTargetCount === snapshots.length
  const factoryGap = Math.max(snapshots.length - onTargetCount, 0)

  const statusSeries = useMemo(
    () => [
      { label: 'Superou', value: byStatus.superou, color: 'bg-emerald-500' },
      { label: 'No alvo', value: byStatus.noAlvo, color: 'bg-blue-500' },
      { label: 'Atenção', value: byStatus.atencao, color: 'bg-amber-500' },
      { label: 'Crítico', value: byStatus.critico, color: 'bg-red-500' },
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Card className="relative overflow-hidden border-surface-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary-600 via-emerald-500 to-cyan-500" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500">Módulo de metas comerciais</p>
            <h1 className="mt-1 text-2xl font-semibold text-surface-900">Dashboard de metas por vendedor</h1>
            <p className="mt-1 text-sm text-surface-600">Visão executiva de desempenho individual, progresso de metas e previsão de premiação.</p>
          </div>
          <button
            type="button"
            onClick={() => setView((current) => (current === 'dashboard' ? 'config' : 'dashboard'))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Settings2 size={14} />
            {view === 'dashboard' ? 'Configuração geral de metas' : 'Voltar para dashboard'}
          </button>
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
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-surface-200"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Vendedores monitorados</p><p className="mt-1 text-2xl font-semibold text-surface-900">{snapshots.length}</p></Card>
            <Card className="border-surface-200"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta geral da fábrica</p><p className={`mt-1 text-2xl font-semibold ${factoryGoalMet ? 'text-emerald-700' : 'text-amber-700'}`}>{num(factoryGoalRatio * 100, 1)}%</p><p className="mt-1 text-xs text-surface-600">{onTargetCount}/{snapshots.length || 0} vendedores no alvo</p></Card>
            <Card className="border-surface-200"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">No alvo ou acima</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{onTargetCount}</p></Card>
            <Card className="border-surface-200"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Risco operacional</p><p className="mt-1 text-2xl font-semibold text-red-700">{byStatus.critico + byStatus.atencao}</p></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-surface-200">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Meta corporativa da fábrica</p>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-200">
                <div className={`h-full ${factoryGoalMet ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(factoryGoalRatio * 100, 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-surface-700">Critério: todos os vendedores precisam ficar em `No alvo` ou `Superou`.</p>
              <p className="mt-1 text-xs text-surface-600">{factoryGoalMet ? 'Meta geral atingida.' : `Faltam ${factoryGap} vendedor(es) para atingir a meta geral.`}</p>
            </Card>

            <Card className="border-surface-200">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Distribuição por status</p>
              <div className="mt-3 space-y-2">
                {statusSeries.map((item) => {
                  const ratio = snapshots.length > 0 ? item.value / snapshots.length : 0
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-surface-600"><span>{item.label}</span><span>{item.value}</span></div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-200">
                        <div className={`h-full ${item.color}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="border-surface-200">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Aderência por etapa</p>
              <div className="mt-3 space-y-2">
                {stageSeries.map((stage) => (
                  <div key={stage.key}>
                    <div className="mb-1 flex items-center justify-between text-xs text-surface-600"><span>{stage.label}</span><span>{num(stage.achieved, 3)} / {num(stage.target, 3)} pts</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-200">
                      <div className={`h-full ${stage.ratio >= 1 ? 'bg-emerald-500' : stage.ratio >= 0.8 ? 'bg-blue-500' : stage.ratio >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(stage.ratio * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="border-surface-200">
            <p className="text-xs text-surface-600">Período monitorado: {MONTHS[month]}/{year}. O ciclo considera somente dias úteis dentro do mês selecionado e semanas fixas por janela de segunda a sexta. Após o último dia útil, entra em standby aguardando a definição do início do próximo mês.</p>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-surface-200">
              <div className="mb-3 flex items-center gap-2"><Users size={16} className="text-primary-600" /><h2 className="text-base font-semibold text-surface-900">Desempenho individual de vendedores</h2></div>
              <div className="space-y-2">{snapshots.map((snapshot) => { const ratio = snapshot.pointsTarget > 0 ? snapshot.pointsAchieved / snapshot.pointsTarget : 0; return <button type="button" key={snapshot.seller.id} onClick={() => setSelectedSellerId(snapshot.seller.id)} className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${selectedSeller?.seller.id === snapshot.seller.id ? 'border-primary-300 bg-primary-50' : 'border-surface-200 bg-white hover:bg-surface-50'}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-surface-900">{snapshot.seller.name}</p><p className="text-xs text-surface-500">{snapshot.seller.login}</p></div><Badge variant={snapshot.status === 'SUPEROU' || snapshot.status === 'NO_ALVO' ? 'success' : snapshot.status === 'ATENCAO' ? 'warning' : 'error'}>{snapshot.status}</Badge></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-200"><div className={`h-full ${ratio >= 1 ? 'bg-emerald-500' : ratio >= 0.8 ? 'bg-blue-500' : ratio >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} /></div><div className="mt-1 flex items-center justify-between text-xs text-surface-600"><span>{num(snapshot.pointsAchieved, 3)} / {num(snapshot.pointsTarget, 3)} pts</span><span>Faltam {num(snapshot.gapToTarget, 3)} pts</span></div></button>})}</div>
            </Card>

            <Card className="border-surface-200">
              {selectedSeller ? (
                <>
                  <div className="mb-3 flex items-center gap-2"><UserRound size={16} className="text-primary-600" /><h2 className="text-base font-semibold text-surface-900">{selectedSeller.seller.name}</h2></div>
                  <div className="grid gap-2">
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700"><span className="font-medium">Pontuação:</span> {num(selectedSeller.pointsAchieved, 3)} / {num(selectedSeller.pointsTarget, 3)} pts</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700"><span className="font-medium">Premiação por KPIs:</span> {currency(selectedSeller.rewardAchieved)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700"><span className="font-medium">Campanhas elegíveis:</span> {currency(selectedCampaignProjection)}</div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700"><span className="font-medium">Gap para meta:</span> {num(selectedSeller.gapToTarget, 3)} pts</div>
                  </div>
                  <div className="mt-3 space-y-2">{rules.map((rule) => { const progress = selectedSeller.ruleProgress.find((item) => item.ruleId === rule.id)?.progress ?? 0; const done = progress >= 1; return <div key={rule.id} className="rounded-lg border border-surface-200 bg-white px-3 py-2"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-surface-800">{rule.kpi} ({rule.targetText})</p>{done ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-amber-600" />}</div><p className="text-[11px] text-surface-500">{rule.description}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-200"><div className={`h-full ${done ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progress * 100, 100)}%` }} /></div></div>})}</div>
                </>
              ) : (
                <p className="text-sm text-surface-500">Selecione um vendedor para ver detalhes.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
