'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRight,
  Plug,
  Globe,
  Zap,
  XCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Skeleton'

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KpiData {
  production?: {
    totalBatches:     number
    inProgress:       number
    finished:         number
    cancelled:        number
    totalProducedQty: number | null
    openCount:        number
    finishedToday:    number
  }
  inventory?: {
    totalItems:      number
    activeItems:     number
    lowStockCount:   number
    totalMovements:  number
    movementsToday:  number
  }
  quality?: {
    totalRecords:       number
    approvedRecords:    number
    rejectedRecords:    number
    openNCs:            number
    criticalNCs:        number
    resolvedThisMonth:  number
  }
  hr?: {
    total:       number
    totalActive: number
    with2FA:     number
    loggedToday: number
  }
  activeUsers?: number
}

interface IntegrationSummary {
  id: string; name: string; provider: string; status: string
  lastSyncAt: string | null; lastSyncStatus: string | null
  _count: { logs: number }
}
interface IntegrationLog {
  id: string; eventType: string; status: string; message: string | null
  durationMs: number | null; recordsAffected: number | null; executedAt: string
  integration: { name: string; provider: string }
}
interface IntegrationData {
  integrations: IntegrationSummary[]
  recentLogs:   IntegrationLog[]
  summary: {
    total: number; active: number; error: number; inactive: number
    successRate: number; totalLogs30d: number; errorLogs30d: number
  }
}

// â”€â”€â”€ Componentes auxiliares â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  trend,
}: {
  label:   string
  value:   string | number | null
  sub?:    string
  icon:    React.ComponentType<{ className?: string }>
  iconBg:  string
  trend?:  'up' | 'down' | 'neutral'
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend === 'up'   && <TrendingUp   className="w-4 h-4 text-emerald-500" />}
        {trend === 'down' && <TrendingDown  className="w-4 h-4 text-red-500" />}
        {trend === 'neutral' && <Activity className="w-4 h-4 text-surface-400" />}
      </div>
      <div>
        <p className="text-xs text-surface-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-surface-900 mt-0.5">
          {value === null ? <Spinner /> : value}
        </p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

function SectionCard({
  title,
  icon: Icon,
  iconBg,
  children,
}: {
  title:   string
  icon:    React.ComponentType<{ className?: string }>
  iconBg:  string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
      <span className="text-sm text-surface-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-red-600' : 'text-surface-900'}`}>{value}</span>
    </div>
  )
}

