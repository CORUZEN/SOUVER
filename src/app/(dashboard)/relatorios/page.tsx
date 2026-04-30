'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarDays, FileBarChart2, FileDown, FolderKanban, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import * as XLSX from 'xlsx'

type SectionId = 'metas' | 'production' | 'inventory' | 'quality' | 'hr'
type PeriodMode = 'today' | 'current_month' | 'single_month' | 'range'

interface ReportSection {
  id: SectionId
  title: string
  description: string
  status: 'ready' | 'soon'
}

const SECTIONS: ReportSection[] = [
  { id: 'metas', title: 'Metas', description: 'Relatório executivo e detalhado de performance comercial.', status: 'ready' },
  { id: 'production', title: 'Produção', description: 'Exportação operacional de lotes e andamento.', status: 'soon' },
  { id: 'inventory', title: 'Logística', description: 'Exportação de itens, estoque e movimentações.', status: 'soon' },
  { id: 'quality', title: 'Qualidade', description: 'Exportação de inspeções e não conformidades.', status: 'soon' },
  { id: 'hr', title: 'RH', description: 'Exportação de colaboradores e status de acesso.', status: 'soon' },
]

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function downloadArrayBufferAsFile(buffer: ArrayBuffer, filename: string, type: string) {
  const blob = new Blob([buffer], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
  const periodSectionRef = useRef<HTMLDivElement | null>(null)
  const now = new Date()
  const currentMonth = toMonthInput(now)

  const [section, setSection] = useState<SectionId | null>(null)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current_month')
  const [singleMonth, setSingleMonth] = useState(currentMonth)
  const [fromMonth, setFromMonth] = useState(currentMonth)
  const [toMonth, setToMonth] = useState(currentMonth)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [exportError, setExportError] = useState('')

  const range = useMemo(() => dateRangeFromMode(periodMode, singleMonth, fromMonth, toMonth), [periodMode, singleMonth, fromMonth, toMonth])

  const periodPreview = useMemo(() => {
    if (periodMode === 'today') return `Hoje (${new Date(range.from).toLocaleDateString('pt-BR')})`
    if (periodMode === 'current_month') return monthLabelPt(currentMonth)
    if (periodMode === 'single_month') return monthLabelPt(singleMonth)
    return `${monthLabelPt(fromMonth)} a ${monthLabelPt(toMonth)}`
  }, [periodMode, range.from, currentMonth, singleMonth, fromMonth, toMonth])

  function selectSection(nextSection: ReportSection) {
    if (nextSection.status !== 'ready') return
    setSection(nextSection.id)
    setTimeout(() => periodSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }

  function exportMetasDirect() {
    if (section !== 'metas' || exporting) return
    setExportError('')
    setExporting(true)
    setExportMessage('Gerando relatório de Metas...')
    const sourceMonth = periodMode === 'single_month' ? singleMonth : toMonthInput(new Date(range.from))
    const [year, month] = sourceMonth.split('-')

    ;(async () => {
      try {
        const response = await fetch(`/api/metas/sellers-performance?year=${Number(year)}&month=${Number(month)}&companyScope=all`)
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) {
          throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha ao consultar dados de Metas.')
        }

        const sellers = Array.isArray(payload.sellers) ? payload.sellers : []
        const rows = sellers.map((seller: Record<string, unknown>) => ({
          Vendedor: String(seller.name ?? ''),
          Supervisor: String(seller.supervisorName ?? ''),
          Pedidos: Number(seller.totalOrders ?? 0),
          'Valor Total (R$)': Number(seller.totalValue ?? 0),
          'Peso Total (kg)': Number(seller.totalGrossWeight ?? 0),
          'Base de Clientes': Number(seller.baseClientCount ?? 0),
          'Devoluções (R$)': Number(seller.totalReturnedValue ?? 0),
          'Títulos em Aberto (R$)': Number(seller.totalOpenTitlesValue ?? 0),
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Metas')
        const output = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

        const filename = `Relatorio_Metas_${monthLabelPt(sourceMonth).replace(/\s+/g, '_')}.xlsx`
        downloadArrayBufferAsFile(
          output,
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Não foi possível gerar o relatório de Metas.')
      } finally {
        setExporting(false)
        setExportMessage('')
      }
    })()
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Card className="relative border border-[#2f5f47]/42 bg-linear-to-br from-[#0f281d] via-[#1a4432] to-[#1a5a4b] shadow-[0_18px_34px_rgba(6,16,11,0.28)]">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-14 top-4 h-30 w-52 rounded-full bg-[#30a779]/18 blur-3xl" />
          <div className="absolute right-2 top-0 h-28 w-44 rounded-full bg-[#2dc7b6]/14 blur-3xl" />
        </div>
        <div className="absolute inset-x-3 top-0 h-0.75 bg-linear-to-r from-[#b0c965] via-[#2ec08d] to-[#57d3c2]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#b9c7ae]">Gestão Empresarial</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#edf0e2]">Central de Relatórios</h1>
            <p className="mt-2 text-xs text-[#aab89d]">Selecione a seção, defina o período e gere relatórios no padrão corporativo.</p>
          </div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-emerald-100">
            <FileBarChart2 className="h-8 w-8" />
          </div>
        </div>
      </Card>

      <Card className="border-surface-200">
        <div className="mb-4 flex items-center gap-2">
          <FolderKanban size={16} className="text-primary-600" />
          <h2 className="text-base font-semibold text-surface-900">Seção do relatório</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((item) => {
            const active = section === item.id
            const disabled = item.status !== 'ready'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item)}
                disabled={disabled}
                className={`rounded-xl border p-4 text-left transition-all ${
                  disabled
                    ? 'border-slate-200 bg-linear-to-br from-slate-50 to-slate-100 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                    : active
                      ? 'border-emerald-300 bg-linear-to-br from-emerald-50 via-teal-50 to-cyan-50 text-surface-900 ring-1 ring-emerald-200 shadow-[0_12px_24px_rgba(16,185,129,0.12)]'
                      : 'border-emerald-200/60 bg-linear-to-br from-white via-emerald-50/35 to-teal-50/35 text-surface-900 shadow-[0_8px_18px_rgba(13,74,56,0.08)] hover:shadow-[0_10px_20px_rgba(13,74,56,0.12)]'
                } ${disabled ? 'cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xl font-semibold tracking-tight ${disabled ? 'text-slate-600' : 'text-surface-900'}`}>{item.title}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.status === 'ready' ? 'Disponível' : 'Em breve'}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${disabled ? 'text-slate-500' : 'text-surface-600'}`}>{item.description}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {section && (
        <div ref={periodSectionRef}>
          <Card className="border-surface-200">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={16} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900">Período</h2>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
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
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    periodMode === option.id
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {periodMode === 'single_month' && (
              <div className="mt-4 max-w-xs">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Mês de referência</label>
                <input type="month" value={singleMonth} onChange={(e) => setSingleMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
              </div>
            )}

            {periodMode === 'range' && (
              <div className="mt-4 grid gap-3 md:max-w-xl md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">De</label>
                  <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Até</label>
                  <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800" />
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700">
              <strong>Seleção atual:</strong> {SECTIONS.find((s) => s.id === section)?.title} • {periodPreview}
            </div>

            {exportError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {exportError}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={exportMetasDirect}
                disabled={section !== 'metas' || exporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown size={14} />
                {exporting ? 'Gerando...' : 'Gerar Relatório'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {exporting && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-surface-900">{exportMessage || 'Gerando relatório...'}</p>
                <p className="text-xs text-surface-500">Aguarde, estamos preparando o arquivo.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
