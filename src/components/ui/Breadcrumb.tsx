'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Painel Executivo',
  usuarios: 'Gestão de Usuários',
  producao: 'Produção',
  logistica: 'Logística',
  qualidade: 'Qualidade',
  rh: 'Recursos Humanos',
  relatorios: 'Relatórios',
  comunicacao: 'Comunicação',
  configuracoes: 'Configurações',
  perfis: 'Perfis de Acesso',
  '2fa': 'Autenticação de Dois Fatores',
  auditoria: 'Trilha de Auditoria',
  'acesso-negado': 'Acesso Negado',
  departamentos: 'Departamentos',
  perfil: 'Meu Perfil',
  perfis: 'Perfis de Acesso',
  sessoes: 'Sessões Ativas',
  integracoes: 'Integrações',
  contabilidade: 'Contabilidade',
  novo: 'Novo',
  editar: 'Editar',
}

export default function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
    const isLast = i === segments.length - 1
    return { href, label, isLast }
  })

  return (
    <nav aria-label="Navegação" className={cn('flex items-center gap-1 text-sm', className)}>
      <Link
        href="/dashboard"
        className="text-surface-400 hover:text-surface-700 transition-colors"
        aria-label="Início"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map(({ href, label, isLast }) => (
        <span key={href} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-surface-300" />
          {isLast ? (
            <span className="text-surface-700 font-medium">{label}</span>
          ) : (
            <Link href={href} className="text-surface-500 hover:text-surface-700 transition-colors">
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
