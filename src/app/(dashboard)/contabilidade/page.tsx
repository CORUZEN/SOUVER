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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Skeleton'

// ─── Tipos ───────────────────────────────────────────────────────

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

// ─── Componentes auxiliares ──────────────────────────────────────

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

// ─── Página principal ────────────────────────────────────────────

export default function ContabilidadePage() {
  const [data, setData]       = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/kpis')
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const p  = data?.production
  const inv = data?.inventory
  const q  = data?.quality
  const hr = data?.hr

  const approvalRate = q && q.totalRecords > 0
    ? Math.round((q.approvedRecords / q.totalRecords) * 100)
    : null

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900 leading-tight">Contabilidade</h1>
            <p className="text-xs text-surface-500">Visão gerencial consolidada — Café Ouro Verde</p>
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

      {/* ── KPIs resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Lotes em Produção"
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
          sub={`${q?.criticalNCs ?? 0} críticas`}
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

      {/* ── Seções por módulo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Produção */}
        <SectionCard title="Produção — Lotes" icon={Factory} iconBg="bg-amber-600">
          {loading ? <Spinner /> : p ? (
            <>
              <Row label="Total de lotes cadastrados" value={p.totalBatches}       />
              <Row label="Lotes em andamento"          value={p.inProgress}        />
              <Row label="Lotes abertos (aguardando)"  value={p.openCount}         />
              <Row label="Finalizados hoje"            value={p.finishedToday}     />
              <Row label="Cancelados"                  value={p.cancelled}  highlight={p.cancelled > 0} />
              <Row label="Volume produzido (kg/un)"    value={p.totalProducedQty ?? '—'} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* Estoque */}
        <SectionCard title="Logística — Estoque" icon={Truck} iconBg="bg-cyan-600">
          {loading ? <Spinner /> : inv ? (
            <>
              <Row label="Total de itens"                value={inv.totalItems}    />
              <Row label="Itens ativos"                  value={inv.activeItems}   />
              <Row label="Itens com estoque crítico"     value={inv.lowStockCount} highlight={inv.lowStockCount > 0} />
              <Row label="Movimentações totais"          value={inv.totalMovements} />
              <Row label="Movimentações hoje"            value={inv.movementsToday ?? 0} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* Qualidade */}
        <SectionCard title="Qualidade — Inspeções e NCs" icon={ShieldCheck} iconBg="bg-emerald-600">
          {loading ? <Spinner /> : q ? (
            <>
              <Row label="Total de inspeções realizadas"    value={q.totalRecords}        />
              <Row label="Inspeções aprovadas"              value={q.approvedRecords}     />
              <Row label="Inspeções reprovadas"             value={q.rejectedRecords}     highlight={q.rejectedRecords > 0} />
              <Row label="Taxa de aprovação"                value={approvalRate !== null ? `${approvalRate}%` : '—'} />
              <Row label="NCs abertas"                      value={q.openNCs}             highlight={q.openNCs > 0} />
              <Row label="NCs críticas"                     value={q.criticalNCs}         highlight={q.criticalNCs > 0} />
              <Row label="NCs resolvidas no mês"            value={q.resolvedThisMonth}   />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

        {/* RH */}
        <SectionCard title="Recursos Humanos" icon={Users} iconBg="bg-violet-600">
          {loading ? <Spinner /> : hr ? (
            <>
              <Row label="Total de colaboradores"        value={hr.total}         />
              <Row label="Colaboradores ativos"          value={hr.totalActive}   />
              <Row label="Com autenticação 2FA ativa"    value={hr.with2FA}       />
              <Row label="Conectados hoje"               value={hr.loggedToday}   />
              <Row label="Usuários online agora"         value={data?.activeUsers ?? 0} />
            </>
          ) : <p className="text-sm text-surface-400">Sem dados</p>}
        </SectionCard>

      </div>

      {/* ── Indicadores de desempenho ── */}
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
                label: 'Eficiência de Produção',
                value: p && p.totalBatches > 0
                  ? `${Math.round(((p.finished) / p.totalBatches) * 100)}%`
                  : '—',
                desc: 'Lotes concluídos / total',
                good: true,
              },
              {
                label: 'Taxa de Qualidade',
                value: approvalRate !== null ? `${approvalRate}%` : '—',
                desc: 'Inspeções aprovadas',
                good: approvalRate !== null && approvalRate >= 90,
              },
              {
                label: 'Cobertura 2FA',
                value: hr && hr.total > 0
                  ? `${Math.round((hr.with2FA / hr.total) * 100)}%`
                  : '—',
                desc: 'Colaboradores protegidos',
                good: hr ? hr.with2FA === hr.total : false,
              },
              {
                label: 'Ocupação Estoque',
                value: inv && inv.totalItems > 0
                  ? `${inv.activeItems} items`
                  : '—',
                desc: `${inv?.lowStockCount ?? 0} abaixo do mínimo`,
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

      {/* ── Links rápidos ── */}
      <Card>
        <CardHeader>
          <CardTitle>Navegação Rápida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Produção',    href: '/producao',    icon: Factory,      bg: 'bg-amber-50',   text: 'text-amber-700'   },
              { label: 'Logística',   href: '/logistica',   icon: Truck,        bg: 'bg-cyan-50',    text: 'text-cyan-700'    },
              { label: 'Qualidade',   href: '/qualidade',   icon: ShieldCheck,  bg: 'bg-emerald-50', text: 'text-emerald-700' },
              { label: 'Relatórios',  href: '/relatorios',  icon: TrendingUp,   bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
              { label: 'RH',          href: '/rh',          icon: Users,        bg: 'bg-violet-50',  text: 'text-violet-700'  },
              { label: 'Integrações', href: '/integracoes', icon: Plug,         bg: 'bg-surface-50', text: 'text-surface-700' },
            ].map(({ label, href, icon: Icon, bg, text }) => (
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
