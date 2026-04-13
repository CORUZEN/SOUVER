'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { MODULE_MENU_SECTIONS, MODULE_PLANS } from '@/lib/development-modules'
import {
  LayoutDashboard,
  Target,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  FileBarChart2,
  MessageSquare,
  Settings,
  ClipboardList,
  UserCog,
  Plug,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  Construction,
  X,
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

const DEFAULT_MODULE: ModuleKey = 'metas'
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

interface SidebarProps {
  appVersion: string
}

export default function Sidebar({ appVersion }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [showDevModal, setShowDevModal] = useState(false)
  const [devTargetLabel, setDevTargetLabel] = useState('')
  const [isRhExpanded, setIsRhExpanded] = useState(false)
  const [isReportsExpanded, setIsReportsExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [canAccessIntegrations, setCanAccessIntegrations] = useState(false)

  const selectedModuloParam = searchParams.get('modulo')
  const activeAccessibleModule: ModuleKey | null =
    pathname === '/metas'
      ? 'metas'
      : pathname !== '/em-desenvolvimento'
        ? null
        : selectedModuloParam && ACCESSIBLE_MODULES.includes(selectedModuloParam as ModuleKey)
          ? (selectedModuloParam as ModuleKey)
          : DEFAULT_MODULE

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 1360px)')
    if (mediaQuery.matches) setIsCollapsed(true)

    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsCollapsed(true)
    }

    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setCanAccessIntegrations(Boolean(data?.user?.canAccessIntegrations))
      })
      .catch(() => setCanAccessIntegrations(false))
  }, [])

  function openDevelopmentModal(moduleLabel: string) {
    setDevTargetLabel(moduleLabel)
    setShowDevModal(true)
  }

  function closeDevelopmentModal() {
    setShowDevModal(false)
  }

  function handleUnavailableClick(moduleKey: ModuleKey) {
    openDevelopmentModal(MODULE_PLANS[moduleKey].label)
  }

  useEffect(() => {
    if (!showDevModal) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDevelopmentModal()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showDevModal])

  useEffect(() => {
    if (!showDevModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showDevModal])

  function toggleSidebar() {
    setIsCollapsed((prev) => !prev)
  }

  function renderMenuItem(
    moduleKey: ModuleKey,
    options?: {
      isSubmenu?: boolean
      expandable?: boolean
      expanded?: boolean
      onToggleExpand?: () => void
    }
  ) {
    const { isSubmenu = false, expandable = false, expanded = false, onToggleExpand } = options ?? {}
    const modulePlan = MODULE_PLANS[moduleKey]
    const Icon = MODULE_ICONS[moduleKey]
    const isAccessible = ACCESSIBLE_MODULES.includes(moduleKey) || Boolean(DIRECT_ROUTES[moduleKey])
    const isActive = moduleKey === 'integracoes'
      ? pathname.startsWith('/integracoes')
      : ACCESSIBLE_MODULES.includes(moduleKey) && activeAccessibleModule === moduleKey
    const badgeLabel = moduleKey === 'metas' || moduleKey === 'integracoes' ? null : '(Em breve)'

    const baseClass = cn(
      'w-full flex items-center rounded-lg transition-all duration-300 cursor-pointer text-left',
      isCollapsed
        ? 'justify-center px-0 py-2.5'
        : isSubmenu
          ? 'gap-3 pl-8 pr-3 py-2.5'
          : 'gap-3 px-3 py-2.5',
      isActive
        ? 'bg-emerald-500 text-white shadow-[0_6px_18px_rgba(16,185,129,0.35)]'
        : 'text-surface-400 hover:bg-emerald-500/12 hover:text-emerald-100'
    )

    if (isAccessible) {
      return (
        <Link
          key={moduleKey}
          href={getModuleRoute(moduleKey)}
          className={baseClass}
          title={modulePlan.label}
          onClick={(event) => {
            if (isCollapsed) {
              event.preventDefault()
              event.stopPropagation()
              setIsCollapsed(false)
            }
          }}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 min-w-0 truncate text-sm font-medium">{modulePlan.label}</span>
              {badgeLabel && (
                <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
                  {badgeLabel}
                </span>
              )}
            </>
          )}
        </Link>
      )
    }

    return (
      <button
        key={moduleKey}
        type="button"
        onClick={() => {
          if (isCollapsed) {
            setIsCollapsed(false)
            return
          }
          handleUnavailableClick(moduleKey)
        }}
        className={baseClass}
        title={modulePlan.label}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 min-w-0 truncate text-sm font-medium">{modulePlan.label}</span>
            <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
              {badgeLabel}
            </span>
            {expandable && (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleExpand?.()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onToggleExpand?.()
                  }
                }}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-surface-700"
                aria-label={expanded ? 'Recolher submenu' : 'Expandir submenu'}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            )}
          </>
        )}
      </button>
    )
  }

  return (
    <>
      <aside
        onClick={() => {
          if (isCollapsed) setIsCollapsed(false)
        }}
        className={cn(
          'shrink-0 bg-surface-900 flex flex-col h-full border-r border-surface-700/40 transition-[width] duration-300 ease-out',
          isCollapsed && 'cursor-pointer',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div
          className={cn(
            'relative flex items-center border-b border-surface-700/50',
            isCollapsed ? 'h-[72px] justify-center px-2.5' : 'h-16 px-4'
          )}
        >
          <div className={cn('w-full', isCollapsed ? 'flex justify-center' : 'flex items-center gap-3 pr-8')}>
            <div className={cn('flex shrink-0', isCollapsed ? 'justify-center' : 'justify-start')}>
              <div
                className={cn(
                  'relative shrink-0 overflow-hidden',
                  isCollapsed ? 'h-[56px] w-[56px] rounded-lg' : 'h-[84px] w-[84px] rounded-xl'
                )}
              >
                <Image
                  src="/branding/ouroverde.png"
                  alt="Logo Ouro Verde"
                  fill
                  priority
                  sizes={isCollapsed ? '56px' : '84px'}
                  className="object-contain"
                />
              </div>
            </div>

            {!isCollapsed && (
              <>
                <div
                  aria-hidden="true"
                  className="h-8 w-px shrink-0 bg-gradient-to-b from-surface-500/20 via-surface-200/70 to-surface-500/20"
                />
                <div className="min-w-0">
                  <p className="text-surface-300 text-[11.5px] font-semibold tracking-[0.1em] uppercase leading-tight break-normal [word-break:keep-all]">
                    Sistema Empresarial
                  </p>
                </div>
              </>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toggleSidebar()
              }}
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
              aria-label="Recolher menu lateral"
              title="Recolher menu lateral"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className={cn('flex-1 overflow-y-auto py-4', isCollapsed ? 'px-2' : 'px-3', 'space-y-4')}>
          {MODULE_MENU_SECTIONS.map(({ label, itemKeys }) => (
            <div key={label}>
              {!isCollapsed ? (
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-3 mb-1">{label}</p>
              ) : (
                <div className="mx-2 mb-2 h-px bg-surface-800" />
              )}

              <div className="space-y-0.5">
                {itemKeys.map((itemKey) => {
                  const moduleKey = itemKey as ModuleKey
                  if (moduleKey === 'integracoes' && !canAccessIntegrations) return null

                  if (moduleKey === 'rh') {
                    return (
                      <div key={moduleKey} className="space-y-0.5">
                        {renderMenuItem('rh', {
                          expandable: true,
                          expanded: isRhExpanded,
                          onToggleExpand: () => setIsRhExpanded((prev) => !prev),
                        })}
                        {!isCollapsed && isRhExpanded && renderMenuItem('usuarios', { isSubmenu: true })}
                      </div>
                    )
                  }

                  if (moduleKey === 'relatorios') {
                    return (
                      <div key={moduleKey} className="space-y-0.5">
                        {renderMenuItem('relatorios', {
                          expandable: true,
                          expanded: isReportsExpanded,
                          onToggleExpand: () => setIsReportsExpanded((prev) => !prev),
                        })}
                        {!isCollapsed && isReportsExpanded && renderMenuItem('auditoria', { isSubmenu: true })}
                      </div>
                    )
                  }

                  return renderMenuItem(moduleKey)
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('border-t border-surface-700/50', isCollapsed ? 'p-2' : 'p-3')}>
          {isCollapsed ? (
            <div className="flex h-8 items-center justify-center rounded-lg text-surface-500">
              <PanelLeftClose className="h-4 w-4" />
            </div>
          ) : (
            <>
              <p className="text-surface-500 text-[11px] text-center font-semibold tracking-wide uppercase">
                SISTEMA OURO VERDE {'\u00A9'} 2026
              </p>
              <p className="text-surface-600 text-[11px] text-center mt-1">Vers{'\u00E3'}o v{appVersion}</p>
            </>
          )}
        </div>
      </aside>

      {showDevModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-950/60 backdrop-blur-[2px] p-4"
          onClick={closeDevelopmentModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-surface-900 via-surface-800 to-primary-900 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                    <Construction className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Seção em desenvolvimento</p>
                    <p className="mt-0.5 text-xs text-white/80">{devTargetLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDevelopmentModal}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-surface-700 leading-relaxed">
                Esta funcionalidade está em planejamento técnico e será liberada em breve no padrão corporativo do
                Sistema Ouro Verde.
              </p>
              <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                <p className="text-xs font-medium text-surface-600">
                  Status atual: <span className="text-primary-700 font-semibold">Em desenvolvimento</span>
                </p>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={closeDevelopmentModal}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-surface-900 px-4 text-sm font-semibold text-white hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


