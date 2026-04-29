'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  MODULE_MENU_SECTIONS,
  MODULE_PLANS,
  type ModulePlan,
} from '@/lib/development-modules'
import {
  LayoutDashboard,
  Target,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  FileBarChart2,
  DollarSign,
  MessageSquare,
  Settings,
  ClipboardList,
  UserCog,
  Plug,
  X,
  LogOut,
  User,
  Shield,
  Bell,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

type ModuleKey = keyof typeof MODULE_PLANS

const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  'painel-executivo': LayoutDashboard,
  metas: Target,
  producao: Factory,
  logistica: Truck,
  qualidade: ShieldCheck,
  rh: Users,
  relatorios: FileBarChart2,
  contabilidade: DollarSign,
  comunicacao: MessageSquare,
  integracoes: Plug,
  usuarios: UserCog,
  departamentos: UserCog,
  auditoria: ClipboardList,
  analytics: ClipboardList,
  configuracoes: Settings,
}

const ACCESSIBLE_MODULES: ModuleKey[] = ['metas']
const DIRECT_ROUTES: Partial<Record<ModuleKey, string>> = {
  metas: '/metas',
  integracoes: '/integracoes',
}

function getModuleRoute(moduleKey: ModuleKey): string {
  const directRoute = DIRECT_ROUTES[moduleKey]
  if (directRoute) return directRoute
  return `/em-desenvolvimento?modulo=${moduleKey}`
}

