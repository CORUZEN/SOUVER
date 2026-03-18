'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plug, Plus, RefreshCw, ChevronRight, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, Trash2, Settings2, Activity,
  ExternalLink, X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

// ─── Tipos ───────────────────────────────────────────────────────

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'

interface Integration {
  id:             string
  name:           string
  provider:       string
  description:    string | null
  status:         IntegrationStatus
  baseUrl:        string | null
  lastSyncAt:     string | null
  lastSyncStatus: string | null
  _count:         { logs: number }
  logs:           { status: string; message: string | null; executedAt: string }[]
}

interface IntegrationLog {
  id:              string
  eventType:       string
  status:          string
  message:         string | null
  durationMs:      number | null
  recordsAffected: number | null
  executedAt:      string
}

// ─── Helpers ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:   { label: 'Ativo',     color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle2 size={12} /> },
  INACTIVE: { label: 'Inativo',   color: 'bg-surface-100 text-surface-500 border-surface-200', icon: <Clock size={12} /> },
  ERROR:    { label: 'Erro',      color: 'bg-red-100 text-red-700 border-red-200',         icon: <XCircle size={12} /> },
  PENDING:  { label: 'Pendente',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: <AlertTriangle size={12} /> },
}

const PROVIDER_LABELS: Record<string, string> = {
  sankhya:    'Sankhya ERP',
  erp:        'ERP Genérico',
  api_custom: 'API Personalizada',
  webhook:    'Webhook',
  sftp:       'SFTP',
  slack:      'Slack',
  email:      'E-mail SMTP',
}

function formatRelative(date: string | null) {
  if (!date) return 'nunca'
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `há ${mins}min`
  if (hours < 24) return `há ${hours}h`
  return `há ${days}d`
}

// ─── Modal de criar/editar integração ───────────────────────────

const PROVIDERS = [
  { value: 'sankhya',    label: 'Sankhya ERP' },
  { value: 'erp',        label: 'ERP Genérico' },
  { value: 'api_custom', label: 'API Personalizada' },
  { value: 'webhook',    label: 'Webhook' },
  { value: 'sftp',       label: 'SFTP' },
  { value: 'email',      label: 'E-mail SMTP' },
]

