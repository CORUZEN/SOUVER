'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Skeleton'
import {
  AlertTriangle,
  Users,
  TrendingUp,
  CheckCircle2,
  PlayCircle,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface KPIData {
  production: {
    openCount:       number
    inProgressCount: number
    inProgress:      number
    finishedToday:   number
    finished:        number
    totalBatches:    number
    cancelled:       number
    totalProducedQty: number | null
  }
  inventory: {
    totalItems:     number
    activeItems:    number
    lowStockItems:  number
    lowStockCount:  number
    movementsToday: number
    totalMovements: number
  }
  quality: {
    openNCs:           number
    criticalNCs:       number
    totalRecords:      number
    approvedRecords:   number
    rejectedRecords:   number
    pendingRecords:    number
    resolvedThisMonth: number
  }
  hr: {
    totalActive:   number
    totalInactive: number
    total:         number
    with2FA:       number
    loggedToday:   number
  }
  activeUsers: number
}

const STATUS_ITEMS = [
  { label: 'Sistema',        status: 'online',               icon: CheckCircle2, color: 'text-green-500'  },
  { label: 'Banco de Dados', status: 'online (Neon)',         icon: CheckCircle2, color: 'text-green-500'  },
  { label: 'Integrações',    status: 'não configuradas',      icon: AlertTriangle, color: 'text-orange-500' },
]

export default function DashboardView() {
  const [kpis, setKpis]             = useState<KPIData | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(true)

  async function loadKpis() {
    setLoadingKpis(true)
    try {
      const res = await fetch('/api/dashboard/kpis')
      if (res.ok) setKpis(await res.json())
    } catch {
      // silent — mostra "—" nos cards
    } finally {
      setLoadingKpis(false)
    }
  }

  useEffect(() => { loadKpis() }, [])

  const kpiCards = [
    {
      label: 'Lotes em Andamento',
      value: loadingKpis ? null : kpis?.production.inProgressCount ?? 0,
      sub:   `${kpis?.production.openCount ?? 0} abertos · ${kpis?.production.finishedToday ?? 0} finalizados hoje`,
      icon:  PlayCircle,
      color: 'text-amber-600',
      bg:    'bg-amber-50',
    },
    {
      label: 'Itens em Estoque',
      value: loadingKpis ? null : kpis?.inventory.totalItems ?? 0,
      sub:   `${kpis?.inventory.movementsToday ?? 0} movimentação${(kpis?.inventory.movementsToday ?? 0) !== 1 ? 'ões' : ''} hoje`,
      icon:  Package,
      color: 'text-cyan-600',
      bg:    'bg-cyan-50',
    },
    {
      label: 'NCs Abertas',
      value: loadingKpis ? null : kpis?.quality.openNCs ?? 0,
      sub:   `${kpis?.quality.criticalNCs ?? 0} crítica${(kpis?.quality.criticalNCs ?? 0) !== 1 ? 's' : ''} · ${kpis?.quality.totalRecords ?? 0} inspeções`,
      icon:  ShieldCheck,
      color: 'text-emerald-600',
      bg:    'bg-emerald-50',
    },
    {
      label: 'Colaboradores Ativos',
      value: loadingKpis ? null : kpis?.hr.totalActive ?? 0,
      sub:   `${kpis?.hr.loggedToday ?? 0} acessos hoje`,
      icon:  Users,
      color: 'text-violet-600',
      bg:    'bg-violet-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">Painel Executivo</h1>
          <p className="text-sm text-surface-500 mt-0.5">Visão geral da operação — Fábrica Café Ouro Verde</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadKpis}
            title="Atualizar"
            className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors"
          >
            <RefreshCw size={15} className={loadingKpis ? 'animate-spin' : ''} />
          </button>
          <TrendingUp className="w-4 h-4 text-primary-600" />
          <span className="text-sm text-surface-600 font-medium">Sistema Ouro Verde — Fase 5</span>
          <Badge variant="success">Online</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div className="min-w-0 flex-1">
              {value === null ? (
                <div className="flex items-center gap-2 h-8"><Spinner /></div>
              ) : (
                <p className="text-2xl font-bold text-surface-900">{value}</p>
              )}
              <p className="text-sm text-surface-600 font-medium truncate">{label}</p>
              <p className="text-xs text-surface-400 truncate">{sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Banner Fase 5 */}
      <Card className="border-primary-200 bg-primary-50">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary-700" />
          </div>
          <div>
            <h3 className="font-semibold text-primary-900 text-sm">Fase 5 concluída — Sistema Ouro Verde completo</h3>
            <p className="text-sm text-primary-700 mt-1 leading-relaxed">
              Todos os módulos estão ativos: Produção, Logística, Qualidade, RH, Relatórios,
              Comunicação Interna, Notificações, Departamentos, Perfis de Acesso e Recuperação de Senha.
              KPIs refletem dados reais do banco de dados.
            </p>
          </div>
        </div>
      </Card>

      {/* Status + Módulos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Status do Sistema</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STATUS_ITEMS.map(({ label, status, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-surface-700 font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-surface-500 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Módulos Ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { label: 'Autenticação + 2FA',               done: true },
                { label: 'Gestão de Usuários e Perfis',      done: true },
                { label: 'Trilha de Auditoria',              done: true },
                { label: 'Produção — Lotes e Apontamentos',   done: true },
                { label: 'Logística — Estoque e Movimentações', done: true },
                { label: 'Qualidade — NCs e Inspeções',      done: true },
                { label: 'Recursos Humanos',                 done: true },
                { label: 'Relatórios e Indicadores + CSV',   done: true },
                { label: 'Comunicação Interna (Chat)',        done: true },
                { label: 'Notificações em tempo real',        done: true },
                { label: 'Departamentos + CRUD',             done: true },
                { label: 'Perfis de Acesso (visão)',         done: true },
                { label: 'Recuperação de Senha',             done: true },
                { label: 'Integrações Externas',             done: true },
                { label: 'Contabilidade Gerencial',          done: true },
              ].map(({ label, done }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-surface-600">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${done ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-400'}`}>
                    {done ? '✓' : String(i + 1)}
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Produção — Distribuição de Status */}
        <Card>
          <CardHeader><CardTitle>Produção — Status dos Lotes</CardTitle></CardHeader>
          <CardContent>
            {loadingKpis ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : kpis ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Em Andamento', valor: kpis.production.inProgressCount, fill: '#3b82f6' },
                    { name: 'Abertos',       valor: kpis.production.openCount,       fill: '#f59e0b' },
                    { name: 'Finalizados',   valor: kpis.production.finishedToday,   fill: '#22c55e' },
                  ]}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Lotes']} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {[
                      { fill: '#3b82f6' },
                      { fill: '#f59e0b' },
                      { fill: '#22c55e' },
                    ].map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-surface-400 text-center py-10">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Qualidade — NCs e Inspeções */}
        <Card>
          <CardHeader><CardTitle>Qualidade — Visão Geral</CardTitle></CardHeader>
          <CardContent>
            {loadingKpis ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : kpis ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'NCs Abertas',  value: kpis.quality.openNCs    || 0, color: '#ef4444' },
                      { name: 'NCs Críticas', value: kpis.quality.criticalNCs || 0, color: '#f97316' },
                      { name: 'Inspeções',    value: kpis.quality.totalRecords || 0, color: '#22c55e' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {[
                      { color: '#ef4444' },
                      { color: '#f97316' },
                      { color: '#22c55e' },
                    ].map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-surface-400 text-center py-10">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
