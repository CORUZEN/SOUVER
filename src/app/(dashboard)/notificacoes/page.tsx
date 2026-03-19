'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, CheckCheck, RefreshCw, Filter, Inbox,
  Factory, Truck, ShieldCheck, Users, Lock, Settings,
  Check, Trash2,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────
interface Notification {
  id:        string
  type:      string
  title:     string
  message:   string
  module:    string | null
  link:      string | null
  isRead:    boolean
  createdAt: string
  readAt:    string | null
}

// ─── Helpers ─────────────────────────────────────────────────────
const MODULE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  production: { label: 'Produção',    icon: <Factory   className="w-3.5 h-3.5" />, color: 'bg-amber-100 text-amber-700'   },
  inventory:  { label: 'Logística',   icon: <Truck     className="w-3.5 h-3.5" />, color: 'bg-cyan-100 text-cyan-700'     },
  quality:    { label: 'Qualidade',   icon: <ShieldCheck className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700' },
  hr:         { label: 'RH',          icon: <Users     className="w-3.5 h-3.5" />, color: 'bg-violet-100 text-violet-700' },
  auth:       { label: 'Acesso',      icon: <Lock      className="w-3.5 h-3.5" />, color: 'bg-red-100 text-red-700'       },
  system:     { label: 'Sistema',     icon: <Settings  className="w-3.5 h-3.5" />, color: 'bg-surface-100 text-surface-600' },
}

const TYPE_ICON: Record<string, string> = {
  NC_OPENED:        '🧪',
  NC_CRITICAL:      '🔴',
  LOW_STOCK:        '📦',
  BATCH_FINISHED:   '✅',
  BATCH_CANCELLED:  '❌',
  BATCH_STARTED:    '▶️',
  LOGIN_SUSPICIOUS: '⚠️',
  USER_CREATED:     '👤',
  USER_BLOCKED:     '🔒',
  SYSTEM:           'ℹ️',
}

function typeIcon(type: string) {
  return TYPE_ICON[type] ?? '🔔'
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Página ──────────────────────────────────────────────────────
export default function NotificacoesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total,         setTotal]         = useState(0)
  const [totalUnread,   setTotalUnread]   = useState(0)
  const [page,          setPage]          = useState(1)
  const [totalPages,    setTotalPages]    = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [selected,      setSelected]      = useState<Set<string>>(new Set())

  // Filtros
  const [filterModule, setFilterModule] = useState('')
  const [filterUnread, setFilterUnread] = useState(false)

  const PAGE_SIZE = 20

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:     String(page),
        limit:    String(PAGE_SIZE),
        ...(filterUnread              ? { unread: 'true' }         : {}),
        ...(filterModule              ? { module: filterModule }   : {}),
      })
      const res  = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar notificações')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setTotal(data.total ?? 0)
      setTotalUnread(data.totalUnread ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [page, filterModule, filterUnread])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // Resetar página ao mudar filtros
  useEffect(() => { setPage(1) }, [filterModule, filterUnread])

  // ── Ações ──────────────────────────────────────────────────────
  async function markOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setTotalUnread(prev => Math.max(0, prev - 1))
  }

  async function markAll() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setTotalUnread(0)
  }

  async function markSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const res = await fetch('/api/notifications/batch-read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      const { markedRead } = await res.json()
      setNotifications(prev => prev.map(n => selected.has(n.id) ? { ...n, isRead: true } : n))
      setTotalUnread(prev => Math.max(0, prev - markedRead))
      setSelected(new Set())
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === notifications.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(notifications.map(n => n.id)))
    }
  }

  const hasUnreadSelected = notifications
    .filter(n => selected.has(n.id) && !n.isRead)
    .length > 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-surface-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 leading-tight">Notificações</h1>
              <p className="text-xs text-surface-500">
                {totalUnread > 0 ? `${totalUnread} não ${totalUnread === 1 ? 'lida' : 'lidas'}` : 'Tudo lido'}
                {total > 0 && ` · ${total} no total`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas
              </button>
            )}
            <button
              onClick={fetchNotifications}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-100 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Filter className="w-3.5 h-3.5 text-surface-400 shrink-0" />

          {/* Módulo */}
          <select
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
            className="border border-surface-200 rounded-lg px-2.5 py-1.5 text-xs text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="">Todos os módulos</option>
            {Object.entries(MODULE_META).map(([key, m]) => (
              <option key={key} value={key}>{m.label}</option>
            ))}
          </select>

          {/* Status */}
          <button
            onClick={() => setFilterUnread(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filterUnread
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            {filterUnread ? <Check className="w-3 h-3" /> : null}
            Não lidas
          </button>

          {(filterModule || filterUnread) && (
            <button
              onClick={() => { setFilterModule(''); setFilterUnread(false) }}
              className="text-xs text-surface-400 hover:text-surface-600 px-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de ações em lote ───────────────────────────────── */}
      {selected.size > 0 && (
        <div className="px-6 py-2 bg-brand-50 border-b border-brand-100 flex items-center gap-3">
          <span className="text-xs font-medium text-brand-700">
            {selected.size} selecionada{selected.size !== 1 ? 's' : ''}
          </span>
          {hasUnreadSelected && (
            <button
              onClick={markSelected}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              <CheckCheck className="w-3 h-3" /> Marcar como lidas
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-surface-400 hover:text-surface-600"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Lista ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <RefreshCw className="w-5 h-5 animate-spin text-surface-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-surface-400 gap-3">
            <Inbox className="w-10 h-10" />
            <p className="text-sm">Nenhuma notificação encontrada.</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {/* Cabeçalho de seleção */}
            <li className="px-6 py-2 bg-surface-50 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === notifications.length && notifications.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-surface-300 text-brand-600 cursor-pointer"
                title="Selecionar todas"
              />
              <span className="text-xs text-surface-500">Selecionar todas da página</span>
            </li>

            {notifications.map(n => {
              const mod = n.module ? MODULE_META[n.module] : null
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-6 py-4 hover:bg-surface-50 transition-colors ${!n.isRead ? 'bg-brand-50/40' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    className="w-4 h-4 mt-1 rounded border-surface-300 text-brand-600 cursor-pointer shrink-0"
                  />

                  {/* Ícone tipo */}
                  <span className="text-xl shrink-0 mt-0.5 leading-none">{typeIcon(n.type)}</span>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${n.isRead ? 'text-surface-700' : 'text-surface-900'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      <span className="text-xs text-surface-400 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                    </div>

                    {/* Tags inferiores */}
                    <div className="flex items-center gap-2 mt-2">
                      {mod && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${mod.color}`}>
                          {mod.icon}
                          {mod.label}
                        </span>
                      )}
                      {!n.isRead && (
                        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                          Não lida
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ação marcar lida */}
                  {!n.isRead && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="shrink-0 mt-1 w-7 h-7 flex items-center justify-center rounded-lg text-surface-400 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                      title="Marcar como lida"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Paginação ───────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 border-t border-surface-100 bg-white">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 text-surface-600 disabled:opacity-40 hover:bg-surface-50 transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-surface-500 px-2">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 text-surface-600 disabled:opacity-40 hover:bg-surface-50 transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
