'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Search, RefreshCw, Download } from 'lucide-react'
import Select from '@/components/ui/Select'
import Table, { Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

interface AuditEntry {
  id: string
  module: string
  action: string
  description: string | null
  entityType: string | null
  ipAddress: string | null
  createdAt: string
  user: { id: string; fullName: string; login: string } | null
}

const PERIOD_OPTIONS = [
  { value: '1h', label: 'Última hora' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
]

const MODULE_OPTIONS = [
  { value: '', label: 'Todos os módulos' },
  { value: 'auth', label: 'Autenticação' },
  { value: 'users', label: 'Usuários' },
  { value: 'production', label: 'Produção' },
  { value: 'logistics', label: 'Logística' },
  { value: 'quality', label: 'Qualidade' },
  { value: 'system', label: 'Sistema' },
]

const ACTION_BADGE: Record<string, 'success' | 'error' | 'warning' | 'secondary'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILED: 'error',
  LOGIN_BLOCKED: 'error',
  LOGOUT: 'secondary',
  USER_CREATED: 'success',
  USER_UPDATED: 'secondary',
  '2FA_ENABLED': 'success',
  '2FA_DISABLED': 'warning',
}

const PAGE_SIZE = 50

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('7d')
  const [module, setModule] = useState('')
  const [exporting, setExporting] = useState(false)
  const anchorRef = useRef<HTMLAnchorElement>(null)

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        period,
        ...(search && { search }),
        ...(module && { module }),
      })
      const res = await fetch(`/api/audit/export?${params}`)
      if (!res.ok) throw new Error('Erro ao exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = anchorRef.current!
      a.href = url
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silencioso — erro exibido naturalmente pela ausência do download
    } finally {
      setExporting(false)
    }
  }, [period, search, module])

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        period,
        ...(search && { search }),
        ...(module && { module }),
      })
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar trilha de auditoria')
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, period, module])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { setPage(1) }, [search, period, module])

  const columns: Column<AuditEntry>[] = [
    {
      key: 'createdAt',
      header: 'Data / Hora',
      render: (val) => (
        <span className="text-xs text-surface-600 whitespace-nowrap font-mono">
          {formatDateTime(String(val))}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Usuário',
      render(_, row) {
        return row.user ? (
          <div>
            <p className="text-sm font-medium text-surface-800">{row.user.fullName}</p>
            <p className="text-xs text-surface-400">{row.user.login}</p>
          </div>
        ) : (
          <span className="text-xs text-surface-400 italic">Sistema</span>
        )
      },
    },
    {
      key: 'module',
      header: 'Módulo',
      render: (val) => (
        <Badge variant="secondary" className="text-xs capitalize">{String(val)}</Badge>
      ),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (val) => {
        const variant = ACTION_BADGE[String(val)] ?? 'secondary'
        return <Badge variant={variant} className="text-xs font-mono">{String(val)}</Badge>
      },
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (val) => (
        <span className="text-xs text-surface-600 max-w-xs truncate block">
          {val ? String(val) : '—'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (val) => (
        <span className="text-xs text-surface-400 font-mono">{val ? String(val) : '—'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            Trilha de Auditoria
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {total} {total === 1 ? 'registro encontrado' : 'registros encontrados'} no período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-surface-300 text-surface-600 text-sm hover:bg-surface-100 transition-colors disabled:opacity-50"
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button
            onClick={fetchLogs}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-surface-300 text-surface-500 hover:bg-surface-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {/* âncora oculta para download */}
        <a ref={anchorRef} className="hidden" aria-hidden />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ação, usuário, descrição..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Select
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-44"
        />
        <Select
          options={MODULE_OPTIONS}
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Table */}
      {error ? (
        <ErrorState title="Erro ao carregar auditoria" description={error} onRetry={fetchLogs} />
      ) : (
        <Table<AuditEntry>
          columns={columns}
          data={logs}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="Nenhum registro de auditoria no período selecionado."
          emptyIcon={<ShieldCheck className="w-12 h-12" />}
          totalCount={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