interface MobileNavDrawerProps {
  isOpen: boolean
  onClose: () => void
  user: {
    name: string
    email: string
    role: string
    roleCode?: string | null
    avatarUrl?: string | null
    impersonation?: { active: boolean; developerName: string } | null
  } | null
  unreadCount?: number
  onLogout: () => void
  onStopImpersonation?: () => void
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  user,
  unreadCount = 0,
  onLogout,
  onStopImpersonation,
}: MobileNavDrawerProps) {
  const pathname = usePathname()
  const [canAccessIntegrations, setCanAccessIntegrations] = useState(false)
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({})
  const [modulePermissionsLoaded, setModulePermissionsLoaded] = useState(false)

  useEffect(() => {
    async function loadPerms() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        setCanAccessIntegrations(Boolean(data?.user?.canAccessIntegrations))
        if (data?.user?.modulePermissions && typeof data.user.modulePermissions === 'object') {
          setModulePermissions(data.user.modulePermissions)
        }
      } catch {
        // ignore
      } finally {
        setModulePermissionsLoaded(true)
      }
    }
    if (isOpen) loadPerms()
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  function isActive(moduleKey: ModuleKey): boolean {
    if (moduleKey === 'integracoes') return pathname.startsWith('/integracoes')
    return ACCESSIBLE_MODULES.includes(moduleKey) && pathname === getModuleRoute(moduleKey)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] bg-linear-to-b from-[#07160f] via-[#0f2a1d] to-[#173c2c] shadow-[4px_0_40px_rgba(0,0,0,0.55)] flex flex-col">
        {/* Glow effects */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 top-0 h-72 w-84 bg-[#2c9a73]/20 blur-3xl" />
          <div className="absolute -right-24 top-28 h-80 w-88 bg-[#31b8a2]/14 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-52 w-72 bg-[#6d8f49]/12 blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#c6a277]/26 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <Image src="/branding/ouroverde.png" alt="Ouro Verde" fill priority sizes="48px" className="object-contain" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-[#d3dcc8]">Sistema Empresarial</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#aab89d] transition-colors hover:bg-[#edf0e2]/9 hover:text-[#edf0e2]"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {MODULE_MENU_SECTIONS.map(({ label, itemKeys }) => {
              const visibleItems = itemKeys.filter((key) => {
                const mk = key as ModuleKey
                if (mk === 'integracoes' && !canAccessIntegrations) return false
                if (!modulePermissionsLoaded) return false
                if (modulePermissions[mk] === false) return false
                return true
              })
              if (visibleItems.length === 0) return null

              return (
                <div key={label}>
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8fa084]">{label}</p>
                  <div className="space-y-1">
                    {visibleItems.map((itemKey) => {
                      const mk = itemKey as ModuleKey
                      const plan = MODULE_PLANS[mk]
                      const Icon = MODULE_ICONS[mk]
                      const active = isActive(mk)
                      const isAccessible = ACCESSIBLE_MODULES.includes(mk) || Boolean(DIRECT_ROUTES[mk])

                      return (
                        <Link
                          key={mk}
                          href={isAccessible ? getModuleRoute(mk) : '#'}
                          onClick={(e) => {
                            if (!isAccessible) {
                              e.preventDefault()
                              // In mobile we just close and let the desktop modal handle unavailable
                              onClose()
                            } else {
                              onClose()
                            }
                          }}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all',
                            active
                              ? 'bg-linear-to-r from-[#0f7f5b] via-[#14966f] to-[#1da88d] text-[#f2f5ea] shadow-[inset_0_1px_0_rgba(242,245,234,0.22),0_12px_26px_rgba(10,71,50,0.42)]'
                              : 'text-[#bac8b0] hover:bg-[#0f7f5b]/22 hover:text-[#f2f5ea]'
                          )}
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#edf0e2]' : 'text-[#aac0a2]')} />
                          <span className={cn('flex-1 text-sm font-medium', active ? 'text-[#edf0e2]' : 'text-[#c6d3bb]')}>
                            {plan.label}
                          </span>
                          {!isAccessible && (
                            <span className="shrink-0 text-[11px] text-[#7ea07d]">(Em breve)</span>
                          )}
                          {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#edf0e2]/60" />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Notifications link */}
            <Link
              href="/notificacoes"
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all',
                pathname.startsWith('/notificacoes')
                  ? 'bg-linear-to-r from-[#0f7f5b] via-[#14966f] to-[#1da88d] text-[#f2f5ea]'
                  : 'text-[#bac8b0] hover:bg-[#0f7f5b]/22 hover:text-[#f2f5ea]'
              )}
            >
              <div className="relative">
                <Bell className={cn('h-4 w-4 shrink-0', pathname.startsWith('/notificacoes') ? 'text-[#edf0e2]' : 'text-[#aac0a2]')} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white" />
                )}
              </div>
              <span className="flex-1 text-sm font-medium">Notificações</span>
              {unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                  {unreadCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Profile & Actions */}
          <div className="border-t border-[#b99372]/20 px-3 py-3">
            {user && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#b99372]/15 bg-[#edf0e2]/5 px-3 py-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#b99372]/30 bg-[#edf0e2]/8">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-[#d2dac8]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#edf0e2]">{user.name}</p>
                  <p className="truncate text-xs text-[#b7c3aa]">{user.role}</p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {user?.roleCode === 'DEVELOPER' && (
                <Link
                  href="/dev/gestao-usuarios"
                  onClick={onClose}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#c6d3bb] transition-colors hover:bg-[#edf0e2]/8 hover:text-[#edf0e2]"
                >
                  <Shield className="h-4 w-4 text-[#aab89d]" />
                  Área Dev
                </Link>
              )}
              {user?.roleCode === 'IT_ANALYST' && (
                <Link
                  href="/controle"
                  onClick={onClose}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#c6d3bb] transition-colors hover:bg-[#edf0e2]/8 hover:text-[#edf0e2]"
                >
                  <Users className="h-4 w-4 text-[#aab89d]" />
                  Painel de Controle
                </Link>
              )}
              {user?.impersonation?.active && onStopImpersonation && (
                <button
                  type="button"
                  onClick={() => { onStopImpersonation(); onClose() }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-amber-300 transition-colors hover:bg-amber-500/10"
                >
                  <Shield className="h-4 w-4" />
                  Voltar para Dev
                </button>
              )}
              <Link
                href="/configuracoes/perfil"
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#c6d3bb] transition-colors hover:bg-[#edf0e2]/8 hover:text-[#edf0e2]"
              >
                <User className="h-4 w-4 text-[#aab89d]" />
                Ver perfil
              </Link>
              <button
                type="button"
                onClick={() => { onLogout(); onClose() }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sair do sistema
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
