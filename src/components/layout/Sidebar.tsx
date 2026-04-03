'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { MODULE_MENU_SECTIONS, MODULE_PLANS } from '@/lib/development-modules'
import {
  LayoutDashboard,
  Factory,
  Truck,
  ShieldCheck,
  Users,
  FileBarChart2,
  MessageSquare,
  Settings,
  ClipboardList,
  UserCog,
  Building2,
  Plug,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Construction,
  X,
  type LucideIcon,
} from 'lucide-react'

type ModuleKey = keyof typeof MODULE_PLANS

const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  'painel-executivo': LayoutDashboard,
  producao: Factory,
  logistica: Truck,
  qualidade: ShieldCheck,
  rh: Users,
  relatorios: FileBarChart2,
  contabilidade: DollarSign,
  comunicacao: MessageSquare,
  integracoes: Plug,
  usuarios: UserCog,
  departamentos: Building2,
  auditoria: ClipboardList,
  analytics: BarChart3,
  configuracoes: Settings,
}

const DEFAULT_MODULE: ModuleKey = 'painel-executivo'
const EXECUTIVE_ROUTE = '/em-desenvolvimento?modulo=painel-executivo'

interface SidebarProps {
  appVersion: string
}

export default function Sidebar({ appVersion }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showDevModal, setShowDevModal] = useState(false)
  const [devTargetLabel, setDevTargetLabel] = useState('')
  const [isConfigExpanded, setIsConfigExpanded] = useState(false)

  const selectedModuloParam = searchParams.get('modulo')
  const isExecutiveScreen =
    pathname === '/em-desenvolvimento' &&
    (!selectedModuloParam || selectedModuloParam === 'painel-executivo')

  const sectionKeys = useMemo(() => {
    return MODULE_MENU_SECTIONS.map((section) => ({
      ...section,
      itemKeys: section.itemKeys.filter((itemKey) => itemKey !== 'integracoes'),
    }))
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

  function handleConfigClick() {
    setIsConfigExpanded((prev) => !prev)
    openDevelopmentModal(MODULE_PLANS.configuracoes.label)
  }

  function toggleConfigOnly() {
    setIsConfigExpanded((prev) => !prev)
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

  function renderStandardItem(moduleKey: ModuleKey, isSubmenu = false) {
    const modulePlan = MODULE_PLANS[moduleKey]
    const Icon = MODULE_ICONS[moduleKey]
    const isActive = moduleKey === 'painel-executivo' ? isExecutiveScreen : false

    const baseClass = cn(
      'w-full flex items-center gap-3 rounded-lg transition-all duration-150 cursor-pointer text-left',
      isSubmenu ? 'pl-10 pr-3 py-2' : 'px-3 py-2.5',
      isActive
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-surface-400 hover:bg-surface-800 hover:text-white'
    )

    if (moduleKey === 'painel-executivo') {
      return (
        <Link
          key={moduleKey}
          href={EXECUTIVE_ROUTE}
          className={baseClass}
        >
          <Icon className={cn('shrink-0', isSubmenu ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          <span className={cn('flex-1 min-w-0 truncate font-medium', isSubmenu ? 'text-xs' : 'text-sm')}>
            {modulePlan.label}
          </span>
          <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
            (Em breve)
          </span>
        </Link>
      )
    }

    return (
      <button key={moduleKey} type="button" onClick={() => handleUnavailableClick(moduleKey)} className={baseClass}>
        <Icon className={cn('shrink-0', isSubmenu ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        <span className={cn('flex-1 min-w-0 truncate font-medium', isSubmenu ? 'text-xs' : 'text-sm')}>
          {modulePlan.label}
        </span>
        <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
          (Em breve)
        </span>
      </button>
    )
  }

  function renderConfigItem() {
    const Icon = MODULE_ICONS.configuracoes
    const isActive = false

    return (
      <button
        key="configuracoes"
        type="button"
        onClick={handleConfigClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer text-left',
          isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-surface-400 hover:bg-surface-800 hover:text-white'
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{MODULE_PLANS.configuracoes.label}</span>
        <span className={cn('shrink-0 text-[11px] font-medium', isActive ? 'text-white/85' : 'text-surface-500')}>
          (Em breve)
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation()
            toggleConfigOnly()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              toggleConfigOnly()
            }
          }}
          className={cn(
            'ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors',
            isActive ? 'hover:bg-white/15' : 'hover:bg-surface-700'
          )}
          aria-label={isConfigExpanded ? 'Recolher submenu' : 'Expandir submenu'}
        >
          {isConfigExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
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
          {sectionKeys.map(({ label, itemKeys }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-3 mb-1">
                {label}
              </p>
              <div className="space-y-0.5">
                {itemKeys.map((itemKey) => {
                  const moduleKey = itemKey as ModuleKey
                  if (moduleKey === 'configuracoes') {
                    return (
                      <div key={moduleKey} className="space-y-0.5">
                        {renderConfigItem()}
                        {isConfigExpanded && renderStandardItem('integracoes', true)}
                      </div>
                    )
                  }

                  return renderStandardItem(moduleKey)
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
                Esta funcionalidade est{'\u00E1'} em planejamento t{'\u00E9'}cnico e ser{'\u00E1'} liberada em breve
                no padr{'\u00E3'}o corporativo do Sistema Ouro Verde.
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
