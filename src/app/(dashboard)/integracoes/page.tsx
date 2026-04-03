'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'
type AuthMode = 'BASIC' | 'OAUTH2'

interface SankhyaConfig {
  companyCode?: string | null
  username?: string | null
  password?: string | null
  appKey?: string | null
  token?: string | null
  clientId?: string | null
  clientSecret?: string | null
  authMode?: AuthMode | null
}

interface Integration {
  id: string
  name: string
  provider: string
  description: string | null
  status: IntegrationStatus
  baseUrl: string | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  _count: { logs: number }
  config?: SankhyaConfig
  configSummary?: {
    authMode?: AuthMode
    hasCredentials?: boolean
    hasPassword?: boolean
    hasToken?: boolean
    hasClientSecret?: boolean
    hasAppKey?: boolean
  }
}

interface IntegrationLog {
  id: string
  eventType: string
  status: string
  message: string | null
  durationMs: number | null
  executedAt: string
}

interface IntegrationForm {
  name: string
  status: IntegrationStatus
  baseUrl: string
  description: string
  companyCode: string
  username: string
  password: string
  appKey: string
  token: string
  clientId: string
  clientSecret: string
  authMode: AuthMode
}

const EMPTY_FORM: IntegrationForm = {
  name: 'Sankhya',
  status: 'INACTIVE',
  baseUrl: '',
  description: '',
  companyCode: '',
  username: '',
  password: '',
  appKey: '',
  token: '',
  clientId: '',
  clientSecret: '',
  authMode: 'OAUTH2',
}

function statusBadge(status: IntegrationStatus) {
  if (status === 'ACTIVE') return { variant: 'success' as const, icon: <CheckCircle2 size={12} />, label: 'Ativa' }
  if (status === 'ERROR') return { variant: 'error' as const, icon: <XCircle size={12} />, label: 'Erro' }
  if (status === 'PENDING') return { variant: 'warning' as const, icon: <Clock3 size={12} />, label: 'Pendente' }
  return { variant: 'secondary' as const, icon: <Clock3 size={12} />, label: 'Inativa' }
}

function toForm(integration?: Integration | null): IntegrationForm {
  if (!integration) return { ...EMPTY_FORM }
  return {
    name: integration.name ?? 'Sankhya',
    status: integration.status ?? 'INACTIVE',
    baseUrl: integration.baseUrl ?? '',
    description: integration.description ?? '',
    companyCode: integration.config?.companyCode ?? '',
    username: integration.config?.username ?? '',
    password: integration.config?.password ?? '',
    appKey: integration.config?.appKey ?? '',
    token: integration.config?.token ?? '',
    clientId: integration.config?.clientId ?? '',
    clientSecret: integration.config?.clientSecret ?? '',
    authMode: integration.config?.authMode === 'BASIC' ? 'BASIC' : 'OAUTH2',
  }
}

function IntegrationModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  initial: Integration | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<IntegrationForm>(() => toForm(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => setForm(toForm(initial)), [initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.baseUrl.trim()) {
      setError('Preencha nome e URL da API para configurar a integracao.')
      return
    }

    const hasStoredPassword = Boolean(initial?.configSummary?.hasPassword)
    const hasStoredToken = Boolean(initial?.configSummary?.hasToken)
    const hasStoredClientSecret = Boolean(initial?.configSummary?.hasClientSecret)
    const hasStoredAppKey = Boolean(initial?.configSummary?.hasAppKey)

    const hasPassword = form.password.trim().length > 0 || (mode === 'edit' && hasStoredPassword)
    const hasToken = form.token.trim().length > 0 || (mode === 'edit' && hasStoredToken)
    const hasClientSecret = form.clientSecret.trim().length > 0 || (mode === 'edit' && hasStoredClientSecret)
    const hasAppKey = form.appKey.trim().length > 0 || (mode === 'edit' && hasStoredAppKey)

    if (form.authMode === 'OAUTH2' && (!hasToken || !form.clientId.trim() || !hasClientSecret)) {
      setError('No modo OAuth2, informe token, client_id e client_secret.')
      return
    }

    if (form.authMode === 'BASIC' && (!form.username.trim() || !hasPassword || !hasAppKey || !hasToken)) {
      setError('No modo legado, informe usuario, senha, appKey e token.')
      return
    }

    setSaving(true)
    const endpoint = mode === 'edit' && initial ? `/api/integrations/${initial.id}` : '/api/integrations'
    const method = mode === 'edit' ? 'PATCH' : 'POST'
    const configPayload: Record<string, string | null> = {
      companyCode: form.companyCode.trim() || null,
      username: form.username.trim() || null,
      clientId: form.clientId.trim() || null,
      authMode: form.authMode,
    }

    if (mode === 'create') {
      configPayload.password = form.password || null
      configPayload.appKey = form.appKey.trim() || null
      configPayload.token = form.token.trim() || null
      configPayload.clientSecret = form.clientSecret.trim() || null
    } else {
      if (form.password.trim().length > 0) configPayload.password = form.password
      if (form.appKey.trim().length > 0) configPayload.appKey = form.appKey.trim()
      if (form.token.trim().length > 0) configPayload.token = form.token.trim()
      if (form.clientSecret.trim().length > 0) configPayload.clientSecret = form.clientSecret.trim()
    }

    const payload = {
      name: form.name.trim(),
      provider: 'sankhya',
      status: form.status,
      baseUrl: form.baseUrl.trim(),
      description: form.description.trim() || null,
      config: configPayload,
    }

    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data?.error ?? 'Erro ao salvar integracao.')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-surface-950/70 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-5xl rounded-2xl border border-surface-700 bg-linear-to-br from-surface-950 via-[#111d3a] to-[#102949] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{mode === 'edit' ? 'Editar Integracao Sankhya' : 'Nova Integracao Sankhya'}</h2>
            <p className="text-sm text-white/70">Conexao empresarial para dados, relatorios e consolidacao inteligente.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">Fechar</button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome da integracao" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <input value={form.baseUrl} onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))} placeholder="URL da API Sankhya" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <input value={form.companyCode} onChange={(e) => setForm((p) => ({ ...p, companyCode: e.target.value }))} placeholder="Codigo da empresa (opcional)" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Usuario da API" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <div className="flex items-center rounded-xl border border-white/15 bg-white/5 px-2">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha da API" className="w-full bg-transparent px-2 py-2.5 text-sm" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-1.5 text-white/70">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-violet-300/25 bg-violet-500/10 p-3">
            <div className="inline-flex rounded-lg border border-white/15 p-1 text-xs">
              <button type="button" onClick={() => setForm((p) => ({ ...p, authMode: 'BASIC' }))} className={`rounded-md px-3 py-1 ${form.authMode === 'BASIC' ? 'bg-white/20' : 'text-white/70'}`}>Basic</button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, authMode: 'OAUTH2' }))} className={`rounded-md px-3 py-1 ${form.authMode === 'OAUTH2' ? 'bg-white/20' : 'text-white/70'}`}>OAuth2</button>
            </div>
            <input value={form.token} onChange={(e) => setForm((p) => ({ ...p, token: e.target.value }))} placeholder={form.authMode === 'OAUTH2' ? 'X-Token (obrigatorio)' : 'Token legado (obrigatorio)'} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <input value={form.appKey} onChange={(e) => setForm((p) => ({ ...p, appKey: e.target.value }))} placeholder={form.authMode === 'BASIC' ? 'appKey legado (obrigatorio)' : 'appKey legado (opcional)'} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <input value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} placeholder={form.authMode === 'OAUTH2' ? 'client_id (obrigatorio)' : 'client_id (opcional)'} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <div className="flex items-center rounded-xl border border-white/15 bg-white/5 px-2">
              <input type={showSecret ? 'text' : 'password'} value={form.clientSecret} onChange={(e) => setForm((p) => ({ ...p, clientSecret: e.target.value }))} placeholder={form.authMode === 'OAUTH2' ? 'client_secret (obrigatorio)' : 'client_secret (opcional)'} className="w-full bg-transparent px-2 py-2.5 text-sm" />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="p-1.5 text-white/70">{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descricao tecnica (opcional)" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm" />
            <p className="text-xs text-white/65">
              Recomendado pela Sankhya: usar OAuth2 (client_credentials). O modo Basic e legado.
            </p>
            {mode === 'edit' && (
              <p className="text-xs text-white/65">
                Campos sensiveis em branco mantem as credenciais atuais salvas.
              </p>
            )}
            <label className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm">
              Ativar integrador
              <button type="button" onClick={() => setForm((p) => ({ ...p, status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }))} className={`relative h-6 w-11 rounded-full ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-surface-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${form.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {saving ? 'Salvando...' : mode === 'edit' ? 'Salvar Integracao' : 'Criar Integracao'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function IntegracoesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [logs, setLogs] = useState<IntegrationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [modalInitial, setModalInitial] = useState<Integration | null>(null)

  const selected = useMemo(() => integrations.find((item) => item.id === selectedId) ?? null, [integrations, selectedId])

  const loadList = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/integrations')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoading(false)
      setIntegrations([])
      setFlash({ type: 'error', text: data?.error ?? 'Nao foi possivel carregar as integracoes.' })
      return
    }
    const list: Integration[] = data.integrations ?? []
    setIntegrations(list)
    setSelectedId((prev) => (prev && list.some((i) => i.id === prev) ? prev : list[0]?.id ?? null))
    setLoading(false)
  }, [])

  const loadDetails = useCallback(async (id: string, modal = false) => {
    const res = await fetch(`/api/integrations/${id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setFlash({ type: 'error', text: data?.error ?? 'Falha ao carregar detalhes da integracao.' })
      return null
    }
    if (modal) return data.integration as Integration
    setLogs(data.logs ?? [])
    return data.integration as Integration
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    if (!selectedId) return setLogs([])
    setLogsLoading(true)
    loadDetails(selectedId).finally(() => setLogsLoading(false))
  }, [selectedId, loadDetails])

  async function onToggle(item: Integration) {
    setTogglingId(item.id)
    const next = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const res = await fetch(`/api/integrations/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
    const data = await res.json().catch(() => ({}))
    setTogglingId(null)
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Nao foi possivel alterar status.' })
    setFlash({ type: 'success', text: next === 'ACTIVE' ? 'Integrador ativado.' : 'Integrador desativado.' })
    await loadList()
    if (selectedId === item.id) await loadDetails(item.id)
  }

  async function onTest(item: Integration) {
    setTestingId(item.id)
    const res = await fetch(`/api/integrations/${item.id}/test`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setTestingId(null)
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Falha ao testar conexao.' })
    setFlash({ type: data.status === 'success' ? 'success' : 'error', text: data.message ?? 'Teste finalizado.' })
    await loadList()
    if (selectedId === item.id) await loadDetails(item.id)
  }

  async function onDelete(item: Integration) {
    if (!confirm(`Remover a integracao ${item.name}?`)) return
    setDeletingId(item.id)
    const res = await fetch(`/api/integrations/${item.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Erro ao remover integracao.' })
    setFlash({ type: 'success', text: 'Integracao removida.' })
    await loadList()
  }

  async function openCreate() {
    setModalMode('create')
    setModalInitial(null)
    setModalOpen(true)
  }

  async function openEdit(item: Integration) {
    const detail = await loadDetails(item.id, true)
    if (!detail) return
    setModalMode('edit')
    setModalInitial(detail)
    setModalOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {modalOpen && <IntegrationModal mode={modalMode} initial={modalInitial} onClose={() => setModalOpen(false)} onSaved={async () => { setModalOpen(false); await loadList() }} />}

      <Card className="relative overflow-hidden border-surface-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 to-emerald-500" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500">Conectividade Corporativa</p>
            <h1 className="mt-1 text-2xl font-semibold text-surface-900">Integracoes ERP Sankhya</h1>
            <p className="mt-1 text-sm text-surface-600">Ative o integrador para conectar seu ERP e liberar relatorios, estatisticas e consolidacao inteligente.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><Plus size={15} /> Nova Integracao</button>
        </div>
      </Card>

      <Card className="border-blue-100 bg-blue-50/60">
        <p className="text-sm text-blue-900">
          Esta area foi preparada para operacao profissional com Sankhya: cadastro de credenciais, ativacao do integrador, teste de conexao e historico tecnico.
        </p>
      </Card>

      {flash && <div className={`rounded-xl border px-4 py-3 text-sm ${flash.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{flash.text}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-900">Integracoes ERP ({integrations.length})</h2>
        <button onClick={loadList} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
      </div>

      {loading ? (
        <Card className="h-28 animate-pulse bg-surface-100" />
      ) : integrations.length === 0 ? (
        <Card className="py-8 text-center text-sm text-surface-500">Nenhuma integracao cadastrada.</Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((item) => {
            const info = statusBadge(item.status)
            return (
              <Card key={item.id} className={selectedId === item.id ? 'border-primary-300 bg-primary-50/35' : ''}>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <button onClick={() => setSelectedId(item.id)} className="text-left">
                      <p className="text-xl font-semibold text-surface-900">{item.name}</p>
                      <p className="text-sm text-surface-500">{item.baseUrl ?? 'Sem URL configurada'}</p>
                    </button>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                      Ativar integrador
                      <button onClick={() => onToggle(item)} disabled={togglingId === item.id} className={`relative h-6 w-11 rounded-full ${item.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-surface-300'} ${togglingId === item.id ? 'opacity-60' : ''}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={info.variant} className="gap-1.5">{info.icon} {info.label}</Badge>
                    <Badge variant={item.lastSyncStatus === 'success' ? 'success' : 'warning'}>{item.lastSyncStatus === 'success' ? 'Conexao OK' : 'Conexao pendente'}</Badge>
                    <span className="text-xs text-surface-500">Ultimo teste: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => onTest(item)} disabled={testingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-60">{testingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Testar conexao</button>
                      <button onClick={() => openEdit(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50"><Pencil size={14} /> Editar</button>
                    </div>
                    <button onClick={() => onDelete(item)} disabled={deletingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"><Trash2 size={14} /> Remover</button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {selected && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-surface-900"><Activity size={15} className="text-primary-600" /> Historico tecnico - {selected.name}</h3>
          {logsLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-100" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-surface-500">Nenhum log de execucao.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-100 px-3 py-2">
                  <span className={`h-2 w-2 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : log.status === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="w-14 text-xs font-semibold text-surface-600">{log.eventType}</span>
                  <span className="min-w-56 flex-1 text-xs text-surface-500">{log.message ?? '-'}</span>
                  {log.durationMs != null && <span className="text-[11px] text-surface-400">{log.durationMs}ms</span>}
                  <span className="text-[11px] text-surface-400">{new Date(log.executedAt).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="border-surface-200 bg-surface-50/60">
        <p className="flex items-start gap-2 text-xs text-surface-600"><ShieldCheck size={14} className="mt-0.5 text-emerald-600" /> Recomendacao: use credenciais dedicadas de servico e monitore regularmente os logs de conexao para manter padrao empresarial.</p>
      </Card>
    </div>
  )
}
