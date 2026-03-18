'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Plus, Search, Edit2, Trash2, Users, X, Check,
  ChevronRight, Factory, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

// ─── Tipos ───────────────────────────────────────────────────────

interface Manager { id: string; fullName: string }

interface DeptSummary {
  id:            string
  name:          string
  code:          string
  description:   string | null
  managerUserId: string | null
  manager:       Manager | null
  _count:        { users: number }
}

interface DeptDetail extends DeptSummary {
  users: { id: string; fullName: string; status: string; role: { name: string } | null }[]
  _count: { users: number; batches: number; nonConformances: number }
}

interface UserOption { id: string; fullName: string }

// ─── Modal ────────────────────────────────────────────────────────

interface DeptModalProps {
  initial?: DeptSummary | null
  users:    UserOption[]
  onSave:   (data: { name: string; code: string; description: string; managerUserId: string }) => Promise<void>
  onClose:  () => void
}

function DeptModal({ initial, users, onSave, onClose }: DeptModalProps) {
  const [name,       setName]       = useState(initial?.name        ?? '')
  const [code,       setCode]       = useState(initial?.code        ?? '')
  const [desc,       setDesc]       = useState(initial?.description ?? '')
  const [managerId,  setManagerId]  = useState(initial?.managerUserId ?? '')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) { setError('Nome e código são obrigatórios'); return }
    setSaving(true)
    try {
      await onSave({ name, code, description: desc, managerUserId: managerId })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="font-bold text-surface-900">
            {initial ? 'Editar Departamento' : 'Novo Departamento'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Nome *</label>
              <input required value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ex: Qualidade" />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Código *</label>
              <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ex: QUAL" />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Responsável</label>
              <select value={managerId} onChange={e => setManagerId(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— Nenhum —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Descrição</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Descrição opcional…" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-surface-200 hover:bg-surface-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2">
              <Check size={15} /> {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────

export default function DepartamentosPage() {
  const [depts,      setDepts]      = useState<DeptSummary[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<DeptDetail | null>(null)
  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<DeptSummary | null>(null)
  const [allUsers,   setAllUsers]   = useState<UserOption[]>([])
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [deleteErr,  setDeleteErr]  = useState<string | null>(null)

  const loadDepts = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/departments')
    if (r.ok) { const d = await r.json(); setDepts(d.departments ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { loadDepts() }, [loadDepts])

  async function loadUsers() {
    if (allUsers.length > 0) return
    const r = await fetch('/api/hr/collaborators?pageSize=200')
    if (r.ok) { const d = await r.json(); setAllUsers(d.collaborators ?? []) }
  }

  async function selectDept(id: string) {
    const r = await fetch(`/api/departments/${id}`)
    if (r.ok) { const d = await r.json(); setSelected(d.department) }
  }

  async function handleSave(data: { name: string; code: string; description: string; managerUserId: string }) {
    const url    = editTarget ? `/api/departments/${editTarget.id}` : '/api/departments'
    const method = editTarget ? 'PUT' : 'POST'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error ?? 'Erro desconhecido')
    await loadDepts()
    if (selected?.id === editTarget?.id) await selectDept(d.department.id)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteErr(null)
    const r = await fetch(`/api/departments/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setDepts(prev => prev.filter(d => d.id !== id))
      if (selected?.id === id) setSelected(null)
    } else {
      const d = await r.json()
      setDeleteErr(d.error ?? 'Erro ao excluir')
    }
    setDeleting(null)
  }

  const filtered = depts.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-900 leading-tight">Departamentos</h1>
            <p className="text-xs text-surface-500">{depts.length} departamento{depts.length !== 1 ? 's' : ''} cadastrado{depts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditTarget(null); loadUsers(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-xl hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} /> Novo Departamento
        </button>
      </div>

      {deleteErr && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <AlertTriangle size={15} /> {deleteErr}
          <button onClick={() => setDeleteErr(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-5">
        {/* Lista */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          {/* Busca */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-surface-400" />
            <input className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              placeholder="Buscar departamento…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-surface-400 text-center py-8">Carregando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-8">Nenhum departamento encontrado.</p>
            ) : filtered.map(dept => (
              <button key={dept.id} onClick={() => selectDept(dept.id)}
                className={`w-full text-left rounded-xl border p-4 hover:border-brand-200 transition-colors ${
                  selected?.id === dept.id ? 'border-brand-400 bg-brand-50' : 'border-surface-200 bg-white'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-brand-600">{dept.code}</span>
                      <span className="font-semibold text-sm text-surface-900 truncate">{dept.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-surface-500">
                      <span className="flex items-center gap-1"><Users size={11} /> {dept._count.users}</span>
                      {dept.manager && <span className="truncate">↳ {dept.manager.fullName}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-surface-400 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Painel detalhe */}
        {selected ? (
          <div className="flex-1 space-y-4">
            <Card>
              {/* Header detalhe */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg">{selected.code}</span>
                    <h2 className="text-xl font-bold text-surface-900">{selected.name}</h2>
                  </div>
                  {selected.description && <p className="text-sm text-surface-500">{selected.description}</p>}
                  {selected.manager && (
                    <p className="text-xs text-surface-400 mt-1">Responsável: <span className="font-medium text-surface-700">{selected.manager.fullName}</span></p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditTarget(selected); loadUsers(); setShowModal(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-surface-200 rounded-xl hover:bg-surface-50"
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={deleting === selected.id || selected._count.users > 0}
                    title={selected._count.users > 0 ? 'Remova os colaboradores primeiro' : 'Excluir'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={13} /> {deleting === selected.id ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              </div>

              {/* KPIs do dept */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Colaboradores', value: selected._count.users,           icon: <Users size={14} />,        color: 'text-violet-600 bg-violet-50' },
                  { label: 'Lotes',         value: selected._count.batches,         icon: <Factory size={14} />,      color: 'text-amber-600 bg-amber-50'  },
                  { label: 'NCs',           value: selected._count.nonConformances, icon: <ShieldCheck size={14} />,  color: 'text-emerald-600 bg-emerald-50' },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="bg-surface-50 rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
                    <div>
                      <p className="text-lg font-bold text-surface-900 leading-none">{value}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de colaboradores */}
              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Colaboradores</p>
                {selected.users.length === 0 ? (
                  <p className="text-sm text-surface-400 text-center py-4">Nenhum colaborador neste departamento.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selected.users.map(u => (
                      <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-50 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {u.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-900 leading-none">{u.fullName}</p>
                            {u.role && <p className="text-xs text-surface-400 mt-0.5">{u.role.name}</p>}
                          </div>
                        </div>
                        <Badge
                          variant={u.status === 'ACTIVE' ? 'success' : u.status === 'SUSPENDED' ? 'warning' : 'default'}
                          size="sm"
                        >
                          {u.status === 'ACTIVE' ? 'Ativo' : u.status === 'SUSPENDED' ? 'Suspenso' : 'Inativo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-400">
            <div className="text-center space-y-2">
              <Building2 size={48} className="opacity-20 mx-auto" />
              <p className="text-sm">Selecione um departamento para ver detalhes</p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <DeptModal
          initial={editTarget}
          users={allUsers}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