// â”€â”€â”€ PÃ¡gina principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ContabilidadePage() {
  const [data, setData]       = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [intData, setIntData] = useState<IntegrationData | null>(null)
  const [intLoading, setIntLoading] = useState(false)
  const [canAccessIntegrations, setCanAccessIntegrations] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/kpis?variation=false')
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [])

  const fetchIntegrations = useCallback(async () => {
    if (!canAccessIntegrations) return
    setIntLoading(true)
    try {
      const res = await fetch('/api/integrations/summary')
      if (res.ok) setIntData(await res.json())
    } catch { /* silencioso */ }
    finally { setIntLoading(false) }
  }, [canAccessIntegrations])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setCanAccessIntegrations(Boolean(data?.user?.canAccessIntegrations)))
      .catch(() => setCanAccessIntegrations(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!canAccessIntegrations) {
      setIntData(null)
      return
    }
    fetchIntegrations()
  }, [canAccessIntegrations, fetchIntegrations])

  const p  = data?.production
  const inv = data?.inventory
  const q  = data?.quality
  const hr = data?.hr

  const approvalRate = q && q.totalRecords > 0
    ? Math.round((q.approvedRecords / q.totalRecords) * 100)
    : null

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* â”€â”€ CabeÃ§alho â”€â”€ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900 leading-tight">Contabilidade</h1>
            <p className="text-xs text-surface-500">VisÃ£o gerencial consolidada â€” CafÃ© Ouro Verde</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-600 border border-surface-200 rounded-lg hover:bg-surface-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* â”€â”€ KPIs resumo â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Lotes em ProduÃ§Ã£o"
          value={loading ? null : p?.inProgress ?? 0}
          sub={`${p?.finished ?? 0} finalizados hoje`}
          icon={Factory}
          iconBg="bg-amber-600"
          trend="neutral"
        />
        <KpiCard
          label="Itens em Estoque"
          value={loading ? null : inv?.totalItems ?? 0}
          sub={`${inv?.lowStockCount ?? 0} com estoque baixo`}
          icon={Package}
          iconBg="bg-cyan-600"
          trend={inv?.lowStockCount ? 'down' : 'up'}
        />
        <KpiCard
          label="NCs Abertas"
          value={loading ? null : q?.openNCs ?? 0}
          sub={`${q?.criticalNCs ?? 0} crÃ­ticas`}
          icon={AlertTriangle}
          iconBg="bg-red-600"
          trend={q?.openNCs ? 'down' : 'up'}
        />
        <KpiCard
          label="Colaboradores Ativos"
          value={loading ? null : hr?.totalActive ?? 0}
          sub={`${hr?.loggedToday ?? 0} conectados hoje`}
          icon={Users}
          iconBg="bg-violet-600"
          trend="up"
        />
      </div>

      {/* â”€â”€ SeÃ§Ãµes por mÃ³dulo â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ProduÃ§Ã£o */}
        <SectionCard title="ProduÃ§Ã£o â€” Lotes" icon={Factory} iconBg="bg-amber-600">
          {loading ? <Spinner /> : p ? (
            <>
              <Row label="Total de lotes cadastrados" value={p.totalBatches}       />
              <Row label="Lotes em andamento"          value={p.inProgress}        />
              <Row label="Lotes abertos (aguardando)"  value={p.openCount}         />
              <Row label="Finalizados hoje"            value={p.finishedToday}     />
              <Row label="Cancelados"                  value={p.cancelled}  highlight={p.cancelled > 0} />
              <Row label="Volume produzido (kg/un)"    value={p.totalProducedQty ?? 'â€”'} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* Estoque */}
        <SectionCard title="LogÃ­stica â€” Estoque" icon={Truck} iconBg="bg-cyan-600">
          {loading ? <Spinner /> : inv ? (
            <>
              <Row label="Total de itens"                value={inv.totalItems}    />
              <Row label="Itens ativos"                  value={inv.activeItems}   />
              <Row label="Itens com estoque crÃ­tico"     value={inv.lowStockCount} highlight={inv.lowStockCount > 0} />
              <Row label="MovimentaÃ§Ãµes totais"          value={inv.totalMovements} />
              <Row label="MovimentaÃ§Ãµes hoje"            value={inv.movementsToday ?? 0} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* Qualidade */}
        <SectionCard title="Qualidade â€” InspeÃ§Ãµes e NCs" icon={ShieldCheck} iconBg="bg-emerald-600">
          {loading ? <Spinner /> : q ? (
            <>
              <Row label="Total de inspeÃ§Ãµes realizadas"    value={q.totalRecords}        />
              <Row label="InspeÃ§Ãµes aprovadas"              value={q.approvedRecords}     />
              <Row label="InspeÃ§Ãµes reprovadas"             value={q.rejectedRecords}     highlight={q.rejectedRecords > 0} />
              <Row label="Taxa de aprovaÃ§Ã£o"                value={approvalRate !== null ? `${approvalRate}%` : 'â€”'} />
              <Row label="NCs abertas"                      value={q.openNCs}             highlight={q.openNCs > 0} />
              <Row label="NCs crÃ­ticas"                     value={q.criticalNCs}         highlight={q.criticalNCs > 0} />
              <Row label="NCs resolvidas no mÃªs"            value={q.resolvedThisMonth}   />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* RH */}
        <SectionCard title="Recursos Humanos" icon={Users} iconBg="bg-violet-600">
          {loading ? <Spinner /> : hr ? (
            <>
              <Row label="Total de colaboradores"        value={hr.total}         />
              <Row label="Colaboradores ativos"          value={hr.totalActive}   />
              <Row label="Com autenticaÃ§Ã£o 2FA ativa"    value={hr.with2FA}       />
              <Row label="Conectados hoje"               value={hr.loggedToday}   />
              <Row label="UsuÃ¡rios online agora"         value={data?.activeUsers ?? 0} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

      </div>

      {/* â”€â”€ Indicadores de desempenho â”€â”€ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <CardTitle>Indicadores de Desempenho Operacional</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'EficiÃªncia de ProduÃ§Ã£o',
                value: p && p.totalBatches > 0
                  ? `${Math.round(((p.finished) / p.totalBatches) * 100)}%`
                  : 'â€”',
                desc: 'Lotes concluÃ­dos / total',
                good: true,
              },
              {
                label: 'Taxa de Qualidade',
                value: approvalRate !== null ? `${approvalRate}%` : 'â€”',
                desc: 'InspeÃ§Ãµes aprovadas',
                good: approvalRate !== null && approvalRate >= 90,
              },
              {
                label: 'Cobertura 2FA',
                value: hr && hr.total > 0
                  ? `${Math.round((hr.with2FA / hr.total) * 100)}%`
                  : 'â€”',
                desc: 'Colaboradores protegidos',
                good: hr ? hr.with2FA === hr.total : false,
              },
              {
                label: 'OcupaÃ§Ã£o Estoque',
                value: inv && inv.totalItems > 0
                  ? `${inv.activeItems} items`
                  : 'â€”',
                desc: `${inv?.lowStockCount ?? 0} abaixo do mÃ­nimo`,
                good: !inv?.lowStockCount,
              },
            ].map(({ label, value, desc, good }) => (
              <div key={label} className="rounded-xl border border-surface-100 p-4 flex flex-col gap-1.5">
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {label}
                </div>
                <p className="text-2xl font-bold text-surface-900">{value}</p>
                <p className="text-xs text-surface-400">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* â”€â”€ IntegraÃ§Ãµes Externas â€” VisÃ£o EstratÃ©gica â”€â”€ */}
      {canAccessIntegrations && <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <CardTitle>IntegraÃ§Ãµes Externas â€” Fontes de Dados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {intLoading ? <Spinner /> : !intData ? (
            <p className="text-sm text-surface-400">Dados indisponÃ­veis</p>
          ) : (
            <div className="space-y-4">
              {/* KPIs de integraÃ§Ãµes */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-surface-100 p-3 text-center">
                  <p className="text-2xl font-bold text-surface-900">{intData.summary.total}</p>
                  <p className="text-xs text-surface-500">IntegraÃ§Ãµes</p>
                </div>
                <div className="rounded-xl border border-surface-100 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{intData.summary.active}</p>
                  <p className="text-xs text-surface-500">Ativas</p>
                </div>
                <div className="rounded-xl border border-surface-100 p-3 text-center">
                  <p className={`text-2xl font-bold ${intData.summary.error > 0 ? 'text-red-600' : 'text-surface-900'}`}>{intData.summary.error}</p>
                  <p className="text-xs text-surface-500">Com Erro</p>
                </div>
                <div className="rounded-xl border border-surface-100 p-3 text-center">
                  <p className={`text-2xl font-bold ${intData.summary.successRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{intData.summary.successRate}%</p>
                  <p className="text-xs text-surface-500">Taxa de Sucesso (30d)</p>
                </div>
              </div>

              {/* Lista de integraÃ§Ãµes */}
              {intData.integrations.length > 0 && (
                <div className="space-y-2">
                  {intData.integrations.map((ig) => (
                    <div key={ig.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-surface-100 hover:bg-surface-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        {ig.status === 'ACTIVE' ? <Zap className="w-4 h-4 text-emerald-500" /> :
                         ig.status === 'ERROR'  ? <XCircle className="w-4 h-4 text-red-500" /> :
                         <Plug className="w-4 h-4 text-surface-400" />}
                        <div>
                          <p className="text-sm font-medium text-surface-800">{ig.name}</p>
                          <p className="text-[11px] text-surface-400 capitalize">{ig.provider.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ig.status === 'ACTIVE'  ? 'bg-emerald-100 text-emerald-700' :
                          ig.status === 'ERROR'   ? 'bg-red-100 text-red-700' :
                          ig.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-surface-100 text-surface-600'
                        }`}>{ig.status}</span>
                        {ig.lastSyncAt && (
                          <p className="text-[10px] text-surface-400 mt-0.5">
                            Ãšltimo sync: {new Date(ig.lastSyncAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ãšltimos logs */}
              {intData.recentLogs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-surface-600 mb-2">Ãšltimas Atividades</p>
                  <div className="space-y-1">
                    {intData.recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs py-1.5 border-b border-surface-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : log.status === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="text-surface-700 font-medium">{log.integration.name}</span>
                          <span className="text-surface-400">{log.eventType}</span>
                        </div>
                        <div className="flex items-center gap-3 text-surface-400">
                          {log.recordsAffected != null && <span>{log.recordsAffected} reg.</span>}
                          {log.durationMs != null && <span>{log.durationMs}ms</span>}
                          <span>{new Date(log.executedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center pt-2">
                <Link href="/integracoes" className="text-xs text-primary-600 hover:underline font-medium">
                  Gerenciar IntegraÃ§Ãµes â†’
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* â”€â”€ Links rÃ¡pidos â”€â”€ */}
      <Card>
        <CardHeader>
          <CardTitle>NavegaÃ§Ã£o RÃ¡pida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'ProduÃ§Ã£o',    href: '/producao',    icon: Factory,      bg: 'bg-amber-50',   text: 'text-amber-700'   },
              { label: 'LogÃ­stica',   href: '/logistica',   icon: Truck,        bg: 'bg-cyan-50',    text: 'text-cyan-700'    },
              { label: 'Qualidade',   href: '/qualidade',   icon: ShieldCheck,  bg: 'bg-emerald-50', text: 'text-emerald-700' },
              { label: 'RelatÃ³rios',  href: '/relatorios',  icon: TrendingUp,   bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
              { label: 'RH',          href: '/rh',          icon: Users,        bg: 'bg-violet-50',  text: 'text-violet-700'  },
              { label: 'IntegraÃ§Ãµes', href: '/integracoes', icon: Plug,         bg: 'bg-surface-50', text: 'text-surface-700' },
            ].filter((item) => item.href !== '/integracoes' || canAccessIntegrations).map(({ label, href, icon: Icon, bg, text }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl ${bg} border border-transparent hover:border-surface-200 transition-colors group`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${text}`} />
                  <span className={`text-sm font-medium ${text}`}>{label}</span>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 ${text} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
