'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { clearPwaClientState } from '@/lib/pwa/clear-client-state'
import { APP_VERSION_LABEL } from '@/generated/app-version'
import {
  RefreshCw,
  LogOut,
  CloudOff,
  LayoutDashboard,
  Target,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  BarChart3,
  Landmark,
  MessageSquare,
  Settings,
  Plug,
  ChevronRight,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface UserInfo {
  name: string
  role: string
  roleCode: string
}

interface ModuleBlock {
  id: string
  title: string
  icon: React.ElementType
  href?: string
  soon?: boolean
  iconColor: string
  activeGradient: string
  inactiveGradient: string
  activeBorder: string
  inactiveBorder: string
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatHeaderIdentity(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].toUpperCase()
  return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase()
}

const MODULES: ModuleBlock[] = [
  {
    id: 'executive',
    title: 'Painel Executivo',
    icon: LayoutDashboard,
    soon: true,
    iconColor: 'text-sky-300/70',
    activeGradient: 'from-sky-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-sky-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'metas',
    title: 'Metas',
    icon: Target,
    href: '/app/supervisor',
    iconColor: 'text-emerald-300',
    activeGradient: 'from-emerald-900/30 via-emerald-950/20 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-emerald-400/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'producao',
    title: 'Produção',
    icon: Factory,
    soon: true,
    iconColor: 'text-amber-300/70',
    activeGradient: 'from-amber-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-amber-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'logistica',
    title: 'Logística',
    icon: Truck,
    soon: true,
    iconColor: 'text-orange-300/70',
    activeGradient: 'from-orange-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-orange-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'qualidade',
    title: 'Qualidade',
    icon: ShieldCheck,
    soon: true,
    iconColor: 'text-teal-300/70',
    activeGradient: 'from-teal-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-teal-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'rh',
    title: 'RH',
    icon: Users,
    soon: true,
    iconColor: 'text-indigo-300/70',
    activeGradient: 'from-indigo-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-indigo-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: BarChart3,
    soon: true,
    iconColor: 'text-violet-300/70',
    activeGradient: 'from-violet-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-violet-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'contabilidade',
    title: 'Contabilidade',
    icon: Landmark,
    soon: true,
    iconColor: 'text-cyan-300/70',
    activeGradient: 'from-cyan-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-cyan-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    icon: MessageSquare,
    soon: true,
    iconColor: 'text-pink-300/70',
    activeGradient: 'from-pink-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-pink-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Settings,
    soon: true,
    iconColor: 'text-surface-300/70',
    activeGradient: 'from-surface-800/30 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-surface-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
  {
    id: 'integracoes',
    title: 'Integrações',
    icon: Plug,
    soon: true,
    iconColor: 'text-lime-300/70',
    activeGradient: 'from-lime-900/20 via-emerald-950/10 to-surface-950',
    inactiveGradient: 'from-surface-800/20 via-surface-900/10 to-surface-950/70',
    activeBorder: 'border-lime-500/20',
    inactiveBorder: 'border-white/[0.04]',
  },
]

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function DiretoriaPwaDashboard() {
  const router = useRouter()

  const [user, setUser] = useState<UserInfo | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [bootProgress, setBootProgress] = useState(0)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const authCheckStartedRef = useRef(false)

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authCheckStartedRef.current) return
    authCheckStartedRef.current = true
    setBootProgress(5)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) { router.replace('/app/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        if (roleCode !== 'DIRECTORATE' && roleCode !== 'DEVELOPER' && roleCode !== 'COMMERCIAL_MANAGER') {
          router.replace('/app')
          return
        }
        setBootProgress(100)
        setUser({
          name: data.user.name,
          role: data.user.role,
          roleCode,
        })
        setLoadState('success')
      })
      .catch(() => router.replace('/app/login'))
  }, [router])

  // ── Online status ────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    if (isSigningOut) return
    try {
      setShowSignOutConfirm(false)
      setIsSigningOut(true)
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {})
    } finally {
      await clearPwaClientState()
      window.location.replace('/app/login')
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!user || loadState !== 'success') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-950">
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
          <Image
            src="/branding/ouroverde-badge.webp"
            alt="Ouro Verde"
            fill
            sizes="64px"
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-white">Ouro Verde</p>
          <p className="text-xs text-surface-400">Carregando sistema</p>
        </div>
        <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-surface-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${bootProgress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pwa-shell flex h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain bg-surface-950 text-white [touch-action:pan-y] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="pwa-topbar sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <Image src="/branding/ouroverde.webp" alt="Ouro Verde" fill sizes="48px" className="object-contain" priority />
            </div>
            <div className="h-9 w-px bg-surface-700/60" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold leading-tight text-white">{formatHeaderIdentity(user.name)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-300 leading-tight">
                DIRETORIA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="pwa-offline-indicator flex h-9 w-9 items-center justify-center rounded-lg" title="Sem conexão com a internet" aria-label="Sem conexão com a internet">
                <CloudOff className="h-4.5 w-4.5" />
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95"
              aria-label="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              disabled={isSigningOut}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-rose-400 active:scale-95"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pb-8 pt-5">

        {/* Greeting */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-white">Central de Comando</h1>
          <p className="text-xs text-surface-400 mt-0.5">Acesse os módulos corporativos do Ouro Verde</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon
            const isClickable = !!mod.href && !mod.soon
            const gradient = mod.soon ? mod.inactiveGradient : mod.activeGradient
            const border = mod.soon ? mod.inactiveBorder : mod.activeBorder

            const Wrapper = isClickable ? 'button' : 'div'
            const wrapperProps = isClickable
              ? {
                  onClick: () => router.push(mod.href!),
                  className: `group relative flex items-center gap-2.5 rounded-2xl border ${border} bg-gradient-to-br ${gradient} py-4 px-3.5 text-left shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 active:scale-[0.98]`,
                }
              : {
                  className: `group relative flex items-center gap-2.5 rounded-2xl border ${border} bg-gradient-to-br ${gradient} py-4 px-3.5 shadow-md shadow-black/15 opacity-55`,
                }

            return (
              <Wrapper key={mod.id} {...(wrapperProps as any)}>
                {/* Icon — clean, no box */}
                <Icon className={`h-5 w-5 shrink-0 ${mod.iconColor}`} strokeWidth={1.7} />

                {/* Title */}
                <span className="flex-1 text-[13px] font-bold text-white leading-tight">
                  {mod.title}
                </span>

                {/* Active arrow */}
                {isClickable && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400/60 transition-transform group-hover:translate-x-0.5" />
                )}
              </Wrapper>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-1">
          <div className="h-px w-12 bg-emerald-500/15" />
          <p className="mt-3 text-[11px] font-semibold tracking-wide text-surface-400 uppercase">
            Sistema Ouro Verde © 2026
          </p>
          <p className="text-[10px] text-surface-600">
            Versão {APP_VERSION_LABEL}
          </p>
        </div>
      </main>

      {/* ── Sign-out confirm ─────────────────────────────────────────────── */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-900 p-5 shadow-2xl">
            <p className="text-base font-semibold text-white">Sair do sistema?</p>
            <p className="mt-1 text-sm text-surface-400">Você precisará fazer login novamente.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 rounded-xl bg-surface-800 py-2.5 text-sm font-medium text-white hover:bg-surface-700 active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={isSigningOut}
                className="flex-1 rounded-xl bg-rose-500/20 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/30 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isSigningOut ? 'Saindo…' : 'Sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
