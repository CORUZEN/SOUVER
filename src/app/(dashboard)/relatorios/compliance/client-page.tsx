'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, ArrowLeft, RefreshCw, Download,
  AlertTriangle, Users, LogIn, Key, Activity,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────

interface ModuleActivity { module: string; count: number }
interface CriticalEvent {
  id: string; action: string; module: string; description: string | null
  ipAddress: string | null; createdAt: string
  user: { fullName: string; login: string } | null
}
interface TopUser { userId: string | null; fullName: string; login: string; count: number }
interface ComplianceData {
  activityByModule:  ModuleActivity[]
  criticalEvents:    CriticalEvent[]
  topUsers:          TopUser[]
  loginStats:        { success: number; failed: number; blocked: number }
  twoFaStats:        { with: number; without: number }
  summary: {
    totalEvents:    number
    criticalCount:  number
    loginFailRate:  number
    twoFaAdoption:  number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

const CRITICAL_BADGE: Record<string, 'error' | 'warning' | 'success' | 'secondary'> = {
  LOGIN_FAILED:       'error',
  LOGIN_BLOCKED:      'error',
  '2FA_DISABLED':     'warning',
  USER_DELETED:       'error',
  PERMISSION_CHANGED: 'warning',
  USER_CREATED:       'success',
  SYSTEM_CLEANUP:     'secondary',
}

function SummaryCard({ label, value, sub, colorClass }: {
  label: string; value: string | number; sub?: string; colorClass?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 px-5 py-4">
      <p className={`text-3xl font-bold ${colorClass ?? 'text-surface-900'}`}>{value}</p>
      <p className="text-xs font-medium text-surface-700 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────

export default function CompliancePage() {
  const [data, setData]       = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const anchorRef = useRef<HTMLAnchorElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit/compliance')
      if (!res.ok) throw new Error('Erro ao carregar dados de compliance')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const exportCsv = useCallback(async () => {
    if (!data) return
    setExporting(true)
    try {
      // Gera CSV de eventos críticos no cliente (dados já em memória)
      const header = 'Data/Hora,Usuário,Login,Módulo,Ação,Descrição,IP'
      const rows = data.criticalEvents.map((e) =>
        [
          e.createdAt,
          e.user?.fullName ?? '',
          e.user?.login ?? '',
          e.module,
          e.action,
          (e.description ?? '').replace(/,/g, ';'),
          e.ipAddress ?? '',
        ].join(',')
      )
      const csv  = [header, ...rows].join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = anchorRef.current!
      a.href     = url
      a.download = `compliance_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [data])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-surface-400 text-sm">
      Carregando relatório de compliance…
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="text-sm text-primary-600 underline">Tentar novamente</button>
    </div>
  )

  if (!data) return null

  const { summary, activityByModule, criticalEvents, topUsers, loginStats, twoFaStats } = data
  const totalLogin = loginStats.success + loginStats.failed + loginStats.blocked

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/relatorios"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              Relatório de Compliance
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">Auditoria de segurança — últimos 30 dias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting || !data}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-surface-300 text-surface-600 text-sm hover:bg-surface-100 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button
            onClick={load}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-surface-300 text-surface-500 hover:bg-surface-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Total de eventos (30d)" value={summary.totalEvents.toLocaleString('pt-BR')} />
        <SummaryCard
          label="Eventos críticos"
          value={summary.criticalCount}
          colorClass={summary.criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          sub="Últimos 30 dias"
        />
        <SummaryCard
          label="Taxa de falha de login"
          value={`${summary.loginFailRate}%`}
          colorClass={summary.loginFailRate > 10 ? 'text-red-600' : summary.loginFailRate > 5 ? 'text-amber-600' : 'text-emerald-600'}
          sub="Últimos 7 dias"
        />
        <SummaryCard
          label="Adoção de 2FA"
          value={`${summary.twoFaAdoption}%`}
          colorClass={summary.twoFaAdoption >= 80 ? 'text-emerald-600' : summary.twoFaAdoption >= 50 ? 'text-amber-600' : 'text-red-600'}
          sub={`${twoFaStats.with} com 2FA · ${twoFaStats.without} sem`}
        />
      </div>

      {/* Dois painéis: atividade por módulo + logins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Atividade por módulo */}
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-surface-900 text-sm">Atividade por Módulo (30d)</h2>
          </div>
          <div className="space-y-2">
            {activityByModule.length === 0 && (
              <p className="text-xs text-surface-400 italic">Nenhum evento registrado</p>
            )}
            {activityByModule.map((m) => {
              const pct = summary.totalEvents > 0 ? Math.round((m.count / summary.totalEvents) * 100) : 0
              return (
                <div key={m.module}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-surface-700 capitalize">{m.module}</span>
                    <span className="text-xs text-surface-500">{m.count.toLocaleString('pt-BR')} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Logins (7d) + 2FA */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-surface-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <LogIn className="w-4 h-4 text-cyan-600" />
              <h2 className="font-semibold text-surface-900 text-sm">Logins — Últimos 7 Dias</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-emerald-600">{loginStats.success.toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-surface-500">Sucesso</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{loginStats.failed.toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-surface-500">Falha</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{loginStats.blocked.toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-surface-500">Bloqueado</p>
              </div>
            </div>
            {totalLogin > 0 && (
              <div className="mt-3 h-2 bg-surface-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.round(loginStats.success / totalLogin * 100)}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${Math.round(loginStats.failed / totalLogin * 100)}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${Math.round(loginStats.blocked / totalLogin * 100)}%` }} />
              </div>
            )}
          </div>

          {/* Top usuários */}
          <div className="bg-white rounded-xl border border-surface-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-violet-600" />
              <h2 className="font-semibold text-surface-900 text-sm">Usuários Mais Ativos (30d)</h2>
            </div>
            {topUsers.length === 0 ? (
              <p className="text-xs text-surface-400 italic">Nenhum dado</p>
            ) : (
              <div className="space-y-1.5">
                {topUsers.slice(0, 5).map((u, i) => (
                  <div key={u.userId ?? i} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-surface-800">{u.fullName}</p>
                      <p className="text-[11px] text-surface-400">{u.login}</p>
                    </div>
                    <span className="text-xs text-surface-600 font-mono">{u.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Eventos críticos */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h2 className="font-semibold text-surface-900 text-sm">
            Eventos Críticos — Últimos 30 Dias
          </h2>
          <span className="ml-auto text-xs text-surface-400">Máx. 50 registros</span>
        </div>
        {criticalEvents.length === 0 ? (
          <p className="text-xs text-surface-400 italic py-4 text-center">
            Nenhum evento crítico no período — ótimo sinal!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="text-left py-2 pr-3 text-surface-500 font-medium whitespace-nowrap">Data/Hora</th>
                  <th className="text-left py-2 pr-3 text-surface-500 font-medium">Usuário</th>
                  <th className="text-left py-2 pr-3 text-surface-500 font-medium">Ação</th>
                  <th className="text-left py-2 pr-3 text-surface-500 font-medium">Módulo</th>
                  <th className="text-left py-2 pr-3 text-surface-500 font-medium">Descrição</th>
                  <th className="text-left py-2 text-surface-500 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {criticalEvents.map((e) => (
                  <tr key={e.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="py-2 pr-3 text-surface-500 font-mono whitespace-nowrap">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="py-2 pr-3">
                      {e.user ? (
                        <div>
                          <p className="font-medium text-surface-800">{e.user.fullName}</p>
                          <p className="text-surface-400">{e.user.login}</p>
                        </div>
                      ) : (
                        <span className="text-surface-400 italic">Sistema</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={CRITICAL_BADGE[e.action] ?? 'secondary'} className="font-mono">
                        {e.action}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-surface-600 capitalize">{e.module}</td>
                    <td className="py-2 pr-3 text-surface-600 max-w-xs truncate">{e.description ?? '—'}</td>
                    <td className="py-2 text-surface-400 font-mono">{e.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* âncora oculta para download */}
      <a ref={anchorRef} className="hidden" aria-hidden />
    </div>
  )
}
