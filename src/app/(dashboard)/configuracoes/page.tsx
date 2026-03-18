'use client'

import Link from 'next/link'
import { Settings, ShieldCheck, Users, KeyRound, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const SETTINGS_CARDS = [
  {
    icon: User,
    title: 'Meu Perfil',
    description: 'Altere seu nome, telefone e senha de acesso.',
    href: '/configuracoes/perfil',
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    available: false,
  },
  {
    icon: KeyRound,
    title: 'Autenticação de Dois Fatores',
    description: 'Adicione uma camada extra de segurança com TOTP (Google Authenticator, Authy).',
    href: '/configuracoes/2fa',
    color: 'text-green-600',
    bg: 'bg-green-50',
    available: true,
  },
  {
    icon: Users,
    title: 'Perfis de Acesso',
    description: 'Visualize os perfis e suas permissões no sistema.',
    href: '/configuracoes/perfis',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    available: false,
  },
  {
    icon: ShieldCheck,
    title: 'Trilha de Auditoria',
    description: 'Acesse o histórico completo de ações realizadas no sistema.',
    href: '/auditoria',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    available: true,
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-600" />
          Configurações
        </h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Gerencie suas preferências e configurações do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_CARDS.map(({ icon: Icon, title, description, href, color, bg, available }) => (
          available ? (
            <Link key={title} href={href} className="block group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 group-hover:text-primary-700 transition-colors">
                      {title}
                    </p>
                    <p className="text-xs text-surface-500 mt-1 leading-relaxed">{description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <div key={title} className="opacity-50 cursor-not-allowed">
              <Card className="h-full">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900">{title}</p>
                    <p className="text-xs text-surface-500 mt-1 leading-relaxed">{description}</p>
                    <span className="inline-block mt-2 text-xs bg-surface-100 text-surface-500 rounded px-2 py-0.5">
                      Em breve
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
