'use client'

import Link from 'next/link'
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

function getModuleRoute(moduleKey: ModuleKey): string {
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

  const selectedModuloParam = searchParams.get('modulo')
  const activeAccessibleModule: ModuleKey | null =
    pathname !== '/em-desenvolvimento'
      ? null
      : selectedModuloParam && ACCESSIBLE_MODULES.includes(selectedModuloParam as ModuleKey)
        ? (selectedModuloParam as ModuleKey)
        : DEFAULT_MODULE

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
    const isActive = ACCESSIBLE_MODULES.includes(moduleKey) && activeAccessibleModule === moduleKey
    const badgeLabel = moduleKey === 'metas' ? '(Em desenvolvimento)' : '(Em breve)'

    const baseClass = cn(
      'w-full flex items-center gap-3 rounded-lg transition-all duration-150 cursor-pointer text-left',
      isSubmenu ? 'pl-8 pr-3 py-2.5' : 'px-3 py-2.5',
      isActive
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-surface-400 hover:bg-surface-800 hover:text-white'
    )

    if (ACCESSIBLE_MODULES.includes(moduleKey)) {
      return (
        <Link key={moduleKey} href={getModuleRoute(moduleKey)} className={baseClass}>
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate text-sm font-medium">
            {modulePlan.label}
          </span>
          <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
            {badgeLabel}
          </span>
        </Link>
      )
    }

    return (
      <button key={moduleKey} type="button" onClick={() => handleUnavailableClick(moduleKey)} className={baseClass}>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm font-medium">
          {modulePlan.label}
        </span>
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
      </button>
    )
  }

  return (
    <>
      <aside className="w-64 shrink-0 bg-surface-900 flex flex-col h-full">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-surface-700/50">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
            <svg
              className="w-4.5 h-4.5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-semibold truncate leading-tight">Ouro Verde</p>
            <p className="text-surface-400 text-xs truncate">Sistema Corporativo</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {MODULE_MENU_SECTIONS.map(({ label, itemKeys }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-3 mb-1">
                {label}
              </p>
              <div className="space-y-0.5">
                {itemKeys.map((itemKey) => {
                  const moduleKey = itemKey as ModuleKey

                  if (moduleKey === 'rh') {
                    return (
                      <div key={moduleKey} className="space-y-0.5">
                        {renderMenuItem('rh', {
                          expandable: true,
                          expanded: isRhExpanded,
                          onToggleExpand: () => setIsRhExpanded((prev) => !prev),
                        })}
                        {isRhExpanded && renderMenuItem('usuarios', { isSubmenu: true })}
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
                        {isReportsExpanded && renderMenuItem('auditoria', { isSubmenu: true })}
                      </div>
                    )
                  }

                  return renderMenuItem(moduleKey)
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-700/50">
          <p className="text-surface-500 text-[11px] text-center font-semibold tracking-wide uppercase">
            SISTEMA OURO VERDE {'\u00A9'} 2026
          </p>
          <p className="text-surface-600 text-[11px] text-center mt-1">
            Vers{'\u00E3'}o v{appVersion}
          </p>
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
