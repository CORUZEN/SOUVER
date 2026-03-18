'use client'

import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Header() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 shrink-0">
      {/* Título da área atual — dinâmico futuramente via contexto */}
      <div>
        <p className="text-sm font-semibold text-surface-900">
          Fábrica Café Ouro Verde
        </p>
        <p className="text-xs text-surface-500">Sistema de Gestão Corporativa</p>
      </div>

      {/* Ações do header */}
      <div className="flex items-center gap-2">
        {/* Notificações */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-4.5 h-4.5" />
          {/* Badge de notificação não lida */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
        </button>

        {/* Perfil do usuário */}
        <div className="flex items-center gap-2 pl-2 border-l border-surface-200">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            U
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-surface-900 leading-tight">
              Usuário
            </p>
            <p className="text-xs text-surface-500 leading-tight">
              Administrador
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-surface-400 hidden sm:block" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-surface-500 hover:bg-red-50 hover:text-red-600 transition-colors ml-1"
          aria-label="Sair do sistema"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
