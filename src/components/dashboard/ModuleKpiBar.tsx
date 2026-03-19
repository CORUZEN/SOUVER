'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/Skeleton'

// ─── Tipos ───────────────────────────────────────────────────────

type Module = 'production' | 'inventory' | 'quality' | 'hr'

interface Stat {
  label: string
  value: string | number
  sub?: string
  color: string
}

// ─── Configs por módulo ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStats(module: Module, kpis: any): Stat[] {
  switch (module) {
    case 'production': {
      const p = kpis.production
      return [
        { label: 'Em Andamento', value: p.inProgressCount,  color: 'text-blue-600',   sub: `${p.openCount} abertos` },
        { label: 'Finalizados',  value: p.finished,          color: 'text-green-600',  sub: `${p.finishedToday} hoje` },
        { label: 'Cancelados',   value: p.cancelled,         color: 'text-red-500',    sub: `total` },
        { label: 'Qtd Produzida',value: p.totalProducedQty != null ? Number(p.totalProducedQty).toLocaleString('pt-BR') : '—', color: 'text-amber-600', sub: 'unidades' },
      ]
    }
    case 'inventory': {
      const i = kpis.inventory
      return [
        { label: 'Itens Ativos',   value: i.activeItems,     color: 'text-cyan-600',   sub: `${i.totalItems} total` },
        { label: 'Estoque Baixo',  value: i.lowStockCount,   color: i.lowStockCount > 0 ? 'text-red-600' : 'text-green-600', sub: 'itens abaixo do mínimo' },
        { label: 'Movimentações',  value: i.totalMovements,  color: 'text-violet-600', sub: `${i.movementsToday} hoje` },
      ]
    }
    case 'quality': {
      const q = kpis.quality
      return [
        { label: 'NCs Abertas',    value: q.openNCs,          color: q.openNCs > 0 ? 'text-red-600' : 'text-green-600',    sub: `${q.criticalNCs} críticas` },
        { label: 'Inspeções',      value: q.totalRecords,     color: 'text-emerald-600', sub: `${q.approvedRecords} aprovadas` },
        { label: 'Reprovadas',     value: q.rejectedRecords,  color: q.rejectedRecords > 0 ? 'text-red-500' : 'text-surface-400', sub: 'pendentes de revisão' },
        { label: 'Resolvidas/mês', value: q.resolvedThisMonth, color: 'text-blue-600', sub: 'NCs encerradas' },
      ]
    }
    case 'hr': {
      const h = kpis.hr
      return [
        { label: 'Colaboradores',  value: h.totalActive,   color: 'text-violet-600', sub: `${h.totalInactive} inativos` },
        { label: 'Com 2FA',        value: h.with2FA,       color: 'text-emerald-600', sub: 'configurado' },
        { label: 'Acessos Hoje',   value: h.loggedToday,   color: 'text-blue-600',   sub: 'logins no dia' },
      ]
    }
  }
}

// ─── Componente ───────────────────────────────────────────────────

export default function ModuleKpiBar({ module }: { module: Module }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpis, setKpis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/kpis?period=today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKpis(d) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-surface-400">
        <Spinner /> <span className="text-xs">Carregando indicadores…</span>
      </div>
    )
  }

  if (!kpis) return null

  const stats = buildStats(module, kpis)

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map(({ label, value, sub, color }) => (
        <div
          key={label}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-surface-200 bg-white min-w-32"
        >
          <div>
            <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
            <p className="text-xs font-medium text-surface-700 mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-surface-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
