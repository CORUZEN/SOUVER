'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
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
  ChevronRight,
  Building2,
  Plug,
  DollarSign,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Módulos',
    items: [
      { label: 'Painel Executivo', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Produção', href: '/producao', icon: Factory },
      { label: 'Logística', href: '/logistica', icon: Truck },
      { label: 'Qualidade', href: '/qualidade', icon: ShieldCheck },
      { label: 'Recursos Humanos', href: '/rh', icon: Users },
      { label: 'Relatórios', href: '/relatorios', icon: FileBarChart2 },
      { label: 'Contabilidade', href: '/contabilidade', icon: DollarSign },
      { label: 'Comunicação', href: '/comunicacao', icon: MessageSquare },
      { label: 'Integrações', href: '/integracoes', icon: Plug },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Usuários',        href: '/usuarios',       icon: UserCog     },
      { label: 'Departamentos',   href: '/departamentos',  icon: Building2   },
      { label: 'Auditoria',       href: '/auditoria',      icon: ClipboardList },
      { label: 'Configurações',   href: '/configuracoes',  icon: Settings    },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 bg-surface-900 flex flex-col h-full">
      {/* Logotipo */}
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
          <p className="text-white text-sm font-semibold truncate leading-tight">
            Ouro Verde
          </p>
          <p className="text-surface-400 text-xs truncate">Sistema Corporativo</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-3 mb-1">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ label: itemLabel, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-primary-600 text-white'
                        : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{itemLabel}</span>
                    {active && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="p-3 border-t border-surface-700/50">
        <p className="text-surface-600 text-xs text-center">
          SOUVER v1.0.0
        </p>
      </div>
    </aside>
  )
}
