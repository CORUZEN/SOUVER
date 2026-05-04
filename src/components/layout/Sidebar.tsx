'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { MODULE_MENU_SECTIONS, MODULE_PLANS } from '@/lib/development-modules'
import { useAuth } from '@/lib/client/hooks/use-auth'
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
  const [isLogisticaExpanded, setIsLogisticaExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [canAccessIntegrations, setCanAccessIntegrations] = useState(false)
  const [modulePermissionsLoaded, setModulePermissionsLoaded] = useState(false)
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({})

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

  const { data: authData } = useAuth()

  useEffect(() => {
    if (authData) {
      setCanAccessIntegrations(Boolean(authData?.user?.canAccessIntegrations))
      if (authData?.user?.modulePermissions && typeof authData.user.modulePermissions === 'object') {
        setModulePermissions(authData.user.modulePermissions)
      }
      setModulePermissionsLoaded(true)
    }
  }, [authData])

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
    const iconClass = cn(
      'w-4 h-4 shrink-0 transition-all duration-300',
      isActive
        ? 'text-[#edf0e2] drop-shadow-[0_1px_6px_rgba(18,167,109,0.35)]'
        : 'text-[#aac0a2] group-hover:text-[#dce6d2] group-hover:drop-shadow-[0_1px_4px_rgba(134,182,75,0.28)]'
    )
    const labelClass = cn(
      'flex-1 min-w-0 truncate text-sm font-medium transition-colors',
      isActive ? 'text-[#edf0e2]' : 'text-[#c6d3bb] group-hover:text-[#edf0e2]'
    )
    const badgeClass = cn(
      'shrink-0 text-[11px] font-medium transition-colors',
      isActive
        ? 'text-[#e9efe0]/85'
        : 'text-[#7ea07d] group-hover:text-[#9db49a]'
    )

    const baseClass = cn(
      'group w-full flex items-center rounded-lg transition-all duration-300 cursor-pointer text-left ring-1 ring-transparent',
      isCollapsed
        ? 'justify-center px-0 py-2.5'
        : isSubmenu
          ? 'gap-3 pl-8 pr-3 py-2.5'
          : 'gap-3 px-3 py-2.5',
      isActive
        ? 'ring-[#3de0af]/35 bg-linear-to-r from-[#0f7f5b] via-[#14966f] to-[#1da88d] text-[#f2f5ea] shadow-[inset_0_1px_0_rgba(242,245,234,0.22),0_12px_26px_rgba(10,71,50,0.42)]'
        : 'text-[#bac8b0] hover:ring-[#c6a277]/24 hover:bg-linear-to-r hover:from-[#0f7f5b]/22 hover:via-[#14966f]/14 hover:to-[#1da88d]/10 hover:text-[#f2f5ea] hover:shadow-[inset_0_1px_0_rgba(242,245,234,0.08),0_8px_18px_rgba(8,17,12,0.26)]'
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
          <Icon className={iconClass} />
          {!isCollapsed && (
            <>
              <span className={labelClass}>{modulePlan.label}</span>
              {badgeLabel && (
                <span className={badgeClass}>
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
        <Icon className={iconClass} />
        {!isCollapsed && (
          <>
            <span className={labelClass}>{modulePlan.label}</span>
            <span className={badgeClass}>
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
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-[#9fb398] transition-colors hover:bg-[#edf0e2]/10 hover:text-[#edf0e2]"
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
          'relative shrink-0 flex flex-col h-full overflow-hidden border-r border-[#3f6d57]/50 bg-linear-to-b from-[#07160f] via-[#0f2a1d] to-[#173c2c] shadow-[inset_0_1px_0_rgba(242,245,234,0.08),inset_-1px_0_0_rgba(198,162,119,0.14),0_18px_40px_rgba(5,12,9,0.44)] transition-[width] duration-300 ease-out',
          isCollapsed && 'cursor-pointer',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 top-0 h-72 w-84 bg-[#2c9a73]/20 blur-3xl" />
          <div className="absolute -right-24 top-28 h-80 w-88 bg-[#31b8a2]/14 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-52 w-72 bg-[#6d8f49]/12 blur-3xl" />
          <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-[#c6a277]/30 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          <div
            className={cn(
              'relative flex items-center border-b border-[#c6a277]/26 shadow-[0_1px_0_rgba(242,245,234,0.06)]',
              isCollapsed ? 'h-18 justify-center px-2.5' : 'h-16 px-4'
            )}
          >
            <div className={cn('w-full', isCollapsed ? 'flex justify-center' : 'flex items-center gap-3 pr-8')}>
              <div className={cn('flex shrink-0', isCollapsed ? 'justify-center' : 'justify-start')}>
                <div
                  className={cn(
                    'relative shrink-0 overflow-hidden',
                    isCollapsed ? 'h-14 w-14 rounded-lg' : 'h-21 w-21 rounded-xl'
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
                    className="h-8 w-px shrink-0 bg-linear-to-b from-[#b99372]/18 via-[#edf0e2]/55 to-[#b99372]/18"
                  />
                  <div className="min-w-0">
                    <p className="text-[#d3dcc8] text-[11.5px] font-semibold tracking-widest uppercase leading-tight break-keep">
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
                className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#aab89d] transition-colors hover:bg-[#edf0e2]/9 hover:text-[#edf0e2]"
                aria-label="Recolher menu lateral"
                title="Recolher menu lateral"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          <nav className={cn('flex-1 overflow-y-auto py-4', isCollapsed ? 'px-2' : 'px-3', 'space-y-4')}>
            {MODULE_MENU_SECTIONS.map(({ label, itemKeys }) => {
              // Hide entire section if no items are visible
              const hasVisibleItem = modulePermissionsLoaded && itemKeys.some((key) => {
                const mk = key as ModuleKey
                if (mk === 'integracoes' && !canAccessIntegrations) return false
                return modulePermissions[mk] !== false
              })
              if (!hasVisibleItem) return null

              return (
              <div key={label}>
                {!isCollapsed ? (
                  <p className="text-[10px] font-semibold text-[#8fa084] uppercase tracking-wider px-3 mb-1">{label}</p>
                ) : (
                  <div className="mx-2 mb-2 h-px bg-[#2c5840]" />
                )}

                <div className="space-y-0.5">
                  {itemKeys.map((itemKey) => {
                    const moduleKey = itemKey as ModuleKey
                    if (moduleKey === 'integracoes' && !canAccessIntegrations) return null

                    // Hide modules until permissions are loaded, then hide disabled ones
                    if (!modulePermissionsLoaded) return null
                    if (modulePermissions[moduleKey] === false) return null

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

                    if (moduleKey === 'logistica') {
                      const isFaturamentoActive = pathname === '/previsao'
                      return (
                        <div key={moduleKey} className="space-y-0.5">
                          {renderMenuItem('logistica', {
                            expandable: true,
                            expanded: isLogisticaExpanded,
                            onToggleExpand: () => setIsLogisticaExpanded((prev) => !prev),
                          })}
                          {!isCollapsed && isLogisticaExpanded && (
                            <Link
                              href="/previsao"
                              className={cn(
                                'group w-full flex items-center gap-3 pl-8 pr-3 py-2.5 rounded-lg ring-1 ring-transparent transition-all duration-300 cursor-pointer text-left',
                                isFaturamentoActive
                                  ? 'ring-[#3de0af]/35 bg-linear-to-r from-[#0f7f5b] via-[#14966f] to-[#1da88d] text-[#f2f5ea] shadow-[inset_0_1px_0_rgba(242,245,234,0.22),0_12px_26px_rgba(10,71,50,0.42)]'
                                  : 'text-[#bac8b0] hover:ring-[#c6a277]/24 hover:bg-linear-to-r hover:from-[#0f7f5b]/22 hover:via-[#14966f]/14 hover:to-[#1da88d]/10 hover:text-[#f2f5ea] hover:shadow-[inset_0_1px_0_rgba(242,245,234,0.08),0_8px_18px_rgba(8,17,12,0.26)]'
                              )}
                            >
                              <ClipboardList className={cn(
                                'w-4 h-4 shrink-0 transition-all duration-300',
                                isFaturamentoActive
                                  ? 'text-[#edf0e2] drop-shadow-[0_1px_6px_rgba(18,167,109,0.35)]'
                                  : 'text-[#aac0a2] group-hover:text-[#dce6d2] group-hover:drop-shadow-[0_1px_4px_rgba(134,182,75,0.28)]'
                              )} />
                              <span className={cn(
                                'flex-1 min-w-0 truncate text-sm font-medium transition-colors',
                                isFaturamentoActive ? 'text-[#edf0e2]' : 'text-[#c6d3bb] group-hover:text-[#edf0e2]'
                              )}>Previsão de Pedidos</span>
                            </Link>
                          )}
                        </div>
                      )
                    }

                    return renderMenuItem(moduleKey)
                  })}
                </div>
              </div>
              )
            })}
          </nav>

          <div className={cn('border-t border-[#b99372]/20 shadow-[inset_0_1px_0_rgba(237,240,226,0.04)]', isCollapsed ? 'p-2' : 'p-3')}>
            {isCollapsed ? (
              <div className="flex h-8 items-center justify-center rounded-lg text-[#8fa084]">
                <PanelLeftClose className="h-4 w-4" />
              </div>
            ) : (
              <>
                <p className="text-[#9eb09a] text-[11px] text-center font-semibold tracking-wide uppercase">
                  SISTEMA OURO VERDE {'\u00A9'} 2026
                </p>
                <p className="text-[#7f8f7b] text-[11px] text-center mt-1">Vers{'\u00E3'}o v{appVersion}</p>
              </>
            )}
          </div>
        </div>
      </aside>

      {showDevModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-surface-950/60 backdrop-blur-[2px] p-4"
          onClick={closeDevelopmentModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-linear-to-r from-surface-900 via-surface-800 to-primary-900 px-5 py-4 text-white">
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
