'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart2, Factory, Truck, ShieldCheck, Users,
  RefreshCw, TrendingUp, TrendingDown,
  Package, AlertTriangle, CheckCircle2, ArrowLeft,
  Activity, Target, Layers,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────

interface KpiData {
  production?: {
    totalBatches: number
    inProgress: number
    finished: number
    cancelled: number
    openCount: number
    finishedToday: number
    totalProducedQty: number | null
  }
  inventory?: {
    totalItems: number
    activeItems: number
    lowStockCount: number
    lowStockItems: number
    totalMovements: number
    movementsToday: number
  }
  quality?: {
    openNCs: number
    criticalNCs: number
    totalRecords: number
    approvedRecords: number
    rejectedRecords: number
    pendingRecords: number
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
  variation?: Record<string, number | null>
}

// ─── Componentes auxiliares ────────────────────────────────────────

function MetricCard({
  label, value, sub, trend, color, icon: Icon,
}: {
  label: string
  value: string | number | null
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  color: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-surface-900">
          {value === null ? <span className="inline-block w-10 h-6 bg-surface-100 rounded animate-pulse" /> : value}
        </p>
        <p className="text-xs font-semibold text-surface-700 mt-0.5 truncate">{label}</p>
        {sub && (
          <p className={`text-[11px] mt-0.5 ${trend === 'down' ? 'text-red-500' : trend === 'up' ? 'text-green-600' : 'text-surface-400'}`}>
            {trend === 'down' && <TrendingDown className="w-3 h-3 inline mr-0.5" />}
            {trend === 'up' && <TrendingUp className="w-3 h-3 inline mr-0.5" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function HealthBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-surface-600 w-40 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-surface-700 w-12 text-right">{value}</span>
    </div>
  )
}

function ScoreGauge({ label, score, max = 100, color }: { label: string; score: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((score / max) * 100))
  const stroke = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={stroke} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{pct}%</text>
      </svg>
      <p className="text-xs text-center text-surface-600 leading-tight">{label}</p>
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────

export default function RelatorioExecutivoPage() {
  const [data, setData]       = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod]   = useState('month')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/kpis?period=${period}`)
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const p   = data?.production
  const inv = data?.inventory
  const q   = data?.quality
  const hr  = data?.hr

  const qualityRate = q && q.totalRecords > 0
    ? Math.round((q.approvedRecords / q.totalRecords) * 100)
    : 0

  const activeRate = hr && hr.total > 0
    ? Math.round((hr.totalActive / hr.total) * 100)
    : 0

  const twoFARate = hr && hr.total > 0
    ? Math.round((hr.with2FA / hr.total) * 100)
    : 0

  const stockHealth = inv && inv.activeItems > 0
    ? Math.round(((inv.activeItems - (inv.lowStockCount ?? 0)) / inv.activeItems) * 100)
    : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/relatorios" className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900 leading-tight">Visão Executiva</h1>
            <p className="text-xs text-surface-500">Relatório estratégico consolidado — Café Ouro Verde</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="border border-surface-200 rounded-lg px-2.5 py-1.5 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="quarter">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-600 border border-surface-200 rounded-lg hover:bg-surface-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Indicadores principais ── */}
      <div>
        <h2 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          Indicadores Operacionais
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Lotes em Andamento"
            value={loading ? null : p?.inProgress ?? 0}
            sub={`${p?.openCount ?? 0} em aberto`}
            icon={Factory}
            color="bg-amber-500"
            trend={p?.openCount ? 'neutral' : 'up'}
          />
          <MetricCard
            label="Itens no Estoque"
            value={loading ? null : inv?.activeItems ?? 0}
            sub={inv?.lowStockCount ? `⚠ ${inv.lowStockCount} abaixo do mínimo` : 'Estoque saudável'}
            icon={Package}
            color="bg-cyan-600"
            trend={inv?.lowStockCount ? 'down' : 'up'}
          />
          <MetricCard
            label="NCs Abertas"
            value={loading ? null : q?.openNCs ?? 0}
            sub={q?.criticalNCs ? `${q.criticalNCs} crítica(s)` : 'Sem críticos'}
            icon={ShieldCheck}
            color="bg-emerald-600"
            trend={q?.criticalNCs ? 'down' : 'up'}
          />
          <MetricCard
            label="Colaboradores Ativos"
            value={loading ? null : hr?.totalActive ?? 0}
            sub={`${hr?.loggedToday ?? 0} acessaram hoje`}
            icon={Users}
            color="bg-violet-600"
          />
        </div>
      </div>

      {/* ── Scores de Saúde ── */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <h2 className="text-sm font-semibold text-surface-700 mb-5 flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-600" />
          Índices de Saúde Operacional
        </h2>
        <div className="flex flex-wrap justify-around gap-6">
          <ScoreGauge label="Taxa de Aprovação de Inspeções" score={qualityRate} color="text-emerald-600" />
          <ScoreGauge label="Saúde do Estoque" score={stockHealth} color="text-cyan-600" />
          <ScoreGauge label="Colaboradores Ativos" score={activeRate} color="text-violet-600" />
          <ScoreGauge label="Cobertura 2FA" score={twoFARate} color="text-indigo-600" />
        </div>
      </div>

      {/* ── Distribuição por módulo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Produção */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-surface-900 mb-4 flex items-center gap-2">
            <Factory className="w-4 h-4 text-amber-600" />
            Distribuição de Lotes
          </h3>
          {p && p.totalBatches > 0 ? (
            <div className="space-y-3">
              <HealthBar label="Em Andamento" value={p.inProgress} max={p.totalBatches} color="bg-blue-500" />
              <HealthBar label="Finalizados" value={p.finished} max={p.totalBatches} color="bg-green-500" />
              <HealthBar label="Em Aberto" value={p.openCount} max={p.totalBatches} color="bg-amber-400" />
              <HealthBar label="Cancelados" value={p.cancelled} max={p.totalBatches} color="bg-red-400" />
              <div className="pt-1 text-xs text-surface-400 text-right">{p.totalBatches} lotes no total</div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-6">Sem lotes registrados.</p>
          )}
        </div>

        {/* Qualidade */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-surface-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Resultado de Inspeções
          </h3>
          {q && q.totalRecords > 0 ? (
            <div className="space-y-3">
              <HealthBar label="Aprovadas" value={q.approvedRecords} max={q.totalRecords} color="bg-green-500" />
              <HealthBar label="Pendentes" value={q.pendingRecords} max={q.totalRecords} color="bg-yellow-400" />
              <HealthBar label="Reprovadas" value={q.rejectedRecords} max={q.totalRecords} color="bg-red-500" />
              <HealthBar label="NCs Abertas" value={q.openNCs} max={Math.max(q.totalRecords, q.openNCs)} color="bg-orange-400" />
              <div className="pt-1 text-xs text-surface-400 text-right">{q.totalRecords} inspeções no total</div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-6">Sem inspeções registradas.</p>
          )}
        </div>

        {/* Estoque */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-surface-900 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-600" />
            Situação do Estoque
          </h3>
          {inv && inv.totalItems > 0 ? (
            <div className="space-y-3">
              <HealthBar
                label="Regulares"
                value={(inv.activeItems ?? 0) - (inv.lowStockCount ?? 0)}
                max={inv.totalItems}
                color="bg-green-500"
              />
              <HealthBar label="Abaixo do Mínimo" value={inv.lowStockCount ?? 0} max={inv.totalItems} color="bg-yellow-400" />
              <HealthBar label="Inativos" value={(inv.totalItems ?? 0) - (inv.activeItems ?? 0)} max={inv.totalItems} color="bg-surface-300" />
              <div className="pt-1 text-xs text-surface-400 text-right">{inv.totalMovements} movimentações registradas</div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-6">Sem itens cadastrados.</p>
          )}
        </div>

        {/* RH */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-surface-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            Recursos Humanos
          </h3>
          {hr && hr.total > 0 ? (
            <div className="space-y-3">
              <HealthBar label="Ativos" value={hr.totalActive} max={hr.total} color="bg-green-500" />
              <HealthBar label="Inativos" value={hr.totalInactive} max={hr.total} color="bg-surface-300" />
              <HealthBar label="Com 2FA" value={hr.with2FA} max={hr.total} color="bg-indigo-500" />
              <HealthBar label="Acessaram Hoje" value={hr.loggedToday} max={hr.total} color="bg-blue-400" />
              <div className="pt-1 text-xs text-surface-400 text-right">{hr.total} colaboradores cadastrados</div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-6">Sem colaboradores cadastrados.</p>
          )}
        </div>
      </div>

      {/* ── Alertas estratégicos ── */}
      {!loading && data && (() => {
        const alerts: { msg: string; sev: 'critical' | 'warning' | 'info' }[] = []
        if (q?.criticalNCs && q.criticalNCs > 0)
          alerts.push({ msg: `${q.criticalNCs} não conformidade(s) CRÍTICA(S) em aberto — requer tratativa imediata.`, sev: 'critical' })
        if (inv?.lowStockCount && inv.lowStockCount > 0)
          alerts.push({ msg: `${inv.lowStockCount} item(ns) de estoque abaixo do mínimo — verificar reposição.`, sev: 'warning' })
        if (twoFARate < 60)
          alerts.push({ msg: `Cobertura de 2FA está em ${twoFARate}% — recomendado acima de 80% para segurança.`, sev: 'warning' })
        if (p?.openCount && p.openCount > 5)
          alerts.push({ msg: `${p.openCount} lote(s) em aberto há mais tempo — monitorar progresso.`, sev: 'info' })
        if (alerts.length === 0) return null
        return (
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Alertas Estratégicos
            </h3>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                  a.sev === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                  a.sev === 'warning'  ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {a.msg}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Rodapé */}
      <div className="text-center pb-4">
        <p className="text-xs text-surface-400">
          Visão Executiva · Café Ouro Verde · Gerado em {new Date().toLocaleString('pt-BR')}
        </p>
        <p className="text-xs text-surface-300 mt-0.5">
          Dados consolidados de Produção · Logística · Qualidade · RH
        </p>
      </div>
    </div>
  )
}
