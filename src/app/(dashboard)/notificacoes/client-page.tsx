'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Filter,
  Inbox,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  Lock,
  Settings,
  Check,
  Circle,
  AlertTriangle,
  Info,
  ShieldAlert,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  module: string | null
  link: string | null
  isRead: boolean
  createdAt: string
  readAt: string | null
}

const MODULE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  production: { label: 'Produção', icon: Factory },
  inventory: { label: 'Logística', icon: Truck },
  quality: { label: 'Qualidade', icon: ShieldCheck },
  hr: { label: 'RH', icon: Users },
  auth: { label: 'Acesso', icon: Lock },
  system: { label: 'Sistema', icon: Settings },
}

function getTypeIcon(type: string) {
  if (type.includes('CRITICAL')) return ShieldAlert
  if (type.includes('LOGIN') || type.includes('BLOCKED')) return AlertTriangle
  if (type.includes('SYSTEM')) return Info
  return Activity
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NotificacoesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [totalUnread, setTotalUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [filterModule, setFilterModule] = useState('')
  const [filterUnread, setFilterUnread] = useState(false)

  const PAGE_SIZE = 20

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(filterUnread ? { unread: 'true' } : {}),
        ...(filterModule ? { module: filterModule } : {}),
      })

      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar notificações')
      const data = await res.json()

      setNotifications(data.notifications ?? [])
      setTotal(data.total ?? 0)
      setTotalUnread(data.totalUnread ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [page, filterModule, filterUnread])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    setPage(1)
  }, [filterModule, filterUnread])

  async function markOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setTotalUnread((prev) => Math.max(0, prev - 1))
  }

  async function markAll() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
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

    if (!res.ok) return

    const { markedRead } = await res.json()
    setNotifications((prev) => prev.map((n) => (selected.has(n.id) ? { ...n, isRead: true } : n)))
    setTotalUnread((prev) => Math.max(0, prev - markedRead))
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === notifications.length) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(notifications.map((n) => n.id)))
  }

  const readCount = Math.max(0, total - totalUnread)
  const hasUnreadSelected = notifications.some((n) => selected.has(n.id) && !n.isRead)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-surface-900">Notificações</h1>
              <p className="text-sm text-surface-500">Central corporativa de alertas e eventos operacionais</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 px-3 text-xs font-semibold text-surface-700 transition-colors hover:bg-surface-50"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={fetchNotifications}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50"
              title="Atualizar notificações"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Total</p>
            <p className="mt-1 text-lg font-semibold text-surface-900">{total}</p>
          </div>
          <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Não lidas</p>
            <p className="mt-1 text-lg font-semibold text-primary-800">{totalUnread}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Lidas</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{readCount}</p>
          </div>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-surface-400" />

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="h-9 rounded-lg border border-surface-200 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Todos os módulos</option>
            {Object.entries(MODULE_META).map(([key, mod]) => (
              <option key={key} value={key}>
                {mod.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFilterUnread((v) => !v)}
            className={cn(
              'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
              filterUnread
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-surface-200 text-surface-700 hover:bg-surface-50'
            )}
          >
            {filterUnread && <Check className="h-4 w-4" />}
            Apenas não lidas
          </button>

          {(filterModule || filterUnread) && (
            <button
              onClick={() => {
                setFilterModule('')
                setFilterUnread(false)
              }}
              className="h-9 cursor-pointer rounded-lg px-2 text-sm text-surface-500 transition-colors hover:text-surface-700"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
            <p className="text-xs font-semibold text-primary-800">{selected.size} selecionada(s)</p>
            {hasUnreadSelected && (
              <button
                onClick={markSelected}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar selecionadas como lidas
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto cursor-pointer text-xs font-medium text-surface-500 hover:text-surface-700"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-surface-200">
          <div className="flex items-center gap-3 border-b border-surface-200 bg-surface-50 px-4 py-2.5">
            <input
              type="checkbox"
              checked={selected.size === notifications.length && notifications.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 cursor-pointer rounded border-surface-300 text-primary-600"
            />
            <span className="text-xs font-medium text-surface-500">Selecionar todas da página</span>
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center text-surface-500">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-surface-400">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhuma notificação encontrada.</p>
            </div>
          ) : (
            <ul className="divide-y divide-surface-100">
              {notifications.map((n) => {
                const mod = n.module ? MODULE_META[n.module] : null
                const TypeIcon = getTypeIcon(n.type)

                return (
                  <li key={n.id} className={cn('px-4 py-3 transition-colors hover:bg-surface-50', !n.isRead && 'bg-primary-50/40')}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-surface-300 text-primary-600"
                      />

                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', !n.isRead ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500')}>
                        <TypeIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className={cn('text-sm font-semibold', n.isRead ? 'text-surface-700' : 'text-surface-900')}>{n.title}</p>
                          <span className="shrink-0 text-xs text-surface-400">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-surface-600">{n.message}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {mod && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-surface-600">
                              <mod.icon className="h-3.5 w-3.5" />
                              {mod.label}
                            </span>
                          )}

                          {!n.isRead ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                              <Circle className="h-2.5 w-2.5 fill-current" />
                              Não lida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                              Lida
                            </span>
                          )}
                        </div>
                      </div>

                      {!n.isRead && (
                        <button
                          onClick={() => markOne(n.id)}
                          className="mt-0.5 inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-surface-200 px-2.5 text-xs font-semibold text-surface-600 transition-colors hover:bg-surface-100"
                        >
                          Lida
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 rounded-lg border border-surface-200 px-3 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-2 text-xs font-medium text-surface-500">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 rounded-lg border border-surface-200 px-3 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
