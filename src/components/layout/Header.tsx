'use client'

import { Bell, ChevronDown, LogOut, CheckCheck, X, User, Shield } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import MobilePwaRedirect from './MobilePwaRedirect'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'
import { MODULE_PLANS } from '@/lib/development-modules'
import { fetchAuthMeCached } from '@/lib/client/auth-me-cache'

interface UserInfo {
  name: string
  email: string
  role: string
  roleCode?: string | null
  avatarUrl?: string | null
  impersonation?: {
    active: boolean
    developerName: string
  } | null
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
  return (
    <>
      <MobilePwaRedirect />
      <HeaderInner />
    </>
  )
}

function HeaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchAuthMeCached()
      .then((data) => {
        if (data?.user) {
          const { name, email, role, roleCode, avatarUrl, impersonation } = data.user
          setUser({
            name,
            email,
            role: role?.name ?? role ?? 'Usuário',
            roleCode: roleCode ?? null,
            avatarUrl: avatarUrl ?? null,
            impersonation: impersonation ?? null,
          })
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
      if (document.hidden) {
        stopPolling()
      } else {
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
    function handler(event: MouseEvent) {
      const target = event.target as Node

      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifs(false)
      }

      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileMenu(false)
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

  async function handleStopImpersonation() {
    await fetch('/api/auth/impersonate/stop', { method: 'POST' })
    window.location.reload()
  }

  const displayName = user?.name ?? 'Usuário'
  const displayRole = user?.role ?? 'Carregando...'
  const currentModuleParam = searchParams.get('modulo')

  const headerContext = (() => {
    if (pathname === '/metas' || pathname === '/em-desenvolvimento') {
      const fallback = MODULE_PLANS.metas
      const modulePlan =
        pathname === '/metas'
          ? fallback
          : currentModuleParam && MODULE_PLANS[currentModuleParam]
          ? MODULE_PLANS[currentModuleParam]
          : fallback

      return {
        eyebrow: `Módulo • ${modulePlan.label}`,
        title: modulePlan.label === 'Metas' ? 'PAINEL DE METAS' : modulePlan.label,
        subtitle: modulePlan.headline,
      }
    }

    if (pathname.startsWith('/notificacoes')) {
      return {
        eyebrow: 'Notificações • Sistema',
        title: 'Central de Notificações',
        subtitle: 'Acompanhamento inteligente de alertas, eventos e atualizações operacionais',
      }
    }

    if (pathname === '/dev') {
      return {
        eyebrow: 'Área Dev • Governança',
        title: 'Central do Desenvolvedor',
        subtitle: 'Acesso corporativo para gestão de usuários e permissões do sistema',
      }
    }

    if (pathname.startsWith('/dev/gestao-usuarios')) {
      return {
        eyebrow: 'Área Dev • Identidades',
        title: 'Gestão de Usuários',
        subtitle: 'Administração de contas, status e ciclo de acesso corporativo',
      }
    }

    if (pathname.startsWith('/dev/gestao-permissoes')) {
      return {
        eyebrow: 'Área Dev • Acessos',
        title: 'Gestão de Permissões',
        subtitle: 'Controle de grupos, privilégios e delegação de acesso por usuário',
      }
    }

    if (pathname.startsWith('/configuracoes')) {
      return {
        eyebrow: 'Configurações • Perfil',
        title: 'Perfil do colaborador',
        subtitle: 'Preferências e dados do colaborador',
      }
    }

    if (pathname.startsWith('/integracoes')) {
      return {
        eyebrow: 'Configurações • Integrações',
        title: 'Integrações ERP',
        subtitle: 'Conectividade corporativa com Sankhya e sistemas externos',
      }
    }

    return {
      eyebrow: 'Sistema Empresarial',
      title: 'Fábrica Café Ouro Verde',
      subtitle: 'Gestão corporativa integrada com inteligência operacional',
    }
  })()

  return (
    <header className="relative z-40 h-20 shrink-0 overflow-visible border-b border-surface-300/60 bg-linear-to-r from-surface-950 via-surface-900 to-[#0f5b55] px-6 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -left-16 top-0 h-20 w-72 bg-cyan-400/10 blur-2xl" />
        <div className="absolute right-0 top-0 h-20 w-80 bg-emerald-400/10 blur-2xl" />
      </div>

      <div className="relative flex h-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{headerContext.eyebrow}</p>
          <p className="mt-1 text-lg font-semibold leading-tight">{headerContext.title}</p>
          <p className="text-xs text-white/75">{headerContext.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1 backdrop-blur-md">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs((prev) => !prev)}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Notificações"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white ring-2 ring-surface-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-11 z-50 flex max-h-120 w-80 flex-col rounded-2xl border border-surface-200 bg-white text-surface-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
                  <span className="text-sm font-semibold">Notificações</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex cursor-pointer items-center gap-1 text-xs text-primary-700 hover:text-primary-800"
                        title="Marcar todas como lidas"
                      >
                        <CheckCheck size={13} /> Ler todas
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifs(false)}
                      className="cursor-pointer rounded-lg p-0.5 hover:bg-surface-100"
                      aria-label="Fechar notificações"
                    >
                      <X size={14} className="text-surface-400" />
                    </button>
                  </div>
                </div>

                <ul className="max-h-80 flex-1 divide-y divide-surface-50 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-surface-400">Nenhuma notificação.</li>
                  ) : (
                    notifs.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => markRead(n.id)}
                          className={cn(
                            'flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50',
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
                    className="block w-full py-1 text-center text-xs font-medium text-primary-700 transition-colors hover:text-primary-800"
                  >
                    Ver todas as notificações
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex min-w-52.5 cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-1.5 transition-colors hover:bg-white/10"
              aria-label="Abrir menu do perfil"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4.5 w-4.5 text-white/75" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold leading-tight text-white">{displayName}</p>
                <p className="truncate text-xs leading-tight text-white/70">{displayRole}</p>
              </div>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/70 transition-transform', showProfileMenu && 'rotate-180')} />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-surface-200 bg-white py-1.5 text-surface-900 shadow-2xl">
                <Link
                  href="/configuracoes/perfil"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-50"
                >
                  <User className="h-4 w-4 text-surface-500" />
                  Ver perfil
                </Link>
                {user?.roleCode === 'DEVELOPER' && (
                  <Link
                    href="/dev"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-50"
                  >
                    <Shield className="h-4 w-4 text-surface-500" />
                    Dev
                  </Link>
                )}
                {user?.impersonation?.active && (
                  <button
                    type="button"
                    onClick={handleStopImpersonation}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <Shield className="h-4 w-4" />
                    Voltar para Dev
                  </button>
                )}
                <div className="my-1 border-t border-surface-200" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="ml-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-red-500/20 hover:text-red-100"
            aria-label="Sair do sistema"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

