'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Target, Trash2, Trophy } from 'lucide-react'
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

interface HolidayInfo {
  date: string
  name: string
}

const STORAGE_KEY = 'metas-workspace-v1'
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const STAGES: Array<{ key: StageKey; label: string }> = [
  { key: 'W1', label: '1ª Semana' },
  { key: 'W2', label: '2ª Semana' },
  { key: 'W3', label: '3ª Semana' },
  { key: 'CLOSING', label: 'Fechamento' },
]

const DEFAULT_RULES: GoalRule[] = [
  { id: 'w1-base', stage: 'W1', frequency: 'WEEKLY', kpi: 'Base de clientes', description: 'Cobertura da base até fechamento da 1ª semana.', targetText: '40%', rewardValue: 193.49, points: 0.04 },
  { id: 'w1-volume', stage: 'W1', frequency: 'WEEKLY', kpi: 'Volume', description: 'Categorias no período da 1ª semana.', targetText: '2 categorias', rewardValue: 145.12, points: 0.03 },
  { id: 'w2-base', stage: 'W2', frequency: 'WEEKLY', kpi: 'Base de clientes', description: 'Cobertura da base até fechamento da 2ª semana.', targetText: '80%', rewardValue: 193.49, points: 0.04 },
  { id: 'w3-dist', stage: 'W3', frequency: 'WEEKLY', kpi: 'Distribuição de itens', description: 'Positivação da base na 3ª semana.', targetText: '27 itens', rewardValue: 483.73, points: 0.1 },
  { id: 'close-fin', stage: 'CLOSING', frequency: 'MONTHLY', kpi: 'Meta financeira', description: 'Atingir meta financeira no fechamento.', targetText: '100%', rewardValue: 96.75, points: 0.02 },
  { id: 'close-margin', stage: 'CLOSING', frequency: 'MONTHLY', kpi: 'Rentabilidade', description: 'Margem de contribuição parametrizada.', targetText: '33%', rewardValue: 967.46, points: 0.2 },
]

const DEFAULT_PRIZES: CampaignPrize[] = [
  { id: 'month', title: 'Campanha VDD do mês', frequency: 'MONTHLY', type: 'CASH', rewardValue: 1000, minPoints: 0.6, active: true },
  { id: 'quarter', title: 'Campanha VDD do trimestre', frequency: 'QUARTERLY', type: 'BENEFIT', rewardValue: 0, minPoints: 18, active: true },
]

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseIsoDate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function formatDateBr(iso: string) {
  const date = parseIsoDate(iso)
  if (!date) return '--'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function numberBr(value: number, max = 2) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(value)
}

