'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
  X,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'

interface SankhyaConfig {
  companyCode?: string | null
  username?: string | null
  password?: string | null
  token?: string | null
  clientId?: string | null
  clientSecret?: string | null
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
    hasCredentials?: boolean
    hasPassword?: boolean
    hasToken?: boolean
    hasClientSecret?: boolean
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
  companyCode: string
  username: string
  password: string
  token: string
  clientId: string
  clientSecret: string
}

const EMPTY_FORM: IntegrationForm = {
  name: 'Sankhya',
  status: 'INACTIVE',
  baseUrl: '',
  companyCode: '',
  username: '',
  password: '',
  token: '',
  clientId: '',
  clientSecret: '',
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
    companyCode: integration.config?.companyCode ?? '',
    username: integration.config?.username ?? '',
    password: '',
    token: integration.config?.token ?? '',
    clientId: integration.config?.clientId ?? '',
    clientSecret: integration.config?.clientSecret ?? '',
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
  const [showSecret, setShowSecret] = useState(false)
  const [showLegacyPassword, setShowLegacyPassword] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setForm(toForm(initial)), [initial])
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarCompensation = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarCompensation > 0) {
      document.body.style.paddingRight = `${scrollbarCompensation}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.baseUrl.trim()) {
      setError('Preencha nome e URL da API para configurar a integração.')
      return
    }

    const hasStoredToken = Boolean(initial?.configSummary?.hasToken)
    const hasStoredClientSecret = Boolean(initial?.configSummary?.hasClientSecret)
    const hasToken = form.token.trim().length > 0 || (mode === 'edit' && hasStoredToken)
    const hasClientSecret = form.clientSecret.trim().length > 0 || (mode === 'edit' && hasStoredClientSecret)

    if (!hasToken || !form.clientId.trim() || !hasClientSecret) {
      setError('Informe token, client_id e client_secret para a integração OAuth2.')
      return
    }

    setSaving(true)
    const endpoint = mode === 'edit' && initial ? `/api/integrations/${initial.id}` : '/api/integrations'
    const method = mode === 'edit' ? 'PATCH' : 'POST'
    const configPayload: Record<string, string | null> = {
      companyCode: form.companyCode.trim() || null,
      username: form.username.trim() || null,
      clientId: form.clientId.trim() || null,
      authMode: 'OAUTH2',
    }

    if (mode === 'create') {
      configPayload.password = form.password.trim() || null
      configPayload.token = form.token.trim() || null
      configPayload.clientSecret = form.clientSecret.trim() || null
    } else {
      if (form.password.trim().length > 0) configPayload.password = form.password.trim()
      if (form.token.trim().length > 0) configPayload.token = form.token.trim()
      if (form.clientSecret.trim().length > 0) configPayload.clientSecret = form.clientSecret.trim()
    }

    const payload = {
      name: form.name.trim(),
      provider: 'sankhya',
      status: form.status,
      baseUrl: form.baseUrl.trim(),
      config: configPayload,
    }

    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data?.error ?? 'Erro ao salvar integração.')
    onSaved()
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-surface-950/75 backdrop-blur-[3px]">
      <div className="h-full min-h-[100dvh] w-full overflow-y-auto p-3 sm:p-6">
        <div className="flex min-h-full items-start justify-center py-1 sm:items-center sm:py-0">
          <form
            onSubmit={handleSubmit}
            className="mx-auto my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1020px] flex-col overflow-hidden rounded-2xl border border-[#2a3b66] bg-linear-to-br from-[#0a1228] via-[#0e1a38] to-[#0b1733] text-white shadow-[0_28px_100px_rgba(2,8,24,0.7)] transition-all duration-300 sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl"
          >
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/40 bg-blue-400/12 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)] sm:h-12 sm:w-12 sm:rounded-2xl">
                <Plug className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold leading-tight sm:text-2xl lg:text-3xl">{mode === 'edit' ? 'Editar Integração' : 'Nova Integração Sankhya'}</h2>
                <p className="mt-0.5 text-xs text-white/65 sm:text-sm">Configure a conexão com seu sistema ERP.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:space-y-6 lg:px-8 lg:py-7">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
              <section className="space-y-3.5">
                <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="h-5 w-1 rounded-full bg-blue-500" />
                  <h3 className="text-xl font-semibold sm:text-2xl">Configuração da Conexão</h3>
                </div>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                  Nome da Integração
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Sankhya" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                  URL da API *
                  <input value={form.baseUrl} onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))} placeholder="https://servidor.empresa.com.br:10089" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                  <p className="mt-1 text-[11px] text-white/45">URL do servidor Sankhya sem / no final.</p>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                  Código da Empresa (opcional)
                  <input value={form.companyCode} onChange={(e) => setForm((p) => ({ ...p, companyCode: e.target.value }))} placeholder="Ex: 1" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                  Usuário (opcional)
                  <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="usuario.api" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                  <p className="mt-1 text-[11px] text-white/45">Usado como credencial secundária para login legado sem OAuth2.</p>
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                  Senha {mode === 'edit' ? '(vazio = manter)' : '(opcional)'}
                  <div className="mt-1.5 flex items-center rounded-2xl border border-white/12 bg-white/6 px-2.5">
                    <input type={showLegacyPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Senha da API" className="w-full bg-transparent px-1 py-2.5 text-sm placeholder:text-white/35 focus:outline-none" />
                    <button type="button" onClick={() => setShowLegacyPassword((v) => !v)} className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/8 hover:text-white">{showLegacyPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
              </section>

              <section className="space-y-3.5">
                <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="h-5 w-1 rounded-full bg-violet-500" />
                  <h3 className="text-xl font-semibold sm:text-2xl">Credenciais de Acesso</h3>
                </div>

                <div className="space-y-3 rounded-2xl border border-violet-300/25 bg-violet-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex rounded-lg border border-blue-300/35 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-100">
                      OAuth2
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${form.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                      {form.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                    Token de Integração (obrigatório)
                    <input value={form.token} onChange={(e) => setForm((p) => ({ ...p, token: e.target.value }))} placeholder="X-Token (obrigatorio)" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
                  </label>

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                    Client ID (obrigatório)
                    <input value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} placeholder="client_id (obrigatorio)" className="mt-1.5 w-full rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
                  </label>

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/60">
                    Client Secret {mode === 'edit' ? '(vazio = manter)' : ''}
                    <div className="mt-1.5 flex items-center rounded-2xl border border-white/12 bg-white/6 px-2.5">
                      <input type={showSecret ? 'text' : 'password'} value={form.clientSecret} onChange={(e) => setForm((p) => ({ ...p, clientSecret: e.target.value }))} placeholder="client_secret (obrigatório)" className="w-full bg-transparent px-1 py-2.5 text-sm placeholder:text-white/35 focus:outline-none" />
                      <button type="button" onClick={() => setShowSecret((v) => !v)} className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/8 hover:text-white">{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </label>

                  <p className="text-xs leading-relaxed text-white/65">
                    Com credenciais completas, o sistema utiliza OAuth2 automaticamente, garantindo maior segurança e estabilidade.
                  </p>
                  {mode === 'edit' && (
                    <p className="text-xs text-white/62">Campos sensíveis vazios preservam os valores salvos atualmente.</p>
                  )}

                  <label className="flex items-center justify-between rounded-xl border border-white/12 bg-white/6 px-3 py-2.5">
                    <span className="text-sm font-medium text-white">Ativar Integrador</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.status === 'ACTIVE'}
                      onClick={() => setForm((p) => ({ ...p, status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }))}
                      className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${form.status === 'ACTIVE' ? 'justify-end bg-emerald-500' : 'justify-start bg-surface-600'}`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                    </button>
                  </label>
                </div>
              </section>
            </div>

            {error && (
              <p className="rounded-xl border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6 lg:px-8">
            <button type="button" onClick={onClose} className="w-full rounded-2xl border border-white/15 bg-white/4 px-6 py-2.5 text-base font-medium text-white/90 transition-colors hover:bg-white/10 sm:w-auto">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-500 px-6 py-2.5 text-base font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {saving ? 'Salvando...' : mode === 'edit' ? 'Atualizar Integração' : 'Criar Integração'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
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
      setFlash({ type: 'error', text: data?.error ?? 'Não foi possível carregar as integrações.' })
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
      setFlash({ type: 'error', text: data?.error ?? 'Falha ao carregar detalhes da integração.' })
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
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Não foi possível alterar o status.' })
    setFlash({ type: 'success', text: next === 'ACTIVE' ? 'Integrador ativado.' : 'Integrador desativado.' })
    await loadList()
    if (selectedId === item.id) await loadDetails(item.id)
  }

  async function onTest(item: Integration) {
    setTestingId(item.id)
    const res = await fetch(`/api/integrations/${item.id}/test`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setTestingId(null)
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Falha ao testar conexão.' })
    setFlash({ type: data.status === 'success' ? 'success' : 'error', text: data.message ?? 'Teste finalizado.' })
    await loadList()
    if (selectedId === item.id) await loadDetails(item.id)
  }

  async function onDelete(item: Integration) {
    if (!confirm(`Remover a integração ${item.name}?`)) return
    setDeletingId(item.id)
    const res = await fetch(`/api/integrations/${item.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)
    if (!res.ok) return setFlash({ type: 'error', text: data?.error ?? 'Erro ao remover integração.' })
    setFlash({ type: 'success', text: 'Integração removida.' })
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
            <h1 className="mt-1 text-2xl font-semibold text-surface-900">Integrações ERP Sankhya</h1>
            <p className="mt-1 text-sm text-surface-600">Ative o integrador para conectar seu ERP e liberar relatórios, estatísticas e consolidação inteligente.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><Plus size={15} /> Nova Integração</button>
        </div>
      </Card>

      <Card className="border-blue-100 bg-blue-50/60">
        <p className="text-sm text-blue-900">
          Esta área foi preparada para operação profissional com Sankhya: cadastro de credenciais, ativação do integrador, teste de conexão e histórico técnico.
        </p>
      </Card>

      {flash && <div className={`rounded-xl border px-4 py-3 text-sm ${flash.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{flash.text}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-900">Integrações ERP ({integrations.length})</h2>
        <button onClick={loadList} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
      </div>

      {loading ? (
        <Card className="h-28 animate-pulse bg-surface-100" />
      ) : integrations.length === 0 ? (
        <Card className="py-8 text-center text-sm text-surface-500">Nenhuma integração cadastrada.</Card>
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
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.status === 'ACTIVE'}
                        onClick={() => onToggle(item)}
                        disabled={togglingId === item.id}
                        className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${item.status === 'ACTIVE' ? 'justify-end bg-emerald-500' : 'justify-start bg-surface-300'} ${togglingId === item.id ? 'opacity-60' : ''}`}
                      >
                        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                      </button>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={info.variant} className="gap-1.5">{info.icon} {info.label}</Badge>
                    <Badge variant={item.lastSyncStatus === 'success' ? 'success' : 'warning'}>{item.lastSyncStatus === 'success' ? 'Conexão OK' : 'Conexão pendente'}</Badge>
                    <span className="text-xs text-surface-500">Último teste: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => onTest(item)} disabled={testingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-60">{testingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Testar conexão</button>
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
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-surface-900"><Activity size={15} className="text-primary-600" /> Histórico técnico - {selected.name}</h3>
          {logsLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-100" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-surface-500">Nenhum log de execução.</p>
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
        <p className="flex items-start gap-2 text-xs text-surface-600"><ShieldCheck size={14} className="mt-0.5 text-emerald-600" /> Recomendação: use credenciais dedicadas de serviço e monitore regularmente os logs de conexão para manter padrão empresarial.</p>
      </Card>
    </div>
  )
}

