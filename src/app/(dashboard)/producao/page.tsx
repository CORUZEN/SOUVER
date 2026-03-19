'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Factory,
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  ClipboardList,
  Filter,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import ModuleKpiBar from '@/components/dashboard/ModuleKpiBar'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string }
interface BatchUser { id: string; fullName: string }

interface ProductionBatch {
  id: string
  batchCode: string
  productName: string
  productType?: string
  productionLine?: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
  plannedQty?: number | null
  producedQty?: number | null
  unit: string
  status: 'OPEN' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  startedAt?: string | null
  finishedAt?: string | null
  notes?: string | null
  department?: Department | null
  createdBy: BatchUser
  createdAt: string
  _count?: { events: number }
}

interface ProductionEvent {
  id: string
  type: string
  description: string
  quantity?: number | null
  unit?: string | null
  occurredAt: string
  createdBy: BatchUser
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em Andamento',
  PAUSED: 'Pausado',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
}

const STATUS_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'default' | 'error'> = {
  OPEN: 'info',
  IN_PROGRESS: 'success',
  PAUSED: 'warning',
  FINISHED: 'default',
  CANCELLED: 'error',
}

const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
}

const EVENT_LABELS: Record<string, string> = {
  START: 'Início',
  PROGRESS: 'Progresso',
  PAUSE: 'Pausa',
  RESUME: 'Retomada',
  WASTE: 'Descarte',
  FINISH: 'Finalização',
  NOTE: 'Observação',
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  START: <PlayCircle size={14} className="text-green-600" />,
  PROGRESS: <ClipboardList size={14} className="text-blue-600" />,
  PAUSE: <PauseCircle size={14} className="text-yellow-600" />,
  RESUME: <PlayCircle size={14} className="text-green-600" />,
  WASTE: <AlertCircle size={14} className="text-red-600" />,
  FINISH: <CheckCircle2 size={14} className="text-green-700" />,
  NOTE: <ClipboardList size={14} className="text-surface-500" />,
}

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    OPEN: <Clock size={14} className="text-blue-600" />,
    IN_PROGRESS: <PlayCircle size={14} className="text-green-600" />,
    PAUSED: <PauseCircle size={14} className="text-yellow-600" />,
    FINISHED: <CheckCircle2 size={14} className="text-surface-500" />,
    CANCELLED: <XCircle size={14} className="text-red-500" />,
  }
  return <>{icons[status] ?? null}</>
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatQty(qty?: number | null, unit?: string) {
  if (qty == null) return '—'
  return `${Number(qty).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unit ?? ''}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProducaoPage() {
  // Listagem
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterShift, setFilterShift] = useState('')

  // Detalhe / Timeline
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null)
  const [events, setEvents] = useState<ProductionEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Modal Criar
  const [showCreate, setShowCreate] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    batchCode: '',
    productName: '',
    productType: '',
    productionLine: '',
    shift: 'MORNING',
    plannedQty: '',
    unit: 'kg',
    notes: '',
    departmentId: '',
  })

  // Modal Evento
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState({
    type: 'NOTE',
    description: '',
    quantity: '',
  })
  const [savingEvent, setSavingEvent] = useState(false)

  // ─── Busca ─────────────────────────────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterShift) params.set('shift', filterShift)
      const res = await fetch(`/api/production/batches?${params}`)
      if (!res.ok) throw new Error('Falha ao carregar lotes')
      const data = await res.json()
      setBatches(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterShift])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.items ?? d ?? []))
      .catch(() => {})
  }, [])

  // ─── Detalhe ───────────────────────────────────────────────────────────────

  async function openDetail(batch: ProductionBatch) {
    setSelectedBatch(batch)
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/production/batches/${batch.id}/events`)
      const data = await res.json()
      setEvents(data.items ?? [])
    } catch {
      setEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }

  // ─── Criar Lote ────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.batchCode || !form.productName) return
    setCreating(true)
    try {
      const res = await fetch('/api/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          plannedQty: form.plannedQty ? Number(form.plannedQty) : undefined,
          departmentId: form.departmentId || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Erro ao criar lote')
        return
      }
      setShowCreate(false)
      setForm({ batchCode: '', productName: '', productType: '', productionLine: '', shift: 'MORNING', plannedQty: '', unit: 'kg', notes: '', departmentId: '' })
      fetchBatches()
    } finally {
      setCreating(false)
    }
  }

  // ─── Mudar Status ──────────────────────────────────────────────────────────

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/production/batches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchBatches()
    if (selectedBatch?.id === id) {
      const res = await fetch(`/api/production/batches/${id}`)
      const updated = await res.json()
      setSelectedBatch(updated)
    }
  }

  // ─── Criar Evento ──────────────────────────────────────────────────────────

  async function handleAddEvent() {
    if (!selectedBatch || !eventForm.description) return
    setSavingEvent(true)
    try {
      const res = await fetch(`/api/production/batches/${selectedBatch.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventForm.type,
          description: eventForm.description,
          quantity: eventForm.quantity ? Number(eventForm.quantity) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Erro ao registrar evento')
        return
      }
      setShowEventModal(false)
      setEventForm({ type: 'NOTE', description: '', quantity: '' })
      // Recarregar eventos e batch
      openDetail(selectedBatch)
      fetchBatches()
    } finally {
      setSavingEvent(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Factory size={22} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900">Produção</h1>
            <p className="text-sm text-surface-500">Lotes e apontamentos de produção</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={16} /> Novo Lote
        </Button>
      </div>

      {/* Indicadores do módulo */}
      <ModuleKpiBar module="production" />

      {/* Filtros */}}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por código ou produto..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={filterShift}
              onChange={e => { setFilterShift(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Todos os turnos</option>
              {Object.entries(SHIFT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <Button variant="outline" onClick={fetchBatches} title="Atualizar">
              <RefreshCw size={15} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Listagem */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs text-surface-500 font-medium uppercase tracking-wide pl-1">
            {total} lote{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner />
            </div>
          ) : error ? (
            <ErrorState title={error} onRetry={fetchBatches} />
          ) : batches.length === 0 ? (
            <EmptyState
              title="Nenhum lote encontrado"
              description="Crie o primeiro lote de produção."
              action={<Button onClick={() => setShowCreate(true)} className="flex items-center gap-2"><Plus size={14} /> Novo Lote</Button>}
            />
          ) : (
            <div className="space-y-2">
              {batches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => openDetail(batch)}
                  className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-sm ${
                    selectedBatch?.id === batch.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-semibold text-primary">{batch.batchCode}</span>
                        <Badge variant={STATUS_VARIANTS[batch.status]} size="sm">
                          {STATUS_LABELS[batch.status]}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm text-surface-900 truncate">{batch.productName}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {SHIFT_LABELS[batch.shift]} · {batch.department?.name ?? 'Sem dept.'} · {batch._count?.events ?? 0} evento{(batch._count?.events ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusIcon status={batch.status} />
                      <ChevronRight size={14} className="text-surface-400" />
                    </div>
                  </div>
                  {(batch.plannedQty != null || batch.producedQty != null) && (
                    <div className="mt-2 pt-2 border-t border-surface-100 flex gap-4 text-xs text-surface-500">
                      <span>Plan.: {formatQty(batch.plannedQty, batch.unit)}</span>
                      <span className="text-green-700 font-medium">Prod.: {formatQty(batch.producedQty, batch.unit)}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              <span className="px-3 py-2 text-sm text-surface-600">{page} / {totalPages}</span>
              <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Próxima
              </Button>
            </div>
          )}
        </div>

        {/* Painel de Detalhe */}
        <div className="lg:col-span-3">
          {!selectedBatch ? (
            <div className="h-full flex items-center justify-center text-surface-400 border-2 border-dashed border-surface-200 rounded-xl p-12">
              <div className="text-center">
                <Factory size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um lote para ver os detalhes</p>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-primary">{selectedBatch.batchCode}</span>
                      <Badge variant={STATUS_VARIANTS[selectedBatch.status]}>
                        {STATUS_LABELS[selectedBatch.status]}
                      </Badge>
                    </div>
                    <CardTitle>{selectedBatch.productName}</CardTitle>
                    {selectedBatch.productType && (
                      <p className="text-sm text-surface-500">{selectedBatch.productType}</p>
                    )}
                  </div>
                  {/* Ações de status */}
                  <div className="flex gap-2">
                    {selectedBatch.status === 'OPEN' && (
                      <Button size="sm" onClick={() => changeStatus(selectedBatch.id, 'IN_PROGRESS')}>
                        <PlayCircle size={14} className="mr-1" /> Iniciar
                      </Button>
                    )}
                    {selectedBatch.status === 'IN_PROGRESS' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => changeStatus(selectedBatch.id, 'PAUSED')}>
                          <PauseCircle size={14} className="mr-1" /> Pausar
                        </Button>
                        <Button size="sm" onClick={() => changeStatus(selectedBatch.id, 'FINISHED')}>
                          <CheckCircle2 size={14} className="mr-1" /> Finalizar
                        </Button>
                      </>
                    )}
                    {selectedBatch.status === 'PAUSED' && (
                      <Button size="sm" onClick={() => changeStatus(selectedBatch.id, 'IN_PROGRESS')}>
                        <PlayCircle size={14} className="mr-1" /> Retomar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4 text-sm">
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Turno</span>
                    <p className="font-medium text-surface-800">{SHIFT_LABELS[selectedBatch.shift]}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Linha</span>
                    <p className="font-medium text-surface-800">{selectedBatch.productionLine ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Planejado</span>
                    <p className="font-medium text-surface-800">{formatQty(selectedBatch.plannedQty, selectedBatch.unit)}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Produzido</span>
                    <p className="font-medium text-green-700">{formatQty(selectedBatch.producedQty, selectedBatch.unit)}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Início</span>
                    <p className="font-medium text-surface-800">{formatDate(selectedBatch.startedAt)}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Fim</span>
                    <p className="font-medium text-surface-800">{formatDate(selectedBatch.finishedAt)}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Departamento</span>
                    <p className="font-medium text-surface-800">{selectedBatch.department?.name ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Criado por</span>
                    <p className="font-medium text-surface-800">{selectedBatch.createdBy.fullName}</p>
                  </div>
                </div>

                {selectedBatch.notes && (
                  <div className="mb-4 p-3 bg-surface-50 rounded-lg text-sm text-surface-700">
                    <span className="font-medium text-surface-500 text-xs uppercase tracking-wide block mb-1">Observações</span>
                    {selectedBatch.notes}
                  </div>
                )}

                {/* Timeline de eventos */}
                <div className="border-t border-surface-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-surface-700">Apontamentos</h3>
                    {['OPEN', 'IN_PROGRESS', 'PAUSED'].includes(selectedBatch.status) && (
                      <Button size="sm" variant="outline" onClick={() => setShowEventModal(true)}>
                        <Plus size={13} className="mr-1" /> Registrar
                      </Button>
                    )}
                  </div>

                  {loadingEvents ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : events.length === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-6">Nenhum apontamento registrado.</p>
                  ) : (
                    <div className="relative space-y-0">
                      {events.map((ev, idx) => (
                        <div key={ev.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-white border-2 border-surface-200 flex items-center justify-center shrink-0 mt-1">
                              {EVENT_ICONS[ev.type]}
                            </div>
                            {idx < events.length - 1 && (
                              <div className="w-0.5 h-full min-h-4 bg-surface-100 my-1" />
                            )}
                          </div>
                          <div className="pb-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-surface-700">{EVENT_LABELS[ev.type]}</span>
                              {ev.quantity != null && (
                                <span className="text-xs text-surface-500">{formatQty(ev.quantity, ev.unit ?? '')}</span>
                              )}
                              <span className="text-xs text-surface-400 ml-auto">{formatDate(ev.occurredAt)}</span>
                            </div>
                            <p className="text-sm text-surface-600 mt-0.5">{ev.description}</p>
                            <p className="text-xs text-surface-400">{ev.createdBy.fullName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Criar Lote */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Novo Lote de Produção"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !form.batchCode || !form.productName}>
              {creating ? <><Spinner />Criando...</> : 'Criar Lote'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código do Lote *"
              value={form.batchCode}
              onChange={e => setForm(f => ({ ...f, batchCode: e.target.value }))}
              placeholder="ex: LOT-2026-001"
            />
            <Select
              label="Turno *"
              value={form.shift}
              onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
              options={[
                { value: 'MORNING', label: 'Manhã' },
                { value: 'AFTERNOON', label: 'Tarde' },
                { value: 'NIGHT', label: 'Noite' },
              ]}
            />
          </div>
          <Input
            label="Produto *"
            value={form.productName}
            onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
            placeholder="ex: Café Torrado Especial"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tipo de Produto"
              value={form.productType}
              onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}
              placeholder="ex: Café Moído"
            />
            <Input
              label="Linha de Produção"
              value={form.productionLine}
              onChange={e => setForm(f => ({ ...f, productionLine: e.target.value }))}
              placeholder="ex: Linha A"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Quantidade Planejada"
                type="number"
                min={0}
                value={form.plannedQty}
                onChange={e => setForm(f => ({ ...f, plannedQty: e.target.value }))}
                placeholder="0"
              />
            </div>
            <Input
              label="Unidade"
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              placeholder="kg"
            />
          </div>
          <Select
            label="Departamento"
            value={form.departmentId}
            onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
            options={[
              { value: '', label: 'Selecione...' },
              ...departments.map(d => ({ value: d.id, label: d.name })),
            ]}
          />
          <Textarea
            label="Observações"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Informações adicionais do lote..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Modal Adicionar Evento */}
      <Modal
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
        title="Registrar Apontamento"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowEventModal(false)}>Cancelar</Button>
            <Button onClick={handleAddEvent} disabled={savingEvent || !eventForm.description}>
              {savingEvent ? <><Spinner />Salvando...</> : 'Registrar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Tipo de Apontamento"
            value={eventForm.type}
            onChange={e => setEventForm(f => ({ ...f, type: e.target.value }))}
            options={Object.entries(EVENT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Textarea
            label="Descrição *"
            value={eventForm.description}
            onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descreva o apontamento..."
            rows={3}
          />
          {['PROGRESS', 'WASTE'].includes(eventForm.type) && (
            <Input
              label="Quantidade"
              type="number"
              min={0}
              step="0.001"
              value={eventForm.quantity}
              onChange={e => setEventForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0.000"
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
