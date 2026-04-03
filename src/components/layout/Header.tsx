'use client'

import { Bell, ChevronDown, LogOut, CheckCheck, X } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'
import { MODULE_PLANS } from '@/lib/development-modules'

interface UserInfo {
  name: string
  email: string
  role: string
  initials: string
}

interface Notif {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function notifSymbol(type: string) {
  const map: Record<string, string> = {
    NC_CRITICAL: '!',
    NC_ASSIGNED: '*',
    SYSTEM: 'i',
    QUALITY: 'Q',
    DEFAULT: 'o',
  }
  return map[type] ?? map.DEFAULT
}

export default function Header() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          const { name, email, role } = data.user
          const parts = (name as string).trim().split(' ')
          const initials =
            parts.length >= 2
              ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
              : (name as string).slice(0, 2).toUpperCase()
          setUser({ name, email, role: role?.name ?? role ?? 'Usuário', initials })
        }
      })
      .catch(() => null)
  }, [])

  const loadNotifs = useCallback(() => {
    fetch('/api/notifications?limit=10')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setNotifs(d.notifications ?? [])
          setUnreadCount(d.totalUnread ?? 0)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    loadNotifs()

    function startPolling() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = setInterval(loadNotifs, 60000)
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }

    function handleVisibility() {
      if (document.hidden) stopPolling()
      else {
        loadNotifs()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadNotifs])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const displayName = user?.name ?? 'Usuário'
  const displayRole = user?.role ?? 'Carregando...'
  const initials = user?.initials ?? 'U'
  const currentModuleParam = searchParams.get('modulo')

  const headerContext = (() => {
    if (pathname === '/em-desenvolvimento') {
      const fallback = MODULE_PLANS.metas
      const modulePlan =
        currentModuleParam && MODULE_PLANS[currentModuleParam]
          ? MODULE_PLANS[currentModuleParam]
          : fallback

      return {
        eyebrow: `Módulo • ${modulePlan.label}`,
        title: modulePlan.label === 'Metas' ? 'Gestão Corporativa de Metas' : modulePlan.label,
        subtitle: modulePlan.headline,
      }
    }

    if (pathname.startsWith('/configuracoes')) {
      return {
        eyebrow: 'Configurações • Sistema',
        title: 'Governança e Perfil Corporativo',
        subtitle: 'Administração de segurança, preferências e dados do colaborador',
      }
    }

    return {
      eyebrow: 'Sistema Empresarial',
      title: 'Fábrica Café Ouro Verde',
      subtitle: 'Gestão corporativa integrada com inteligência operacional',
    }
  })()

  return (
    <header className="relative h-20 shrink-0 overflow-visible border-b border-surface-300/60 bg-gradient-to-r from-surface-950 via-surface-900 to-[#0f5b55] px-6 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -left-16 top-0 h-20 w-72 bg-cyan-400/10 blur-2xl" />
        <div className="absolute right-0 top-0 h-20 w-80 bg-emerald-400/10 blur-2xl" />
      </div>

      <div className="relative h-full flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70 font-semibold">
            {headerContext.eyebrow}
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight">{headerContext.title}</p>
          <p className="text-xs text-white/75">{headerContext.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1 backdrop-blur-md">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-surface-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-11 z-50 flex max-h-120 w-80 flex-col rounded-2xl border border-surface-200 bg-white shadow-2xl text-surface-900">
                <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
                  <span className="text-sm font-semibold">Notificações</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800"
                        title="Marcar todas como lidas"
                      >
                        <CheckCheck size={13} /> Ler todas
                      </button>
                    )}
                    <button onClick={() => setShowNotifs(false)} className="rounded-lg p-0.5 hover:bg-surface-100">
                      <X size={14} className="text-surface-400" />
                    </button>
                  </div>
                </div>

                <ul className="flex-1 overflow-y-auto divide-y divide-surface-50">
                  {notifs.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-surface-400">Nenhuma notificação.</li>
                  ) : (
                    notifs.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => markRead(n.id)}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors flex gap-3',
                            !n.isRead && 'bg-primary-50'
                          )}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-200 text-[10px] font-semibold text-surface-700">
                            {notifSymbol(n.type)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn('truncate text-sm font-medium', n.isRead ? 'text-surface-700' : 'text-surface-900')}>
                                {n.title}
                              </p>
                              <span className="shrink-0 text-xs text-surface-400">{timeAgo(n.createdAt)}</span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-surface-500">{n.message}</p>
                          </div>
                          {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="border-t border-surface-100 px-4 py-2.5">
                  <Link
                    href="/notificacoes"
                    onClick={() => setShowNotifs(false)}
                    className="block w-full py-1 text-center text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    Ver todas as notificações
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/configuracoes/perfil"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 transition-colors hover:bg-white/10"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight text-white">{displayName}</p>
              <p className="text-xs leading-tight text-white/70">{displayRole}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-white/70 sm:block" />
          </Link>

          <button
            onClick={handleLogout}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-red-500/20 hover:text-red-100"
            aria-label="Sair do sistema"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
