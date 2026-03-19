'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShieldCheck, Plus, Search, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronRight, RefreshCw, Eye, Tag, Building2, User, Calendar, FileText,
  ClipboardList, Filter, X
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────
type NCSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type NCStatus   = 'OPEN' | 'IN_ANALYSIS' | 'IN_TREATMENT' | 'RESOLVED' | 'CLOSED'

interface NC {
  id:           string
  title:        string
  description:  string
  severity:     NCSeverity
  status:       NCStatus
  openedAt:     string
  resolvedAt:   string | null
  closedAt:     string | null
  resolution:   string | null
  batch:        { id: string; batchCode: string; productName: string } | null
  department:   { id: string; name: string } | null
  openedBy:     { id: string; fullName: string }
  assignedTo:   { id: string; fullName: string } | null
}

interface QualityRecord {
  id:             string
  inspectionType: string
  result:         'PENDING' | 'APPROVED' | 'CONDITIONAL' | 'REJECTED'
  notes:          string | null
  inspectedAt:    string
  batch:          { id: string; batchCode: string; productName: string } | null
  inspectedBy:    { id: string; fullName: string }
  _count:         { nonConformances: number }
}

// ─── Helpers visuais ─────────────────────────────────────────────
const SEV_LABEL: Record<NCSeverity, string> = {
  LOW:      'Baixa',
  MEDIUM:   'Média',
  HIGH:     'Alta',
  CRITICAL: 'Crítica',
}
const SEV_COLOR: Record<NCSeverity, string> = {
  LOW:      'bg-blue-100 text-blue-700',
  MEDIUM:   'bg-yellow-100 text-yellow-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<NCStatus, string> = {
  OPEN:         'Aberta',
  IN_ANALYSIS:  'Em Análise',
  IN_TREATMENT: 'Em Tratativa',
  RESOLVED:     'Resolvida',
  CLOSED:       'Encerrada',
}
const STATUS_COLOR: Record<NCStatus, string> = {
  OPEN:         'bg-red-100 text-red-700',
  IN_ANALYSIS:  'bg-yellow-100 text-yellow-700',
  IN_TREATMENT: 'bg-blue-100 text-blue-700',
  RESOLVED:     'bg-green-100 text-green-700',
  CLOSED:       'bg-surface-100 text-surface-600',
}
const STATUS_ICON: Record<NCStatus, React.ReactNode> = {
  OPEN:         <AlertTriangle className="w-3.5 h-3.5" />,
  IN_ANALYSIS:  <Clock className="w-3.5 h-3.5" />,
  IN_TREATMENT: <RefreshCw className="w-3.5 h-3.5" />,
  RESOLVED:     <CheckCircle2 className="w-3.5 h-3.5" />,
  CLOSED:       <XCircle className="w-3.5 h-3.5" />,
}

const RESULT_LABEL: Record<string, string> = {
  PENDING:     'Pendente',
  APPROVED:    'Aprovado',
  CONDITIONAL: 'Condicional',
  REJECTED:    'Reprovado',
}
const RESULT_COLOR: Record<string, string> = {
  PENDING:     'bg-yellow-100 text-yellow-700',
  APPROVED:    'bg-green-100 text-green-700',
  CONDITIONAL: 'bg-orange-100 text-orange-700',
  REJECTED:    'bg-red-100 text-red-700',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtFull(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Modal: Nova NC ──────────────────────────────────────────────
function ModalCreateNC({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', severity: 'MEDIUM' as NCSeverity,
    batchId: '', departmentId: '',
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/quality/nonconformances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       form.title,
          description: form.description,
          severity:    form.severity,
          batchId:     form.batchId     || undefined,
          departmentId: form.departmentId || undefined,
        }),
      })
      if (!res.ok) { setErr('Erro ao criar NC'); return }
      onSaved()
      onClose()
    } catch { setErr('Falha de conexão') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900">Nova Não Conformidade</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Título *</label>
            <input
              required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Produto fora do padrão visual"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Descrição *</label>
            <textarea
              required rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Descreva detalhadamente o problema encontrado..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Severidade *</label>
            <select
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value as NCSeverity }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Cód. Lote (opcional)</label>
              <input
                value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ID do lote"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">ID Depto. (opcional)</label>
              <input
                value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ID do departamento"
              />
            </div>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-surface-300 rounded-lg text-sm font-medium text-surface-700 hover:bg-surface-50">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {loading ? 'Salvando...' : 'Abrir NC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Registrar Inspeção ───────────────────────────────────
