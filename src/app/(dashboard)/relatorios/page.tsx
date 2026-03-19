'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileBarChart2, Factory, Truck, ShieldCheck, Users,
  RefreshCw, Download, Calendar, Filter, ChevronDown,
  BarChart3, TrendingUp, Package, AlertTriangle, CheckCircle2
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────
interface ReportSection {
  id:    string
  label: string
  icon:  React.ReactNode
  color: string
}

interface KpiData {
  production?: {
    totalBatches: number
    inProgress: number
    finished: number
    cancelled: number
    totalProducedQty: number | null
  }
  inventory?: {
    totalItems: number
    activeItems: number
    lowStockCount: number
    totalMovements: number
  }
  quality?: {
    totalRecords: number
    approvedRecords: number
    rejectedRecords: number
    pendingRecords: number
    openNCs: number
    criticalNCs: number
    resolvedThisMonth: number
  }
  hr?: {
    total: number
    totalActive: number
    totalInactive: number
    with2FA: number
    loggedToday: number
  }
  activeUsers?: number
}

const SECTIONS: ReportSection[] = [
  { id: 'production', label: 'Produção',      icon: <Factory className="w-4 h-4" />,       color: 'bg-amber-600'   },
  { id: 'inventory',  label: 'Logística',     icon: <Truck className="w-4 h-4" />,          color: 'bg-cyan-600'    },
  { id: 'quality',    label: 'Qualidade',     icon: <ShieldCheck className="w-4 h-4" />,    color: 'bg-emerald-600' },
  { id: 'hr',         label: 'RH',            icon: <Users className="w-4 h-4" />,          color: 'bg-violet-600'  },
]

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-surface-200 px-4 py-4 ${accent ?? ''}`}>
      <p className="text-2xl font-bold text-surface-900">{value ?? 0}</p>
      <p className="text-xs font-medium text-surface-700 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ section }: { section: ReportSection }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-7 h-7 rounded-lg ${section.color} flex items-center justify-center text-white`}>
        {section.icon}
      </div>
      <h2 className="font-semibold text-surface-900">{section.label}</h2>
    </div>
  )
}

