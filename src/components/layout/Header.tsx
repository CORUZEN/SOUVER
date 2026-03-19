'use client'

import { Bell, ChevronDown, LogOut, CheckCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface UserInfo {
  name: string
  email: string
  role: string
  initials: string
}

interface Notif {
  id:        string
  type:      string
  title:     string
  message:   string
  isRead:    boolean
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function notifIcon(type: string) {
  const map: Record<string, string> = {
    NC_CRITICAL: '🔴', NC_ASSIGNED: '🔶', SYSTEM: 'ℹ️', QUALITY: '🧪', DEFAULT: '🔔',
  }
  return map[type] ?? map.DEFAULT
}

export default function Header() {
  const [user,         setUser]         = useState<UserInfo | null>(null)
  const [notifs,       setNotifs]       = useState<Notif[]>([])
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [showNotifs,   setShowNotifs]   = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          const { name, email, role } = data.user
          const parts = (name as string).trim().split(' ')
          const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : (name as string).slice(0, 2).toUpperCase()
          setUser({ name, email, role: role?.name ?? role ?? 'Usuário', initials })
        }
      })
      .catch(() => null)
  }, [])

  const loadNotifs = () => {
    fetch('/api/notifications?limit=20')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setNotifs(d.notifications ?? [])
          setUnreadCount(d.totalUnread ?? 0)
        }
      })
      .catch(() => null)
  }

  useEffect(() => {
    loadNotifs()
    const t = setInterval(loadNotifs, 30000) // poll a cada 30s
    return () => clearInterval(t)
  }, [])

  // Fecha dropdown ao clicar fora
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
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const displayName = user?.name ?? 'Usuário'
  const displayRole = user?.role ?? 'Carregando...'
  const initials = user?.initials ?? 'U'

  return (
    <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <p className="text-sm font-semibold text-surface-900">
          Fábrica Café Ouro Verde
        </p>
        <p className="text-xs text-surface-500">Sistema de Gestão Corporativa</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Notificações */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown notificações */}
          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-surface-200 z-50 flex flex-col max-h-120">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
                <span className="font-semibold text-surface-900 text-sm">Notificações</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck size={13} /> Ler todas
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="p-0.5 hover:bg-surface-100 rounded-lg">
                    <X size={14} className="text-surface-400" />
                  </button>
                </div>
              </div>

              {/* Lista */}
              <ul className="flex-1 overflow-y-auto divide-y divide-surface-50">
                {notifs.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-surface-400">
                    Nenhuma notificação.
                  </li>
                ) : notifs.map(n => (
                  <li key={n.id}>
                    <button
                      onClick={() => markRead(n.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors flex gap-3 ${!n.isRead ? 'bg-brand-50' : ''}`}
                    >
                      <span className="text-base shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${n.isRead ? 'text-surface-700' : 'text-surface-900'}`}>
                            {n.title}
                          </p>
                          <span className="text-xs text-surface-400 shrink-0">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Footer — ver todas */}
              <div className="border-t border-surface-100 px-4 py-2.5">
                <Link
                  href="/notificacoes"
                  onClick={() => setShowNotifs(false)}
                  className="block w-full text-center text-xs font-medium text-brand-600 hover:text-brand-800 py-1"
                >
                  Ver todas as notificações
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Perfil do usuário */}
        <Link
          href="/configuracoes/perfil"
          className="flex items-center gap-2 pl-2 border-l border-surface-200 hover:bg-surface-50 rounded-lg px-2 py-1 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-surface-900 leading-tight">
              {displayName}
            </p>
            <p className="text-xs text-surface-500 leading-tight">
              {displayRole}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-surface-400 hidden sm:block" />
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-surface-500 hover:bg-red-50 hover:text-red-600 transition-colors ml-1"
          aria-label="Sair do sistema"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