function ModalCreateRecord({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    inspectionType: '', result: 'PENDING' as 'PENDING' | 'APPROVED' | 'CONDITIONAL' | 'REJECTED',
    batchId: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/quality/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionType: form.inspectionType,
          result:         form.result,
          batchId:        form.batchId || undefined,
          notes:          form.notes   || undefined,
        }),
      })
      if (!res.ok) { setErr('Erro ao registrar inspeção'); return }
      onSaved()
      onClose()
    } catch { setErr('Falha de conexão') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900">Registrar Inspeção</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Tipo de Inspeção *</label>
            <input
              required value={form.inspectionType}
              onChange={e => setForm(f => ({ ...f, inspectionType: e.target.value }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Físico-Química, Sensorial, Visual..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Resultado *</label>
            <select
              value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value as typeof form.result }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="PENDING">Pendente</option>
              <option value="APPROVED">Aprovado</option>
              <option value="CONDITIONAL">Condicional</option>
              <option value="REJECTED">Reprovado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">ID do Lote (opcional)</label>
            <input
              value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ID do lote de produção"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Observações</label>
            <textarea
              rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Notas adicionais sobre a inspeção..."
            />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-surface-300 rounded-lg text-sm font-medium text-surface-700 hover:bg-surface-50">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Painel de Detalhe NC ────────────────────────────────────────
function NCDetail({ nc, onStatusChange, onClose }: {
  nc: NC
  onStatusChange: (id: string, status: NCStatus) => void
  onClose: () => void
}) {
  const [changing, setChanging] = useState(false)

  const NEXT_ACTIONS: Partial<Record<NCStatus, { to: NCStatus; label: string; color: string }[]>> = {
    OPEN:         [{ to: 'IN_ANALYSIS',  label: 'Iniciar Análise',   color: 'bg-yellow-500 hover:bg-yellow-600' }],
    IN_ANALYSIS:  [{ to: 'IN_TREATMENT', label: 'Iniciar Tratativa', color: 'bg-blue-500 hover:bg-blue-600' }],
    IN_TREATMENT: [{ to: 'RESOLVED',     label: 'Marcar Resolvida',  color: 'bg-green-600 hover:bg-green-700' }],
    RESOLVED:     [{ to: 'CLOSED',       label: 'Encerrar NC',       color: 'bg-surface-600 hover:bg-surface-700' }],
  }

  async function handleStatus(to: NCStatus) {
    setChanging(true)
    try {
      const res = await fetch(`/api/quality/nonconformances/${nc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      if (res.ok) onStatusChange(nc.id, to)
    } finally { setChanging(false) }
  }

  const actions = NEXT_ACTIONS[nc.status] ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-primary-600" />
          <span className="font-semibold text-surface-900 text-sm truncate max-w-xs">{nc.title}</span>
        </div>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-700 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Status + Severity */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[nc.status]}`}>
            {STATUS_ICON[nc.status]}{STATUS_LABEL[nc.status]}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${SEV_COLOR[nc.severity]}`}>
            {SEV_LABEL[nc.severity]}
          </span>
        </div>

        {/* Descrição */}
        <div>
          <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1">Descrição</p>
          <p className="text-sm text-surface-700">{nc.description}</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Aberta por</p>
            <div className="flex items-center gap-1.5 text-surface-700">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{nc.openedBy.fullName}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Aberta em</p>
            <div className="flex items-center gap-1.5 text-surface-700">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{fmt(nc.openedAt)}</span>
            </div>
          </div>
          {nc.assignedTo && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Responsável</p>
              <div className="flex items-center gap-1.5 text-surface-700">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{nc.assignedTo.fullName}</span>
              </div>
            </div>
          )}
          {nc.department && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Departamento</p>
              <div className="flex items-center gap-1.5 text-surface-700">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{nc.department.name}</span>
              </div>
            </div>
          )}
          {nc.batch && (
            <div className="col-span-2">
              <p className="text-xs text-surface-500 mb-0.5">Lote</p>
              <div className="flex items-center gap-1.5 text-surface-700">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                <span>{nc.batch.batchCode} — {nc.batch.productName}</span>
              </div>
            </div>
          )}
          {nc.resolvedAt && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Resolvida em</p>
              <span className="text-green-700">{fmt(nc.resolvedAt)}</span>
            </div>
          )}
          {nc.closedAt && (
            <div>
              <p className="text-xs text-surface-500 mb-0.5">Encerrada em</p>
              <span className="text-surface-500">{fmt(nc.closedAt)}</span>
            </div>
          )}
        </div>

        {/* Resolução */}
        {nc.resolution && (
          <div>
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1">Resolução</p>
            <p className="text-sm text-surface-700 bg-green-50 rounded-lg px-3 py-2">{nc.resolution}</p>
          </div>
        )}
      </div>

      {/* Ações de status */}
      {actions.length > 0 && (
        <div className="px-5 py-3 border-t border-surface-200 flex flex-wrap gap-2">
          {actions.map(a => (
            <button
              key={a.to}
              onClick={() => handleStatus(a.to)}
              disabled={changing}
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página Principal ────────────────────────────────────────────
export default function QualidadePage() {
  const [tab, setTab] = useState<'ncs' | 'inspections'>('ncs')

  // NCs state
  const [ncs, setNcs]         = useState<NC[]>([])
  const [ncTotal, setNcTotal] = useState(0)
  const [ncPage, setNcPage]   = useState(1)
  const [ncSearch, setNcSearch]     = useState('')
  const [debouncedNcSearch, setDebouncedNcSearch] = useState('')
  const [ncStatus, setNcStatus]     = useState('')
  const [ncSeverity, setNcSeverity] = useState('')
  const [selectedNC, setSelectedNC] = useState<NC | null>(null)

  // Inspections state
  const [records, setRecords]      = useState<QualityRecord[]>([])
  const [recTotal, setRecTotal]    = useState(0)
  const [recPage, setRecPage]      = useState(1)
  const [recResult, setRecResult]  = useState('')

  const [loadingNCs, setLoadingNCs]   = useState(false)
  const [loadingRec, setLoadingRec]   = useState(false)
  const [showCreateNC,  setShowCreateNC]  = useState(false)
  const [showCreateRec, setShowCreateRec] = useState(false)

  // KPI counters
  const [kpis, setKpis] = useState({ open: 0, critical: 0, records: 0 })
  const ncAbortRef = useRef<AbortController | null>(null)
  const recordsAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedNcSearch(ncSearch), 300)
    return () => clearTimeout(timeout)
  }, [ncSearch])

  const fetchNCs = useCallback(async () => {
    ncAbortRef.current?.abort()
    const controller = new AbortController()
    ncAbortRef.current = controller
    setLoadingNCs(true)
    try {
      const params = new URLSearchParams({ page: String(ncPage), pageSize: '15' })
      if (debouncedNcSearch) params.set('search', debouncedNcSearch)
      if (ncStatus)   params.set('status',   ncStatus)
      if (ncSeverity) params.set('severity', ncSeverity)
      const res = await fetch(`/api/quality/nonconformances?${params}`, { signal: controller.signal })
      if (res.ok) {
        const data = await res.json()
        setNcs(data.items)
        setNcTotal(data.total)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erro ao carregar NCs', err)
      }
    } finally {
      if (!controller.signal.aborted) setLoadingNCs(false)
    }
  }, [ncPage, debouncedNcSearch, ncStatus, ncSeverity])

  const fetchRecords = useCallback(async () => {
    recordsAbortRef.current?.abort()
    const controller = new AbortController()
    recordsAbortRef.current = controller
    setLoadingRec(true)
    try {
      const params = new URLSearchParams({ page: String(recPage), pageSize: '15' })
      if (recResult) params.set('result', recResult)
      const res = await fetch(`/api/quality/records?${params}`, { signal: controller.signal })
      if (res.ok) {
        const data = await res.json()
        setRecords(data.items)
        setRecTotal(data.total)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erro ao carregar inspeções', err)
      }
    } finally {
      if (!controller.signal.aborted) setLoadingRec(false)
    }
  }, [recPage, recResult])

  const fetchKPIs = useCallback(async () => {
    const res = await fetch('/api/quality/kpis')
    if (res.ok) {
      const data = await res.json()
      setKpis({
        open:     data.openNCs      ?? 0,
        critical: data.criticalNCs  ?? 0,
        records:  data.totalRecords ?? 0,
      })
    }
  }, [])

  useEffect(() => { fetchNCs() }, [fetchNCs])
  useEffect(() => {
    if (tab === 'inspections') fetchRecords()
  }, [tab, fetchRecords])
  useEffect(() => { fetchKPIs() }, [fetchKPIs])
  useEffect(() => () => {
    ncAbortRef.current?.abort()
    recordsAbortRef.current?.abort()
  }, [])

  function handleNCStatusChange(id: string, status: NCStatus) {
    setNcs(prev => prev.map(n => n.id === id ? { ...n, status } : n))
    if (selectedNC?.id === id) setSelectedNC(prev => prev ? { ...prev, status } : null)
  }

  const ncTotalPages  = Math.ceil(ncTotal  / 15)
  const recTotalPages = Math.ceil(recTotal / 15)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 border-b border-surface-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 leading-tight">Qualidade</h1>
              <p className="text-xs text-surface-500">Não conformidades e inspeções</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateRec(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-surface-200 text-surface-700 hover:bg-surface-50 rounded-lg"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Inspeção</span>
            </button>
            <button
              onClick={() => setShowCreateNC(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Nova NC</span>
            </button>
          </div>
        </div>

        {/* KPIs strip */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-red-600">{kpis.open}</span>
            <span className="text-surface-500">NCs abertas</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span className="font-semibold text-rose-600">{kpis.critical}</span>
            <span className="text-surface-500">críticas</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-surface-500" />
            <span className="font-semibold text-surface-700">{kpis.records}</span>
            <span className="text-surface-500">inspeções</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['ncs', 'inspections'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
            >
              {t === 'ncs' ? 'Não Conformidades' : 'Inspeções'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Tab NCs ─── */}
        {tab === 'ncs' && (
          <>
            {/* Lista NCs */}
            <div className={`flex flex-col border-r border-surface-200 ${selectedNC ? 'hidden lg:flex lg:w-2/5' : 'flex flex-1'}`}>
              {/* Filtros */}
              <div className="p-4 border-b border-surface-100 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    value={ncSearch}
                    onChange={e => { setNcSearch(e.target.value); setNcPage(1) }}
                    placeholder="Buscar por título ou descrição..."
                    className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={ncStatus}
                    onChange={e => { setNcStatus(e.target.value); setNcPage(1) }}
                    className="flex-1 border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-700 focus:outline-none"
                  >
                    <option value="">Todos os status</option>
                    <option value="OPEN">Aberta</option>
                    <option value="IN_ANALYSIS">Em Análise</option>
                    <option value="IN_TREATMENT">Em Tratativa</option>
                    <option value="RESOLVED">Resolvida</option>
                    <option value="CLOSED">Encerrada</option>
                  </select>
                  <select
                    value={ncSeverity}
                    onChange={e => { setNcSeverity(e.target.value); setNcPage(1) }}
                    className="flex-1 border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-700 focus:outline-none"
                  >
                    <option value="">Todas severidades</option>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                  <button onClick={() => fetchNCs()} className="p-1.5 text-surface-400 hover:text-surface-700 border border-surface-200 rounded-lg">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingNCs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto">
                {loadingNCs && ncs.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-surface-400 text-sm">Carregando...</div>
                ) : ncs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-surface-400">
                    <ShieldCheck className="w-8 h-8" />
                    <p className="text-sm">Nenhuma NC encontrada</p>
                  </div>
                ) : (
                  ncs.map(nc => (
                    <div
                      key={nc.id}
                      onClick={() => setSelectedNC(nc)}
                      className={`px-4 py-3 border-b border-surface-100 cursor-pointer hover:bg-surface-50 transition-colors ${selectedNC?.id === nc.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">{nc.title}</p>
                          <p className="text-xs text-surface-500 truncate mt-0.5">{nc.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nc.status]}`}>
                          {STATUS_ICON[nc.status]}{STATUS_LABEL[nc.status]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLOR[nc.severity]}`}>
                          {SEV_LABEL[nc.severity]}
                        </span>
                        <span className="text-xs text-surface-400 ml-auto">{fmt(nc.openedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginação */}
              {ncTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-surface-100 text-xs text-surface-500">
                  <span>{ncTotal} registros</span>
                  <div className="flex gap-1">
                    <button disabled={ncPage <= 1} onClick={() => setNcPage(p => p - 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">‹</button>
                    <span className="px-2 py-1">{ncPage}/{ncTotalPages}</span>
                    <button disabled={ncPage >= ncTotalPages} onClick={() => setNcPage(p => p + 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">›</button>
                  </div>
                </div>
              )}
            </div>

            {/* Detalhe NC */}
            {selectedNC && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <NCDetail
                  nc={selectedNC}
                  onStatusChange={handleNCStatusChange}
                  onClose={() => setSelectedNC(null)}
                />
              </div>
            )}

            {/* Placeholder sem seleção */}
            {!selectedNC && (
              <div className="hidden lg:flex flex-col flex-1 items-center justify-center text-surface-400 gap-2">
                <Eye className="w-10 h-10" />
                <p className="text-sm">Selecione uma NC para ver detalhes</p>
              </div>
            )}
          </>
        )}

        {/* ─── Tab Inspeções ─── */}
        {tab === 'inspections' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filtro */}
            <div className="p-4 border-b border-surface-100 flex gap-2">
              <select
                value={recResult}
                onChange={e => { setRecResult(e.target.value); setRecPage(1) }}
                className="border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Todos os resultados</option>
                <option value="PENDING">Pendente</option>
                <option value="APPROVED">Aprovado</option>
                <option value="CONDITIONAL">Condicional</option>
                <option value="REJECTED">Reprovado</option>
              </select>
              <button onClick={() => fetchRecords()} className="p-2 text-surface-400 hover:text-surface-700 border border-surface-200 rounded-lg ml-auto">
                <RefreshCw className={`w-4 h-4 ${loadingRec ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto">
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-surface-400">
                  <ClipboardList className="w-8 h-8" />
                  <p className="text-sm">Nenhuma inspeção registrada</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 border-b border-surface-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">Resultado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">Lote</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">Inspetor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wide">NCs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-surface-900">{r.inspectionType}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${RESULT_COLOR[r.result]}`}>
                            {RESULT_LABEL[r.result]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-600">
                          {r.batch ? (
                            <span className="font-mono text-xs bg-surface-100 px-2 py-0.5 rounded">{r.batch.batchCode}</span>
                          ) : <span className="text-surface-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-surface-700">{r.inspectedBy.fullName}</td>
                        <td className="px-4 py-3 text-surface-500 text-xs">{fmtFull(r.inspectedAt)}</td>
                        <td className="px-4 py-3">
                          {r._count.nonConformances > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              {r._count.nonConformances}
                            </span>
                          ) : <span className="text-surface-400 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação */}
            {recTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-surface-100 text-xs text-surface-500">
                <span>{recTotal} registros</span>
                <div className="flex gap-1">
                  <button disabled={recPage <= 1} onClick={() => setRecPage(p => p - 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">‹</button>
                  <span className="px-2 py-1">{recPage}/{recTotalPages}</span>
                  <button disabled={recPage >= recTotalPages} onClick={() => setRecPage(p => p + 1)} className="px-2 py-1 rounded border border-surface-200 disabled:opacity-40">›</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      {showCreateNC  && <ModalCreateNC  onClose={() => setShowCreateNC(false)}  onSaved={fetchNCs} />}
      {showCreateRec && <ModalCreateRecord onClose={() => setShowCreateRec(false)} onSaved={fetchRecords} />}
    </div>
  )
}
