'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, RefreshCw, ChevronRight, Eye, X, Calendar,
  Shield, ShieldOff, Activity, Building2, UserCircle2, CheckCircle2,
  Clock, Ban, BarChart3, LogIn, Hash
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────
type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

interface Collaborator {
  id:              string
  fullName:        string
  email:           string
  login:           string
  phone:           string | null
  status:          UserStatus
  isActive:        boolean
  lastLoginAt:     string | null
  createdAt:       string
  twoFactorEnabled: boolean
  department:  { id: string; name: string; code: string } | null
  role:        { id: string; name: string; code: string } | null
  _count:      { sessions: number; auditLogs: number; createdBatches: number }
}

interface HRKpis {
  total:         number
  totalActive:   number
  totalInactive: number
  totalSuspended: number
  with2FA:       number
  loggedToday:   number
  loginActivity: { date: string; count: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────
const STATUS_LABEL: Record<UserStatus, string>  = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso' }
const STATUS_COLOR: Record<UserStatus, string>  = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-surface-100 text-surface-600',
  SUSPENDED: 'bg-red-100 text-red-700',
}
const STATUS_ICON: Record<UserStatus, React.ReactNode> = {
  ACTIVE:    <CheckCircle2 className="w-3.5 h-3.5" />,
  INACTIVE:  <Clock className="w-3.5 h-3.5" />,
  SUSPENDED: <Ban className="w-3.5 h-3.5" />,
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtFull(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ─── Painel de detalhe ───────────────────────────────────────────
function CollaboratorDetail({
  collaborator, onClose,
}: { collaborator: Collaborator; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <UserCircle2 className="w-4.5 h-4.5 text-primary-600" />
          <span className="font-semibold text-surface-900 text-sm">{collaborator.fullName}</span>
        </div>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Avatar + Status */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-700 font-bold text-lg">{initials(collaborator.fullName)}</span>
          </div>
          <div>
            <p className="font-semibold text-surface-900">{collaborator.fullName}</p>
            <p className="text-sm text-surface-500">{collaborator.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[collaborator.status]}`}>
                {STATUS_ICON[collaborator.status]}{STATUS_LABEL[collaborator.status]}
              </span>
              {collaborator.twoFactorEnabled
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Shield className="w-3 h-3" />2FA ativo</span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-500"><ShieldOff className="w-3 h-3" />Sem 2FA</span>
              }
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Login</p>
            <p className="font-mono text-surface-700 font-medium">{collaborator.login}</p>
          </div>
          {collaborator.phone && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Telefone</p>
              <p className="text-surface-700">{collaborator.phone}</p>
            </div>
          )}
          {collaborator.role && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Perfil</p>
              <div className="flex items-center gap-1.5 text-surface-700">
                <Shield className="w-3.5 h-3.5 shrink-0 text-primary-500" />
                <span>{collaborator.role.name}</span>
              </div>
            </div>
          )}
          {collaborator.department && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Departamento</p>
              <div className="flex items-center gap-1.5 text-surface-700">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{collaborator.department.name}</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Cadastrado em</p>
            <div className="flex items-center gap-1.5 text-surface-700">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{fmt(collaborator.createdAt)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Último acesso</p>
            <div className="flex items-center gap-1.5 text-surface-700">
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{collaborator.lastLoginAt ? fmtFull(collaborator.lastLoginAt) : 'Nunca'}</span>
            </div>
          </div>
        </div>

        {/* Métricas de atividade */}
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Atividade no Sistema</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sessões',     value: collaborator._count.sessions,      icon: <Activity className="w-4 h-4" /> },
              { label: 'Ações',       value: collaborator._count.auditLogs,     icon: <Hash className="w-4 h-4" /> },
              { label: 'Lotes Prod.', value: collaborator._count.createdBatches, icon: <BarChart3 className="w-4 h-4" /> },
            ].map(m => (
              <div key={m.label} className="bg-surface-50 rounded-lg px-3 py-2 text-center">
                <div className="flex justify-center text-surface-400 mb-1">{m.icon}</div>
                <p className="text-lg font-bold text-surface-900">{m.value}</p>
                <p className="text-[10px] text-surface-500">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ────────────────────────────────────────────
export default function RHPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [total, setTotal]                 = useState(0)
  const [page, setPage]                   = useState(1)
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [selected, setSelected]           = useState<Collaborator | null>(null)
  const [loading, setLoading]             = useState(false)
  const [kpis, setKpis]                   = useState<HRKpis | null>(null)

  const PAGE_SIZE = 20

  const fetchCollaborators = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search)       params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/hr/collaborators?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCollaborators(data.items)
        setTotal(data.total)
      }
    } finally { setLoading(false) }
  }, [page, search, filterStatus])

  const fetchKpis = useCallback(async () => {
    const res = await fetch('/api/hr/kpis')
    if (res.ok) setKpis(await res.json())
  }, [])

  useEffect(() => { fetchCollaborators() }, [fetchCollaborators])
  useEffect(() => { fetchKpis() }, [fetchKpis])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const maxBar     = kpis?.loginActivity ? Math.max(...kpis.loginActivity.map(d => d.count), 1) : 1

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-surface-200 bg-white">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 leading-tight">Recursos Humanos</h1>
              <p className="text-xs text-surface-500">Colaboradores e atividade no sistema</p>
            </div>
          </div>
          <button onClick={() => { fetchCollaborators(); fetchKpis() }} className="p-2 text-surface-400 hover:text-surface-700 border border-surface-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {[
              { label: 'Total',       value: kpis.total,          color: 'text-surface-900' },
              { label: 'Ativos',      value: kpis.totalActive,    color: 'text-green-700'   },
              { label: 'Inativos',    value: kpis.totalInactive,  color: 'text-surface-500' },
              { label: 'Suspensos',   value: kpis.totalSuspended, color: 'text-red-700'     },
              { label: 'Com 2FA',     value: kpis.with2FA,        color: 'text-blue-700'    },
              { label: 'Hoje',        value: kpis.loggedToday,    color: 'text-primary-700' },
            ].map(k => (
              <div key={k.label} className="bg-surface-50 rounded-lg px-3 py-2.5 text-center border border-surface-100">
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mini gráfico de acessos */}
        {kpis?.loginActivity && kpis.loginActivity.length > 0 && (
          <div className="mb-1">
            <p className="text-xs font-medium text-surface-500 mb-2">Acessos — últimos 7 dias</p>
            <div className="flex items-end gap-1 h-10">
              {kpis.loginActivity.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-violet-400"
                    style={{ height: `${Math.max(4, (d.count / maxBar) * 32)}px` }}
                    title={`${d.date}: ${d.count} acessos`}
                  />
                  <span className="text-[9px] text-surface-400 truncate w-full text-center">{d.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Lista colaboradores */}
        <div className={`flex flex-col border-r border-surface-200 ${selected ? 'hidden lg:flex lg:w-2/5' : 'flex flex-1'}`}>
          {/* Filtros */}
          <div className="p-4 border-b border-surface-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por nome, e-mail ou login..."
                className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              className="w-full border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-700 focus:outline-none"
            >
              <option value="">Todos os status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="SUSPENDED">Suspenso</option>
            </select>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading && collaborators.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-surface-400 text-sm">Carregando...</div>
            ) : collaborators.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-surface-400">
                <Users className="w-8 h-8" />
                <p className="text-sm">Nenhum colaborador encontrado</p>
              </div>
            ) : (
              collaborators.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-surface-100 cursor-pointer hover:bg-surface-50 transition-colors ${selected?.id === c.id ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-violet-700 font-semibold text-xs">{initials(c.fullName)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 truncate">{c.fullName}</p>
                    <p className="text-xs text-surface-500 truncate">{c.role?.name ?? 'Sem perfil'} · {c.department?.name ?? 'Sem departamento'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                      {STATUS_ICON[c.status]}{STATUS_LABEL[c.status]}
                    </span>
                    {c.twoFactorEnabled && <Shield className="w-3 h-3 text-blue-500" />}
                  </div>
                  <ChevronRight className="w-4 h-4 text-surface-400 shrink-0" />
                </div>
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-surface-100 text-xs text-surface-500">
              <span>{total} colaboradores</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">‹</button>
                <span className="px-2 py-1">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">›</button>
              </div>
            </div>
          )}
        </div>

        {/* Detalhe */}
        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <CollaboratorDetail collaborator={selected} onClose={() => setSelected(null)} />
          </div>
        )}

        {/* Placeholder */}
        {!selected && (
          <div className="hidden lg:flex flex-col flex-1 items-center justify-center text-surface-400 gap-2">
            <Eye className="w-10 h-10" />
            <p className="text-sm">Selecione um colaborador para ver detalhes</p>
          </div>
        )}
      </div>
    </div>
  )
}
