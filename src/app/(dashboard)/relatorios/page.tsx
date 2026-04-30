'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, FileBarChart2, FileDown, FolderKanban } from 'lucide-react'

type SectionId = 'metas' | 'production' | 'inventory' | 'quality' | 'hr'
type PeriodMode = 'today' | 'current_month' | 'single_month' | 'range'

interface ReportSection {
  id: SectionId
  title: string
  description: string
  status: 'ready' | 'soon'
}

const SECTIONS: ReportSection[] = [
  {
    id: 'metas',
    title: 'Metas',
    description: 'Relatório executivo e detalhado de performance comercial.',
    status: 'ready',
  },
  {
    id: 'production',
    title: 'Produção',
    description: 'Exportação operacional de lotes e andamento.',
    status: 'soon',
  },
  {
    id: 'inventory',
    title: 'Logística',
    description: 'Exportação de itens, estoque e movimentações.',
    status: 'soon',
  },
  {
    id: 'quality',
    title: 'Qualidade',
    description: 'Exportação de inspeções e não conformidades.',
    status: 'soon',
  },
  {
    id: 'hr',
    title: 'RH',
    description: 'Exportação de colaboradores e status de acesso.',
    status: 'soon',
  },
]

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelPt(monthInput: string) {
  const [yearRaw, monthRaw] = monthInput.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!year || !month) return monthInput
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function dateRangeFromMode(mode: PeriodMode, singleMonth: string, fromMonth: string, toMonth: string) {
  const now = new Date()

  if (mode === 'today') {
    const date = now.toISOString().slice(0, 10)
    return { from: date, to: date }
  }

  if (mode === 'current_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }

  if (mode === 'single_month') {
    const [y, m] = singleMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }

  const [fromY, fromM] = fromMonth.split('-').map(Number)
  const [toY, toM] = toMonth.split('-').map(Number)
  const start = new Date(fromY, fromM - 1, 1)
  const end = new Date(toY, toM, 0)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export default function RelatoriosPage() {
  const router = useRouter()
  const periodSectionRef = useRef<HTMLElement | null>(null)
  const now = new Date()
  const currentMonth = toMonthInput(now)

  const [section, setSection] = useState<SectionId>('metas')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current_month')
  const [singleMonth, setSingleMonth] = useState(currentMonth)
  const [fromMonth, setFromMonth] = useState(currentMonth)
  const [toMonth, setToMonth] = useState(currentMonth)

  const range = useMemo(
    () => dateRangeFromMode(periodMode, singleMonth, fromMonth, toMonth),
    [periodMode, singleMonth, fromMonth, toMonth]
  )

  const periodPreview = useMemo(() => {
    if (periodMode === 'today') return `Hoje (${new Date(range.from).toLocaleDateString('pt-BR')})`
    if (periodMode === 'current_month') return monthLabelPt(currentMonth)
    if (periodMode === 'single_month') return monthLabelPt(singleMonth)
    return `${monthLabelPt(fromMonth)} a ${monthLabelPt(toMonth)}`
  }, [currentMonth, fromMonth, periodMode, range.from, singleMonth, toMonth])

  function selectSection(nextSection: ReportSection) {
    if (nextSection.status !== 'ready') return
    setSection(nextSection.id)
    setTimeout(() => {
      periodSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }

  function gerarRelatorioMetas() {
    const sourceMonth = periodMode === 'single_month' ? singleMonth : toMonthInput(new Date(range.from))
    const [year, month] = sourceMonth.split('-')
    router.push(`/metas?year=${year}&month=${month}&autoExport=1`)
  }

  const sectionMeta = SECTIONS.find((item) => item.id === section)
  const canGenerate = section === 'metas'

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <section className="relative overflow-hidden rounded-[22px] border border-emerald-400/20 bg-linear-to-r from-[#0f3e30] via-[#14553f] to-[#1c6a52] p-7 text-white shadow-[0_16px_34px_rgba(7,39,28,0.28)] ring-1 ring-black/5">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-1 rounded-full bg-linear-to-r from-[#9ecb5a]/85 via-[#16c7b8]/85 to-[#31d4a7]/85" />
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 top-10 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Módulo • Relatórios</p>
            <h1 className="mt-2 text-[44px] font-semibold leading-[0.95] tracking-tight text-[#f1f7ec]">Central de Relatórios</h1>
            <p className="mt-3 text-[28px] font-semibold leading-tight text-[#f1f7ec]">Gestão de relatórios — Ouro Verde</p>
            <p className="mt-1 text-lg text-emerald-100/95">Selecione a seção, defina o período e gere arquivos profissionais com padrão empresarial.</p>
          </div>
          <div className="hidden rounded-2xl border border-white/20 bg-white/8 p-4 backdrop-blur-sm md:block">
            <FileBarChart2 className="h-10 w-10 text-emerald-100" />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-surface-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_10px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-emerald-700" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-surface-600">Seção do Relatório</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((item) => {
            const active = section === item.id
            const disabled = item.status !== 'ready'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item)}
                disabled={disabled}
                className={`rounded-2xl border-t-4 p-5 text-left transition-all ${
                  active
                    ? 'border-emerald-400 bg-white shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
                    : 'border-surface-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_10px_rgba(15,23,42,0.04)]'
                } ${disabled ? 'cursor-not-allowed opacity-85' : 'hover:border-emerald-200 hover:shadow-[0_0_0_2px_rgba(16,185,129,0.08)]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[31px] font-semibold leading-[0.95] tracking-tight text-[#1f2937]">{item.title}</p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.status === 'ready' ? 'Disponível' : 'Em breve'}
                  </span>
                </div>
                <p className="mt-3 text-lg leading-snug text-surface-600">{item.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section ref={periodSectionRef} className="mt-6 rounded-3xl border border-surface-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_10px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-700" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-surface-600">Período</h2>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {[
            { id: 'today', label: 'Dia atual' },
            { id: 'current_month', label: 'Mês atual' },
            { id: 'single_month', label: 'Mês específico' },
            { id: 'range', label: 'Intervalo de meses' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriodMode(option.id as PeriodMode)}
              className={`rounded-2xl border px-4 py-3 text-[31px] font-medium leading-none tracking-tight transition-colors ${
                periodMode === option.id
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {periodMode === 'single_month' && (
          <div className="mt-4 max-w-xs">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Mês de referência</label>
            <input type="month" value={singleMonth} onChange={(e) => setSingleMonth(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
          </div>
        )}

        {periodMode === 'range' && (
          <div className="mt-4 grid gap-4 md:max-w-xl md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">De</label>
              <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Até</label>
              <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg text-surface-700">
          <strong>Seleção atual:</strong> {sectionMeta?.title} • {periodPreview}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={gerarRelatorioMetas}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2.5 text-base font-semibold text-emerald-700 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Gerar Relatório
          </button>
        </div>
      </section>
    </div>
  )
}
