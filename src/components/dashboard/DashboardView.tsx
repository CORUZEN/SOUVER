'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Skeleton'
import {
  Factory,
  Truck,
  AlertTriangle,
  Users,
  TrendingUp,
  CheckCircle2,
  PlayCircle,
  Package,
  RefreshCw,
} from 'lucide-react'

interface KPIData {
  production: {
    openCount: number
    inProgressCount: number
    finishedToday: number
  }
  inventory: {
    totalItems: number
    lowStockItems: number
    movementsToday: number
  }
  usersActive: number
}

const STATUS_ITEMS = [
  { label: 'Sistema', status: 'online', icon: CheckCircle2, color: 'text-green-500' },
  { label: 'Banco de Dados', status: 'online (Neon)', icon: CheckCircle2, color: 'text-green-500' },
  { label: 'Integrações', status: 'não configuradas', icon: AlertTriangle, color: 'text-orange-500' },
]

export default function DashboardView() {
  const [kpis, setKpis] = useState<KPIData | null>(null)
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
      label: 'Em Andamento',
      value: loadingKpis ? null : kpis?.production.inProgressCount ?? 0,
      sub: `${kpis?.production.openCount ?? 0} aberto${(kpis?.production.openCount ?? 0) !== 1 ? 's' : ''} · ${kpis?.production.finishedToday ?? 0} finalizado${(kpis?.production.finishedToday ?? 0) !== 1 ? 's' : ''} hoje`,
      icon: PlayCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Itens em Estoque',
      value: loadingKpis ? null : kpis?.inventory.totalItems ?? 0,
      sub: `${kpis?.inventory.movementsToday ?? 0} movimentação${(kpis?.inventory.movementsToday ?? 0) !== 1 ? 'ões' : ''} hoje`,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Estoque Mínimo',
      value: loadingKpis ? null : kpis?.inventory.lowStockItems ?? 0,
      sub: 'itens abaixo do mínimo',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Colaboradores Ativos',
      value: loadingKpis ? null : kpis?.usersActive ?? 0,
      sub: 'usuários no sistema',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">
            Painel Executivo
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Visão geral da operação — Fábrica Café Ouro Verde
          </p>
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
          <span className="text-sm text-surface-600 font-medium">
            Sistema Ouro Verde — Fase 2
          </span>
          <Badge variant="success">Online</Badge>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div className="min-w-0 flex-1">
              {value === null ? (
                <div className="flex items-center gap-2 h-8">
                  <Spinner />
                </div>
              ) : (
                <p className="text-2xl font-bold text-surface-900">{value}</p>
              )}
              <p className="text-sm text-surface-600 font-medium truncate">{label}</p>
              <p className="text-xs text-surface-400 truncate">{sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Banner Fase 2 */}
      <Card className="border-primary-200 bg-primary-50">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary-700" />
          </div>
          <div>
            <h3 className="font-semibold text-primary-900 text-sm">
              Fase 2 em andamento — Produção e Logística
            </h3>
            <p className="text-sm text-primary-700 mt-1 leading-relaxed">
              Os módulos de Produção (lotes e apontamentos) e Logística (estoque e movimentações)
              estão ativos. Os KPIs acima são dados reais do banco de dados.
            </p>
          </div>
        </div>
      </Card>

      {/* Status do sistema + Módulos ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STATUS_ITEMS.map(({ label, status, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-surface-700 font-medium">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs text-surface-500 capitalize">
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Módulos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { label: 'Autenticação + 2FA', done: true },
                { label: 'Gestão de Usuários e Perfis', done: true },
                { label: 'Trilha de Auditoria', done: true },
                { label: 'Módulo Produção', done: true },
                { label: 'Módulo Logística / Estoque', done: true },
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
    </div>
  )
}