export default function RelatoriosPage() {
  const [data, setData]           = useState<KpiData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingPdf,  setExportingPdf]  = useState(false)
  const [active, setActive]       = useState<string>('production')
  const [period, setPeriod]       = useState('today')

  async function downloadFile(format: 'csv' | 'xlsx' | 'pdf') {
    const setter = format === 'xlsx' ? setExportingXlsx : format === 'pdf' ? setExportingPdf : setExporting
    setter(true)
    try {
      const res = await fetch(`/api/reports/export?module=${active}&format=${format}&period=${period}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const cd   = res.headers.get('content-disposition') ?? ''
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? `${active}_export.${format}`
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } finally { setter(false) }
  }

  const downloadCsv  = () => downloadFile('csv')
  const downloadXlsx = () => downloadFile('xlsx')
  const downloadPdf  = () => downloadFile('pdf')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/kpis?period=${period}`)
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const p  = data?.production
  const inv = data?.inventory
  const q  = data?.quality
  const hr = data?.hr

  const qualityRate = p && q
    ? q.totalRecords > 0
      ? Math.round((q.approvedRecords / q.totalRecords) * 100)
      : null
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-surface-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <FileBarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 leading-tight">Relatórios</h1>
              <p className="text-xs text-surface-500">Painel consolidado de indicadores operacionais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-600">
              <Calendar className="w-3.5 h-3.5" />
              <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent focus:outline-none text-xs pr-1">
                <option value="today">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
                <option value="quarter">Últimos 90 dias</option>
                <option value="all">Todo o período</option>
              </select>
              <ChevronDown className="w-3 h-3" />
            </div>
            <button
              onClick={downloadCsv}
              disabled={exporting || exportingXlsx || exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exportando…' : 'CSV'}
            </button>
            <button
              onClick={downloadXlsx}
              disabled={exporting || exportingXlsx || exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Download className={`w-3.5 h-3.5 ${exportingXlsx ? 'animate-bounce' : ''}`} />
              {exportingXlsx ? 'Exportando…' : 'XLSX'}
            </button>
            <button
              onClick={downloadPdf}
              disabled={exporting || exportingXlsx || exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Download className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-bounce' : ''}`} />
              {exportingPdf ? 'Gerando…' : 'PDF'}
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-surface-400 hover:text-surface-700 border border-surface-200 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Seção tabs */}
        <div className="flex gap-1 mt-4">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active === s.id ? 'bg-indigo-600 text-white' : 'text-surface-500 hover:bg-surface-100'
              }`}
            >
              {s.icon}{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* ── Produção ── */}
        {active === 'production' && (
          <div>
            <SectionHeader section={SECTIONS[0]} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total de Lotes"     value={p?.totalBatches ?? 0} />
              <StatCard label="Em Andamento"       value={p?.inProgress   ?? 0} sub="lotes ativos" />
              <StatCard label="Finalizados"         value={p?.finished     ?? 0} />
              <StatCard label="Cancelados"          value={p?.cancelled    ?? 0} />
            </div>

            {/* Barra resumo produção */}
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-surface-900">Distribuição de Status</p>
              </div>
              {p && p.totalBatches > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: 'Em Andamento', count: p.inProgress, color: 'bg-blue-500'    },
                    { label: 'Finalizados',  count: p.finished,   color: 'bg-green-500'   },
                    { label: 'Cancelados',   count: p.cancelled,  color: 'bg-red-400'     },
                    { label: 'Outros',       count: p.totalBatches - p.inProgress - p.finished - p.cancelled, color: 'bg-surface-300' },
                  ].filter(r => r.count > 0).map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-surface-600 w-28 shrink-0">{r.label}</span>
                      <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.color}`}
                          style={{ width: `${Math.round((r.count / p.totalBatches) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-700 w-8 text-right">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-4">Nenhum lote registrado ainda</p>
              )}
            </div>
          </div>
        )}

        {/* ── Logística ── */}
        {active === 'inventory' && (
          <div>
            <SectionHeader section={SECTIONS[1]} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Itens Cadastrados" value={inv?.totalItems     ?? 0} />
              <StatCard label="Itens Ativos"       value={inv?.activeItems   ?? 0} />
              <StatCard label="Abaixo do Mínimo"  value={inv?.lowStockCount  ?? 0} sub="requer atenção" />
              <StatCard label="Movimentações"     value={inv?.totalMovements ?? 0} />
            </div>

            {inv && inv.lowStockCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Alerta de Estoque Mínimo</p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    {inv.lowStockCount} {inv.lowStockCount === 1 ? 'item está' : 'itens estão'} abaixo do estoque mínimo.
                    Acesse o módulo de <strong>Logística</strong> para verificar e realizar pedidos de reposição.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-surface-200 p-5 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-cyan-600" />
                <p className="text-sm font-semibold text-surface-900">Situação do Estoque</p>
              </div>
              {inv && inv.totalItems > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: 'Ativos regulares', count: (inv.activeItems ?? 0) - (inv.lowStockCount ?? 0), color: 'bg-green-500' },
                    { label: 'Abaixo do mínimo', count: inv.lowStockCount ?? 0,                            color: 'bg-yellow-400' },
                    { label: 'Inativos',          count: (inv.totalItems ?? 0) - (inv.activeItems ?? 0),   color: 'bg-surface-300' },
                  ].filter(r => r.count > 0).map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-surface-600 w-32 shrink-0">{r.label}</span>
                      <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.color}`}
                          style={{ width: `${Math.round((r.count / inv.totalItems) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-700 w-8 text-right">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-4">Nenhum item cadastrado ainda</p>
              )}
            </div>
          </div>
        )}

        {/* ── Qualidade ── */}
        {active === 'quality' && (
          <div>
            <SectionHeader section={SECTIONS[2]} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Inspeções"              value={q?.totalRecords       ?? 0} />
              <StatCard label="Aprovadas"              value={q?.approvedRecords    ?? 0} />
              <StatCard label="Reprovadas"             value={q?.rejectedRecords    ?? 0} />
              <StatCard label="NCs Abertas"            value={q?.openNCs            ?? 0} sub="em andamento" />
              <StatCard label="NCs Críticas"           value={q?.criticalNCs        ?? 0} sub="requer atenção" />
              <StatCard label="Resolvidas/mês"         value={q?.resolvedThisMonth  ?? 0} />
              {qualityRate !== null && (
                <StatCard label="Taxa de Aprovação" value={`${qualityRate}%`} sub="das inspeções" />
              )}
            </div>

            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-surface-900">Resultado das Inspeções</p>
              </div>
              {q && q.totalRecords > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: 'Aprovadas',    count: q.approvedRecords,                                    color: 'bg-green-500'  },
                    { label: 'Pendentes',    count: q.pendingRecords,                                     color: 'bg-yellow-400' },
                    { label: 'Condicionais', count: q.totalRecords - q.approvedRecords - q.rejectedRecords - q.pendingRecords, color: 'bg-orange-400' },
                    { label: 'Reprovadas',   count: q.rejectedRecords,                                    color: 'bg-red-500'    },
                  ].filter(r => r.count > 0).map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-surface-600 w-28 shrink-0">{r.label}</span>
                      <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.color}`}
                          style={{ width: `${Math.round((r.count / q.totalRecords) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-700 w-8 text-right">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-4">Nenhuma inspeção registrada ainda</p>
              )}
            </div>

            {q && q.criticalNCs > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mt-4">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">NCs Críticas Pendentes</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Existem <strong>{q.criticalNCs}</strong> não conformidades de severidade CRÍTICA em aberto.
                    Acesse o módulo de <strong>Qualidade</strong> para tratativa imediata.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RH ── */}
        {active === 'hr' && (
          <div>
            <SectionHeader section={SECTIONS[3]} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Colaboradores" value={hr?.total         ?? 0} />
              <StatCard label="Ativos"               value={hr?.totalActive  ?? 0} />
              <StatCard label="Inativos"             value={hr?.totalInactive ?? 0} />
              <StatCard label="Com 2FA"              value={hr?.with2FA      ?? 0} sub="autenticação dupla" />
              <StatCard label="Acessaram Hoje"       value={hr?.loggedToday  ?? 0} />
              <StatCard label="Usuários Ativos"      value={data?.activeUsers ?? 0} sub="sessão ativa" />
            </div>

            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-surface-900">Distribuição por Status</p>
              </div>
              {hr && hr.total > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: 'Ativos',    count: hr.totalActive,                                       color: 'bg-green-500'  },
                    { label: 'Inativos',  count: hr.totalInactive,                                     color: 'bg-surface-300' },
                    { label: 'Suspensos', count: hr.total - hr.totalActive - hr.totalInactive,          color: 'bg-red-400'    },
                  ].filter(r => r.count > 0).map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-surface-600 w-24 shrink-0">{r.label}</span>
                      <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.color}`}
                          style={{ width: `${Math.round((r.count / hr.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-700 w-8 text-right">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-4">Nenhum colaborador cadastrado</p>
              )}
            </div>
          </div>
        )}

        {/* Rodapé informativo */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-surface-400">
            Dados consolidados · Período: <strong>{{
              today: 'Hoje',
              week: 'Últimos 7 dias',
              month: 'Este mês',
              quarter: 'Últimos 90 dias',
              all: 'Todo o período',
            }[period] ?? 'Todo o período'}</strong> · Atualizado às {new Date().toLocaleTimeString('pt-BR')}
          </p>
          <p className="text-xs text-surface-300 mt-0.5">
            Clique em <strong>CSV</strong> ou <strong>XLSX</strong> para exportar os dados da aba selecionada
          </p>
        </div>
      </div>
    </div>
  )
}