function IntegrationModal({
  editing,
  onSave,
  onClose,
}: {
  editing:  Integration | null
  onSave:   () => void
  onClose:  () => void
}) {
  const [form,    setForm]    = useState({
    name:        editing?.name        ?? '',
    provider:    editing?.provider    ?? 'sankhya',
    description: editing?.description ?? '',
    baseUrl:     editing?.baseUrl     ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url    = editing ? `/api/integrations/${editing.id}` : '/api/integrations'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Erro ao salvar.'); setSaving(false); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="font-semibold text-surface-900">
            {editing ? 'Editar Integração' : 'Nova Integração'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Sankhya Produção"
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Provedor</label>
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">URL Base <span className="text-surface-400 font-normal">(opcional)</span></label>
            <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.exemplo.com"
              type="url"
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Descrição <span className="text-surface-400 font-normal">(opcional)</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Finalidade desta integração..."
              className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-surface-200 rounded-xl text-sm text-surface-600 hover:bg-surface-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors">
              {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────

export default function IntegracoesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Integration | null>(null)
  const [logs,         setLogs]         = useState<IntegrationLog[]>([])
  const [logsLoading,  setLogsLoading]  = useState(false)
  const [testing,      setTesting]      = useState<string | null>(null)
  const [testResult,   setTestResult]   = useState<{ status: string; message: string } | null>(null)
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Integration | null>(null)
  const [deleting,     setDeleting]     = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/integrations')
    if (r.ok) { const d = await r.json(); setIntegrations(d.integrations ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { loadList() }, [loadList])

  async function selectIntegration(item: Integration) {
    setSelected(item)
    setTestResult(null)
    setLogsLoading(true)
    const r = await fetch(`/api/integrations/${item.id}`)
    if (r.ok) {
      const d = await r.json()
      setLogs(d.logs ?? [])
      setSelected(d.integration)
    }
    setLogsLoading(false)
  }

  async function testConnection(id: string) {
    setTesting(id)
    setTestResult(null)
    const r = await fetch(`/api/integrations/${id}/test`, { method: 'POST' })
    const d = await r.json()
    setTestResult({ status: d.status, message: d.message })
    await loadList()
    // Atualiza logs
    const r2 = await fetch(`/api/integrations/${id}`)
    if (r2.ok) { const d2 = await r2.json(); setLogs(d2.logs ?? []); setSelected(d2.integration) }
    setTesting(null)
  }

  async function deleteIntegration(id: string) {
    if (!confirm('Remover esta integração e todos os seus logs?')) return
    setDeleting(id)
    await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
    setDeleting(null)
    setSelected(null)
    setLogs([])
    loadList()
  }

  async function toggleStatus(item: Integration) {
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/integrations/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadList()
    if (selected?.id === item.id) selectIntegration({ ...item, status: newStatus })
  }

  return (
    <div className="space-y-5">
      {/* Modal */}
      {showModal && (
        <IntegrationModal
          editing={editing}
          onSave={() => { setShowModal(false); setEditing(null); loadList() }}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Plug className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-900 leading-tight">Integrações</h1>
            <p className="text-xs text-surface-500">Gerencie conexões com sistemas externos</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus size={15} /> Nova Integração
        </button>
      </div>

      <div className="flex gap-5">
        {/* Lista */}
        <div className="w-72 shrink-0 space-y-2">
          <button onClick={loadList} className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-700 mb-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-100 animate-pulse" />)}
            </div>
          ) : integrations.length === 0 ? (
            <Card>
              <div className="text-center py-6 text-surface-400">
                <Plug size={28} className="opacity-20 mx-auto mb-2" />
                <p className="text-xs">Nenhuma integração cadastrada.</p>
                <button onClick={() => setShowModal(true)}
                  className="mt-2 text-xs text-indigo-600 hover:underline">
                  Criar a primeira
                </button>
              </div>
            </Card>
          ) : (
            integrations.map(item => {
              const sc = STATUS_CONFIG[item.status]
              return (
                <button key={item.id} onClick={() => selectIntegration(item)}
                  className={`w-full text-left rounded-xl border p-4 hover:border-indigo-200 transition-colors ${
                    selected?.id === item.id ? 'border-indigo-400 bg-indigo-50' : 'border-surface-200 bg-white'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm text-surface-900 truncate">{item.name}</span>
                    <ChevronRight size={13} className="text-surface-400 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-xs text-surface-500 mb-2">{PROVIDER_LABELS[item.provider] ?? item.provider}</p>
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </span>
                    <span className="text-[11px] text-surface-400">{formatRelative(item.lastSyncAt)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Painel detalhe */}
        {selected ? (
          <div className="flex-1 space-y-4">
            <Card>
              {/* Header da integração */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-surface-900">{selected.name}</h2>
                  <p className="text-sm text-surface-500 mt-0.5">
                    {PROVIDER_LABELS[selected.provider] ?? selected.provider}
                    {selected.baseUrl && (
                      <a href={selected.baseUrl} target="_blank" rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-0.5 text-indigo-600 hover:underline text-xs">
                        <ExternalLink size={11} /> {selected.baseUrl}
                      </a>
                    )}
                  </p>
                  {selected.description && (
                    <p className="text-xs text-surface-400 mt-1">{selected.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setEditing(selected); setShowModal(true) }}
                    className="p-2 rounded-lg border border-surface-200 hover:bg-surface-50 text-surface-500"
                    title="Editar">
                    <Settings2 size={15} />
                  </button>
                  <button
                    onClick={() => toggleStatus(selected)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      selected.status === 'ACTIVE'
                        ? 'border-surface-200 text-surface-600 hover:bg-surface-50'
                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    }`}>
                    {selected.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => testConnection(selected.id)}
                    disabled={testing === selected.id}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors">
                    {testing === selected.id ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                    {testing === selected.id ? 'Testando…' : 'Testar'}
                  </button>
                  <button
                    disabled={deleting === selected.id}
                    onClick={() => deleteIntegration(selected.id)}
                    className="p-2 rounded-lg border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600"
                    title="Remover">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Resultado do teste */}
              {testResult && (
                <div className={`flex items-center gap-2 mb-4 px-4 py-3 rounded-xl border text-sm ${
                  testResult.status === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {testResult.status === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {testResult.message}
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total de Logs',   value: selected._count.logs },
                  { label: 'Último Sync',      value: formatRelative(selected.lastSyncAt) },
                  { label: 'Último Status',    value: selected.lastSyncStatus ?? '—' },
                ].map(k => (
                  <div key={k.label} className="bg-surface-50 rounded-xl border border-surface-100 px-4 py-3">
                    <p className="text-lg font-bold text-surface-900">{k.value}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Logs */}
            <Card>
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Activity size={15} className="text-indigo-500" />
                Histórico de Execuções
              </h3>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-surface-100 animate-pulse" />)}
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-6">Nenhuma execução registrada.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-50 border border-surface-100">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        log.status === 'success' ? 'bg-green-500' :
                        log.status === 'error'   ? 'bg-red-500' : 'bg-amber-400'
                      }`} />
                      <span className="text-xs font-medium text-surface-600 w-16 shrink-0">{log.eventType}</span>
                      <span className="flex-1 text-xs text-surface-500 truncate">{log.message ?? '—'}</span>
                      {log.durationMs != null && (
                        <span className="text-[11px] text-surface-400 shrink-0">{log.durationMs}ms</span>
                      )}
                      <span className="text-[11px] text-surface-400 shrink-0">
                        {new Date(log.executedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-400">
            <div className="text-center space-y-2">
              <Plug size={48} className="opacity-20 mx-auto" />
              <p className="text-sm">Selecione uma integração para ver detalhes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
