'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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

interface SidebarProps {
  appVersion: string
}

export default function Sidebar({ appVersion }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const selectedModuleParam = searchParams.get('modulo')
  const selectedModule = (
    selectedModuleParam && selectedModuleParam in MODULE_PLANS
      ? selectedModuleParam
      : DEFAULT_MODULE
  ) as ModuleKey
  const inDevelopmentPage = pathname === '/em-desenvolvimento'

  return (
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
                const key = itemKey as ModuleKey
                const modulePlan = MODULE_PLANS[key]
                const Icon = MODULE_ICONS[key]
                const href = `/em-desenvolvimento?modulo=${key}`
                const isActive = mounted && inDevelopmentPage && selectedModule === key

                return (
                  <Link
                    key={key}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-sm font-medium">
                      {modulePlan.label}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-medium',
                        isActive ? 'text-white/85' : 'text-surface-500'
                      )}
                    >
                      (Em breve)
                    </span>
                  </Link>
                )
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
  )
}
