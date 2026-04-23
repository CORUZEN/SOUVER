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
  Package,
  Truck,
  ShieldCheck,
  Users,
  BarChart3,
  Wallet,
  MessageSquare,
  Settings,
  Plug,
  ChevronRight,
  Clock,
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
  description: string
  icon: React.ElementType
  href?: string
  soon?: boolean
  color: string
  bg: string
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
    description: 'Visão estratégica consolidada',
    icon: LayoutDashboard,
    soon: true,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    id: 'metas',
    title: 'Metas',
    description: 'Gestão comercial e performance',
    icon: Target,
    href: '/app/supervisor',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'producao',
    title: 'Produção',
    description: 'Acompanhamento industrial',
    icon: Package,
    soon: true,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'logistica',
    title: 'Logística',
    description: 'Estoque e movimentação',
    icon: Truck,
    soon: true,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  {
    id: 'qualidade',
    title: 'Qualidade',
    description: 'Controle e conformidade',
    icon: ShieldCheck,
    soon: true,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
  },
  {
    id: 'rh',
    title: 'RH',
    description: 'Gestão de pessoas',
    icon: Users,
    soon: true,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Análises e indicadores',
    icon: BarChart3,
    soon: true,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    id: 'contabilidade',
    title: 'Contabilidade',
    description: 'Gestão administrativa',
    icon: Wallet,
    soon: true,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    description: 'Mensagens e avisos',
    icon: MessageSquare,
    soon: true,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    description: 'Preferências do sistema',
    icon: Settings,
    soon: true,
    color: 'text-surface-300',
    bg: 'bg-surface-500/10 border-surface-500/20',
  },
  {
    id: 'integracoes',
    title: 'Integrações',
    description: 'Sankhya e APIs externas',
    icon: Plug,
    soon: true,
    color: 'text-lime-400',
    bg: 'bg-lime-500/10 border-lime-500/20',
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
            const Wrapper = isClickable ? 'button' : 'div'
            const wrapperProps = isClickable
              ? {
                  onClick: () => router.push(mod.href!),
                  className: `group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all active:scale-95 hover:brightness-110 ${mod.bg}`,
                }
              : {
                  className: `group relative flex flex-col items-start gap-3 rounded-2xl border p-4 opacity-70 ${mod.bg}`,
                }

            return (
              <Wrapper key={mod.id} {...(wrapperProps as any)}>
                <div className="flex w-full items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-950/50 ${mod.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {mod.soon ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] font-medium text-surface-400">
                      <Clock className="h-3 w-3" />
                      Em breve
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{mod.title}</p>
                  <p className="text-[11px] text-surface-400 leading-snug mt-0.5 line-clamp-2">{mod.description}</p>
                </div>
              </Wrapper>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-surface-600">
            SOUVER — Sistema Ouro Verde
          </p>
          <p className="text-[10px] text-surface-700 mt-0.5">
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
