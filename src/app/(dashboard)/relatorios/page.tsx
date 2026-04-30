'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, FileBarChart2, FileDown, FolderKanban } from 'lucide-react'

type SectionId = 'metas' | 'production' | 'inventory' | 'quality' | 'hr'
type PeriodMode = 'today' | 'current_month' | 'single_month' | 'range'
type ExportFormat = 'csv' | 'xlsx' | 'pdf'

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
    description: 'Relatorio executivo e detalhado de performance comercial.',
    status: 'ready',
  },
  {
    id: 'production',
    title: 'Producao',
    description: 'Exportacao operacional de lotes e andamento.',
    status: 'ready',
  },
  {
    id: 'inventory',
    title: 'Logistica',
    description: 'Exportacao de itens, estoque e movimentacoes.',
    status: 'ready',
  },
  {
    id: 'quality',
    title: 'Qualidade',
    description: 'Exportacao de inspecoes e nao conformidades.',
    status: 'ready',
  },
  {
    id: 'hr',
    title: 'RH',
    description: 'Exportacao de colaboradores e status de acesso.',
    status: 'ready',
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
  const now = new Date()
  const currentMonth = toMonthInput(now)

  const [section, setSection] = useState<SectionId>('metas')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current_month')
  const [singleMonth, setSingleMonth] = useState(currentMonth)
  const [fromMonth, setFromMonth] = useState(currentMonth)
  const [toMonth, setToMonth] = useState(currentMonth)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

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

  async function exportOperational(format: ExportFormat) {
    setExportingFormat(format)
    try {
      const params = new URLSearchParams({
        module: section,
        format,
        dateFrom: range.from,
        dateTo: range.to,
      })
      const res = await fetch(`/api/reports/export?${params.toString()}`)
      if (!res.ok) return

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') ?? ''
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? `${section}_${format}.bin`
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingFormat(null)
    }
  }

  function openMetasSection() {
    const [y, m] = (periodMode === 'single_month' ? singleMonth : toMonthInput(new Date(range.from))).split('-')
    router.push(`/metas?year=${y}&month=${m}`)
  }

  const sectionMeta = SECTIONS.find((item) => item.id === section)
  const isMetas = section === 'metas'

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_#ecf7f2,_#f8fbfa_55%,_#ffffff)] px-6 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-[#0b3b2e] via-[#0f5c45] to-[#19745a] p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Modulo • Relatorios</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight">Central de Relatorios</h1>
              <p className="mt-2 text-sm text-emerald-100">Selecione a secao, defina o periodo e gere arquivos profissionais com padrao empresarial.</p>
            </div>
            <div className="hidden rounded-xl border border-white/20 bg-white/10 p-3 md:block">
              <FileBarChart2 className="h-8 w-8 text-emerald-100" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-surface-600">Secao do Relatorio</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SECTIONS.map((item) => {
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-emerald-400 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
                      : 'border-surface-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                >
                  <p className="text-sm font-semibold text-surface-900">{item.title}</p>
                  <p className="mt-1 text-xs text-surface-600">{item.description}</p>
                  <p className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.status === 'ready' ? 'Disponivel' : 'Em breve'}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-surface-600">Periodo</h2>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {[
              { id: 'today', label: 'Dia atual' },
              { id: 'current_month', label: 'Mes atual' },
              { id: 'single_month', label: 'Mes especifico' },
              { id: 'range', label: 'Intervalo de meses' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriodMode(option.id as PeriodMode)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Mes de referencia</label>
              <input type="month" value={singleMonth} onChange={(e) => setSingleMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
            </div>
          )}

          {periodMode === 'range' && (
            <div className="mt-4 grid gap-4 md:max-w-xl md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">De</label>
                <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Ate</label>
                <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700">
            <strong>Selecao atual:</strong> {sectionMeta?.title} • {periodPreview}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-surface-600">Geracao</h2>
          {isMetas ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-surface-700">
                Para a secao <strong>Metas</strong>, a geracao profissional ocorre no proprio Painel de Metas com o periodo selecionado.
              </p>
              <button
                type="button"
                onClick={openMetasSection}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <FileDown className="h-4 w-4" />
                Abrir Painel de Metas no periodo
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => exportOperational(format)}
                  disabled={Boolean(exportingFormat)}
                  className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-surface-700 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  {exportingFormat === format ? `Gerando ${format.toUpperCase()}...` : `Exportar ${format.toUpperCase()}`}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

