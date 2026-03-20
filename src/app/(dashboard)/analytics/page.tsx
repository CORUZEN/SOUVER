'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Package,
  AlertTriangle,
  Truck,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

interface AnalyticsData {
  period: number
  since: string
  modules: { module: string; count: number }[]
  actions: { action: string; count: number }[]
  topUsers: { userId: string; name: string; login: string; actions: number }[]
  dailyActivity: { day: string; count: number }[]
  production: { byStatus: { status: string; count: number }[] }
  quality: { bySeverity: { severity: string; count: number }[] }
  logistics: { byType: { type: string; count: number }[] }
}

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

const MODULE_LABELS: Record<string, string> = {
  production: 'Produção',
  warehouse: 'Logística',
  logistics: 'Logística',
  quality: 'Qualidade',
  auth: 'Autenticação',
  admin: 'Admin',
  hr: 'RH',
  system: 'Sistema',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em Andamento',
  PAUSED: 'Pausado',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
  TRANSFER: 'Transferência',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolução',
  WASTE: 'Perda',
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch {
      /* silenced */
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  const totalActions = data?.modules.reduce((s, m) => s + m.count, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Analytics Avançado
          </h1>
          <p className="text-sm text-gray-500 mt-1">Visão analítica detalhada por módulo, usuário e período</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Activity} label="Total de Ações" value={totalActions.toLocaleString('pt-BR')} color="blue" />
            <KpiCard icon={Users} label="Usuários Ativos" value={String(data.topUsers.length)} color="green" />
            <KpiCard icon={Package} label="Lotes no Período" value={String(data.production.byStatus.reduce((s, b) => s + b.count, 0))} color="purple" />
            <KpiCard icon={AlertTriangle} label="NCs Abertas" value={String(data.quality.bySeverity.reduce((s, n) => s + n.count, 0))} color="amber" />
          </div>

          {/* Timeline de Atividade */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Atividade Diária
            </h2>
            <ResponsiveContainer width="100%" height={256}>
                <LineChart data={data.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} tickFormatter={(v) => {
                    const d = new Date(v)
                    return `${d.getDate()}/${d.getMonth()+1}`
                  }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleDateString('pt-BR')} />
                  <Line type="monotone" dataKey="count" name="Ações" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
          </div>

          {/* Ações por Módulo + Top Usuários */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por Módulo */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações por Módulo</h2>
              <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={data.modules.map((m) => ({ ...m, label: MODULE_LABELS[m.module] ?? m.module }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Ações" fill="#2563eb" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Top Usuários */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-green-600" />
                Top 10 Usuários Mais Ativos
              </h2>
              <div className="space-y-2">
                {data.topUsers.map((u, i) => (
                  <div key={u.userId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5">#{i+1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.login}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{u.actions.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                {data.topUsers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum dado no período</p>
                )}
              </div>
            </div>
          </div>

          {/* Produção, Qualidade, Logística */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Produção por Status */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-purple-600" />
                Produção por Status
              </h2>
              <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={data.production.byStatus.map((b) => ({ ...b, label: STATUS_LABELS[b.status] ?? b.status }))}
                      dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                    >
                      {data.production.byStatus.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {data.production.byStatus.map((b, i) => (
                  <span key={b.status} className="flex items-center gap-1 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {STATUS_LABELS[b.status] ?? b.status} ({b.count})
                  </span>
                ))}
              </div>
            </div>

            {/* Qualidade por Severidade */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                NCs por Severidade
              </h2>
              <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={data.quality.bySeverity.map((n) => ({ ...n, label: SEVERITY_LABELS[n.severity] ?? n.severity }))}
                      dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                    >
                      {data.quality.bySeverity.map((_, i) => (
                        <Cell key={i} fill={['#16a34a','#eab308','#f97316','#ef4444'][i] ?? COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {data.quality.bySeverity.map((n, i) => (
                  <span key={n.severity} className="flex items-center gap-1 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#16a34a','#eab308','#f97316','#ef4444'][i] ?? COLORS[i] }} />
                    {SEVERITY_LABELS[n.severity] ?? n.severity} ({n.count})
                  </span>
                ))}
              </div>
            </div>

            {/* Logística por Tipo */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Truck className="h-4 w-4 text-cyan-600" />
                Movimentações por Tipo
              </h2>
              <ResponsiveContainer width="100%" height={192}>
                  <BarChart data={data.logistics.byType.map((m) => ({ ...m, label: MOVEMENT_LABELS[m.type] ?? m.type }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Qtd" fill="#06b6d4" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* Tipos de Ação mais frequentes */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipos de Ação Mais Frequentes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.actions.map((a) => (
                <div key={a.action} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                  <span className="text-xs font-medium text-gray-700 truncate">{a.action}</span>
                  <span className="text-xs font-bold text-blue-600 ml-2">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-gray-500">Não foi possível carregar os dados de analytics.</div>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${colors[color] ?? 'bg-gray-50 text-gray-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
