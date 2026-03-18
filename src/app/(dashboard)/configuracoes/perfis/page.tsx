'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, ChevronRight, Users, Lock, CheckCircle2, Search, Info } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

// ─── Tipos ───────────────────────────────────────────────────────

interface RoleSummary {
  id:          string
  name:        string
  code:        string
  description: string | null
  _count:      { users: number; rolePermissions: number }
}

interface Permission {
  id:          string
  module:      string
  action:      string
  code:        string
  description: string | null
}

interface RoleDetail {
  id:             string
  name:           string
  code:           string
  description:    string | null
  _count:         { users: number }
  rolePermissions: { permission: Permission }[]
}

// ─── Helpers ─────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  auth:         'Autenticação',
  users:        'Usuários',
  departments:  'Departamentos',
  roles:        'Perfis',
  production:   'Produção',
  inventory:    'Logística',
  quality:      'Qualidade',
  hr:           'Recursos Humanos',
  audit:        'Auditoria',
  chat:         'Comunicação',
  reports:      'Relatórios',
  notifications:'Notificações',
  settings:     'Configurações',
}

const ACTION_LABELS: Record<string, string> = {
  read:    'Visualizar',
  create:  'Criar',
  update:  'Editar',
  delete:  'Excluir',
  approve: 'Aprovar',
  export:  'Exportar',
  admin:   'Administrar',
}

const ACTION_COLORS: Record<string, string> = {
  read:    'bg-sky-50 text-sky-700 border-sky-200',
  create:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  update:  'bg-amber-50 text-amber-700 border-amber-200',
  delete:  'bg-red-50 text-red-700 border-red-200',
  approve: 'bg-violet-50 text-violet-700 border-violet-200',
  export:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin:   'bg-rose-50 text-rose-700 border-rose-200',
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  DEVELOPER:   'bg-rose-600',
  ADMIN:       'bg-red-500',
  MANAGER:     'bg-violet-500',
  SUPERVISOR:  'bg-amber-500',
  OPERATOR:    'bg-sky-500',
  VIEWER:      'bg-surface-400',
}

// ─── Página ───────────────────────────────────────────────────────

export default function PerfisPage() {
  const [roles,      setRoles]      = useState<RoleSummary[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<RoleDetail | null>(null)
  const [search,     setSearch]     = useState('')

  const loadRoles = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/roles')
    if (r.ok) { const d = await r.json(); setRoles(d.roles ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { loadRoles() }, [loadRoles])

  async function selectRole(id: string) {
    const r = await fetch(`/api/roles/${id}`)
    if (r.ok) { const d = await r.json(); setSelected(d.role) }
  }

  // Agrupa permissões por módulo
  const grouped = selected
    ? selected.rolePermissions.reduce<Record<string, Permission[]>>((acc, rp) => {
        const mod = rp.permission.module
        if (!acc[mod]) acc[mod] = []
        acc[mod].push(rp.permission)
        return acc
      }, {})
    : {}

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()),
  )

  const isDeveloper = selected?.code === 'DEVELOPER'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-900 leading-tight">Perfis de Acesso</h1>
          <p className="text-xs text-surface-500">Visualize os perfis e suas permissões no sistema</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Lista de perfis */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-surface-400" />
            <input className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              placeholder="Buscar perfil…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-surface-400 text-center py-8">Carregando…</p>
            ) : filteredRoles.map(role => (
              <button key={role.id} onClick={() => selectRole(role.id)}
                className={`w-full text-left rounded-xl border p-4 hover:border-brand-200 transition-colors ${
                  selected?.id === role.id ? 'border-brand-400 bg-brand-50' : 'border-surface-200 bg-white'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md ${ROLE_BADGE_COLORS[role.code] ?? 'bg-surface-400'}`}>
                        {role.code}
                      </span>
                      <span className="font-semibold text-sm text-surface-900 truncate">{role.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-surface-500">
                      <span className="flex items-center gap-1"><Users size={11} /> {role._count.users}</span>
                      <span className="flex items-center gap-1"><Lock size={11} /> {role._count.rolePermissions}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-surface-400 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Painel de detalhe */}
        {selected ? (
          <div className="flex-1 space-y-4">
            <Card>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-lg ${ROLE_BADGE_COLORS[selected.code] ?? 'bg-surface-400'}`}>
                      {selected.code}
                    </span>
                    <h2 className="text-xl font-bold text-surface-900">{selected.name}</h2>
                  </div>
                  {selected.description && <p className="text-sm text-surface-500">{selected.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-violet-50 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-medium">
                    <Users size={13} /> {selected._count.users} usuário{selected._count.users !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {isDeveloper && (
                <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
                  <Info size={15} />
                  Perfil DEVELOPER — acesso total ao sistema sem restrições de permissão.
                </div>
              )}

              {/* Permissões por módulo */}
              {Object.keys(grouped).length === 0 && !isDeveloper ? (
                <div className="text-center py-8 text-surface-400">
                  <Lock size={32} className="opacity-20 mx-auto mb-2" />
                  <p className="text-sm">Nenhuma permissão atribuída a este perfil.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                        {MODULE_LABELS[mod] ?? mod}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {perms.map(p => {
                          const actionKey = p.action.toLowerCase()
                          const colorClass = ACTION_COLORS[actionKey] ?? 'bg-surface-50 text-surface-700 border-surface-200'
                          return (
                            <div key={p.id}
                              title={p.description ?? p.code}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${colorClass}`}
                            >
                              <CheckCircle2 size={11} />
                              {ACTION_LABELS[actionKey] ?? p.action}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-400">
            <div className="text-center space-y-2">
              <Shield size={48} className="opacity-20 mx-auto" />
              <p className="text-sm">Selecione um perfil para ver suas permissões</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