function parseDecimal(input: string, fallback = 0) {
  const parsed = Number(input.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
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

function brazilNationalHolidays(year: number): HolidayInfo[] {
  const fixed: Array<{ m: number; d: number; name: string }> = [
    { m: 1, d: 1, name: 'Confraternização Universal' },
    { m: 4, d: 21, name: 'Tiradentes' },
    { m: 5, d: 1, name: 'Dia do Trabalho' },
    { m: 9, d: 7, name: 'Independência do Brasil' },
    { m: 10, d: 12, name: 'Nossa Senhora Aparecida' },
    { m: 11, d: 2, name: 'Finados' },
    { m: 11, d: 15, name: 'Proclamação da República' },
    { m: 11, d: 20, name: 'Consciência Negra' },
    { m: 12, d: 25, name: 'Natal' },
  ]
  const goodFriday = addDays(easterSunday(year), -2)
  return [...fixed.map((f) => ({ date: toIsoDate(new Date(year, f.m - 1, f.d)), name: f.name })), { date: toIsoDate(goodFriday), name: 'Paixão de Cristo' }]
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function firstMonday(year: number, month: number) {
  for (let d = 1; d <= 7; d += 1) {
    const date = new Date(year, month, d)
    if (date.getDay() === 1) return toIsoDate(date)
  }
  return toIsoDate(new Date(year, month, 1))
}

function isBusinessDay(date: Date, blocked: Set<string>) {
  const weekday = date.getDay()
  return weekday >= 1 && weekday <= 5 && !blocked.has(toIsoDate(date))
}

function buildCycle(startIso: string, blocked: Set<string>) {
  const start = parseIsoDate(startIso)
  if (!start) return [] as Array<{ key: StageKey; label: string; start: string; end: string; count: number }>
  let cursor = new Date(start)
  return STAGES.map((stage) => {
    const business: string[] = []
    let guard = 0
    while (business.length < 5 && guard < 120) {
      if (isBusinessDay(cursor, blocked)) business.push(toIsoDate(cursor))
      cursor = addDays(cursor, 1)
      guard += 1
    }
    return { key: stage.key, label: stage.label, start: business[0], end: business[business.length - 1], count: business.length }
  })
}

export default function MetasWorkspace() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [includeNational, setIncludeNational] = useState(true)
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthConfig>>({})
  const [rules, setRules] = useState<GoalRule[]>(DEFAULT_RULES)
  const [achievements, setAchievements] = useState<Record<string, boolean>>({})
  const [prizes, setPrizes] = useState<CampaignPrize[]>(DEFAULT_PRIZES)
  const [salaryBase, setSalaryBase] = useState(1612.44)
  const [basePremiation, setBasePremiation] = useState(4837.32)
  const [extraBonus, setExtraBonus] = useState(400)
  const [extraMinPoints, setExtraMinPoints] = useState(0.6)
  const [customDate, setCustomDate] = useState('')

  const monthKey = buildMonthKey(year, month)
  const active = monthConfigs[monthKey]

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      if (typeof data.year === 'number') setYear(data.year)
      if (typeof data.month === 'number') setMonth(data.month)
      if (typeof data.includeNational === 'boolean') setIncludeNational(data.includeNational)
      if (data.monthConfigs && typeof data.monthConfigs === 'object') setMonthConfigs(data.monthConfigs as Record<string, MonthConfig>)
      if (Array.isArray(data.rules)) setRules(data.rules as GoalRule[])
      if (data.achievements && typeof data.achievements === 'object') setAchievements(data.achievements as Record<string, boolean>)
      if (Array.isArray(data.prizes)) setPrizes(data.prizes as CampaignPrize[])
      if (typeof data.salaryBase === 'number') setSalaryBase(data.salaryBase)
      if (typeof data.basePremiation === 'number') setBasePremiation(data.basePremiation)
      if (typeof data.extraBonus === 'number') setExtraBonus(data.extraBonus)
      if (typeof data.extraMinPoints === 'number') setExtraMinPoints(data.extraMinPoints)
    } catch {
      // fallback
    }
  }, [])

  useEffect(() => {
    if (active) return
    setMonthConfigs((prev) => ({ ...prev, [monthKey]: { week1StartDate: firstMonday(year, month), customOffDates: [] } }))
  }, [active, month, monthKey, year])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year, month, includeNational, monthConfigs, rules, achievements, prizes, salaryBase, basePremiation, extraBonus, extraMinPoints })
    )
  }, [achievements, basePremiation, extraBonus, extraMinPoints, includeNational, month, monthConfigs, prizes, rules, salaryBase, year])

  const national = useMemo(() => [...brazilNationalHolidays(year), ...brazilNationalHolidays(year + 1)], [year])
  const blockedSet = useMemo(() => {
    const set = new Set<string>()
    if (includeNational) national.forEach((h) => set.add(h.date))
    ;(active?.customOffDates ?? []).forEach((d) => set.add(d))
    return set
  }, [active?.customOffDates, includeNational, national])

  const cycle = useMemo(() => buildCycle(active?.week1StartDate ?? '', blockedSet), [active?.week1StartDate, blockedSet])
  const cycleDays = cycle.reduce((sum, item) => sum + item.count, 0)
  const potentialReward = rules.reduce((sum, item) => sum + item.rewardValue, 0)
  const potentialPoints = rules.reduce((sum, item) => sum + item.points, 0)
  const achievedReward = rules.reduce((sum, item) => (achievements[item.id] ? sum + item.rewardValue : sum), 0)
  const achievedPoints = rules.reduce((sum, item) => (achievements[item.id] ? sum + item.points : sum), 0)
  const eligiblePrizes = prizes.filter((p) => p.active && achievedPoints >= p.minPoints)
  const eligibleCash = eligiblePrizes.filter((p) => p.type === 'CASH').reduce((sum, item) => sum + item.rewardValue, 0)
  const eligibleExtra = achievedPoints >= extraMinPoints ? extraBonus : 0
  const projectedGross = achievedReward + eligibleCash + eligibleExtra

  const input = 'mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Card className="relative overflow-hidden border-surface-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary-600 via-emerald-500 to-cyan-500" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500">Módulo de metas comerciais</p>
        <h1 className="mt-1 text-2xl font-semibold text-surface-900">Gestão de Metas e Premiação de Vendedores</h1>
        <p className="mt-1 text-sm text-surface-600">Configuração mensal, semanal e trimestral com 4 semanas por ciclo (sendo a última o fechamento), calendário útil brasileiro e regras totalmente personalizáveis.</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-surface-200">
          <div className="mb-3 flex items-center gap-2"><CalendarDays size={16} className="text-primary-600" /><h2 className="text-base font-semibold text-surface-900">Calendário Operacional</h2></div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>Mês<select className={input} value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label>
            <label className={label}>Ano<input className={input} type="number" value={year} min={2024} max={2100} onChange={(e) => setYear(Number(e.target.value))} /></label>
            <label className={label}>Início da 1ª semana<input className={input} type="date" value={active?.week1StartDate ?? ''} onChange={(e) => setMonthConfigs((prev) => ({ ...prev, [monthKey]: { week1StartDate: e.target.value, customOffDates: active?.customOffDates ?? [] } }))} /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={includeNational} onChange={(e) => setIncludeNational(e.target.checked)} /> Considerar feriados nacionais oficiais</label>
            <Badge variant="secondary">Dias úteis do ciclo: {cycleDays}</Badge>
          </div>
          <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Datas personalizadas de bloqueio</p>
            <div className="mt-2 flex gap-2">
              <input type="date" className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <button type="button" onClick={() => { if (!customDate) return; const current = active?.customOffDates ?? []; if (current.includes(customDate)) return; setMonthConfigs((prev) => ({ ...prev, [monthKey]: { week1StartDate: active?.week1StartDate ?? firstMonday(year, month), customOffDates: [...current, customDate].sort() } })); setCustomDate('') }} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={12} /> Adicionar</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">{(active?.customOffDates ?? []).map((d) => <button key={d} type="button" onClick={() => setMonthConfigs((prev) => ({ ...prev, [monthKey]: { week1StartDate: active?.week1StartDate ?? firstMonday(year, month), customOffDates: (active?.customOffDates ?? []).filter((item) => item !== d) } }))} className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-surface-700">{formatDateBr(d)}<Trash2 size={12} className="text-red-600" /></button>)}</div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">{cycle.map((c) => <div key={c.key} className="rounded-lg border border-surface-200 bg-white p-2.5 text-xs"><p className="font-semibold text-surface-700">{c.label}</p><p className="mt-1 text-surface-600">{formatDateBr(c.start)} - {formatDateBr(c.end)}</p><p className="text-surface-500">Dias úteis: {c.count}</p></div>)}</div>
        </Card>

        <Card className="border-surface-200">
          <div className="mb-3 flex items-center gap-2"><Trophy size={16} className="text-amber-600" /><h2 className="text-base font-semibold text-surface-900">Premiação</h2></div>
          <div className="grid gap-2">
            <label className={label}>Salário base<input className={input} type="number" step="0.01" value={salaryBase} onChange={(e) => setSalaryBase(parseDecimal(e.target.value, 0))} /></label>
            <label className={label}>Base premiação<input className={input} type="number" step="0.01" value={basePremiation} onChange={(e) => setBasePremiation(parseDecimal(e.target.value, 0))} /></label>
            <label className={label}>Bônus extra de meta<input className={input} type="number" step="0.01" value={extraBonus} onChange={(e) => setExtraBonus(parseDecimal(e.target.value, 0))} /></label>
            <label className={label}>Pontos mínimos do bônus<input className={input} type="number" step="0.01" value={extraMinPoints} onChange={(e) => setExtraMinPoints(parseDecimal(e.target.value, 0))} /></label>
          </div>
          <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm text-surface-700">
            <p>Potencial: <strong>{currency(potentialReward)}</strong> | {numberBr(potentialPoints, 3)} pts</p>
            <p>Atingido: <strong>{currency(achievedReward)}</strong> | {numberBr(achievedPoints, 3)} pts</p>
            <p>Campanhas elegíveis: <strong>{currency(eligibleCash)}</strong></p>
            <p>Total bruto projetado: <strong>{currency(projectedGross)}</strong></p>
          </div>
        </Card>
      </div>

      <Card className="border-surface-200">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Target size={16} className="text-primary-600" /><h2 className="text-base font-semibold text-surface-900">Matriz de KPIs e metas</h2></div>
          <button type="button" onClick={() => setRules((prev) => [...prev, { id: createId('rule'), stage: 'W1', frequency: 'WEEKLY', kpi: 'Novo KPI', description: 'Descreva a regra.', targetText: '0%', rewardValue: 0, points: 0 }])} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={12} /> Novo KPI</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead><tr className="bg-surface-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500"><th className="px-3 py-2">Período</th><th className="px-3 py-2">Freq.</th><th className="px-3 py-2">KPI</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Parâmetro</th><th className="px-3 py-2">Premiação</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2">Atingida</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-surface-100">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.stage} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, stage: e.target.value as StageKey } : r)))}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td>
                  <td className="px-3 py-2"><select className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.frequency} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, frequency: e.target.value as RuleFrequency } : r)))}><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option></select></td>
                  <td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.kpi} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, kpi: e.target.value } : r)))} /></td>
                  <td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.description} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, description: e.target.value } : r)))} /></td>
                  <td className="px-3 py-2"><input className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs" value={rule.targetText} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, targetText: e.target.value } : r)))} /></td>
                  <td className="px-3 py-2"><input className="w-24 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.01" value={rule.rewardValue} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, rewardValue: parseDecimal(e.target.value, 0) } : r)))} /></td>
                  <td className="px-3 py-2"><input className="w-20 rounded border border-surface-200 px-2 py-1.5 text-xs" type="number" step="0.001" value={rule.points} onChange={(e) => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, points: parseDecimal(e.target.value, 0) } : r)))} /></td>
                  <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={Boolean(achievements[rule.id])} onChange={(e) => setAchievements((prev) => ({ ...prev, [rule.id]: e.target.checked }))} /></td>
                  <td className="px-3 py-2"><button type="button" onClick={() => { setRules((prev) => prev.filter((r) => r.id !== rule.id)); setAchievements((prev) => { const next = { ...prev }; delete next[rule.id]; return next }) }} className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-surface-200">
        <h2 className="mb-3 text-base font-semibold text-surface-900">Campanhas de premiação (mensal e trimestral)</h2>
        <div className="space-y-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="grid gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 md:grid-cols-6 md:items-end">
              <label className={label}>Campanha<input className={input} value={prize.title} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, title: e.target.value } : p)))} /></label>
              <label className={label}>Frequência<select className={input} value={prize.frequency} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, frequency: e.target.value as CampaignPrize['frequency'] } : p)))}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option></select></label>
              <label className={label}>Tipo<select className={input} value={prize.type} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, type: e.target.value as PrizeType } : p)))}><option value="CASH">Financeira</option><option value="BENEFIT">Benefício</option></select></label>
              <label className={label}>Valor<input className={input} type="number" step="0.01" value={prize.rewardValue} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, rewardValue: parseDecimal(e.target.value, 0) } : p)))} /></label>
              <label className={label}>Pontos mínimos<input className={input} type="number" step="0.01" value={prize.minPoints} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, minPoints: parseDecimal(e.target.value, 0) } : p)))} /></label>
              <label className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={prize.active} onChange={(e) => setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, active: e.target.checked } : p)))} /> Ativa</label>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{eligiblePrizes.map((p) => <Badge key={p.id} variant="success">{p.title} elegível</Badge>)}</div>
      </Card>

      <Card className="border-surface-200 bg-surface-50/60">
        <p className="text-xs text-surface-600">Base de cálculo: semanas com apenas dias úteis (segunda a sexta), excluindo feriados nacionais do calendário oficial brasileiro e datas adicionais configuradas por mês para feriados municipais e datas especiais.</p>
      </Card>
    </div>
  )
}

