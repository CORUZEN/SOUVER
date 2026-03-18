'use client'

import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

interface UserInfo {
  name: string
  email: string
  role: string
  initials: string
}

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          const { name, email, role } = data.user
          const parts = (name as string).trim().split(' ')
          const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : (name as string).slice(0, 2).toUpperCase()
          setUser({ name, email, role: role?.name ?? role ?? 'Usuário', initials })
        }
      })
      .catch(() => null)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const displayName = user?.name ?? 'Usuário'
  const displayRole = user?.role ?? 'Carregando...'
  const initials = user?.initials ?? 'U'

  return (
    <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <p className="text-sm font-semibold text-surface-900">
          Fábrica Café Ouro Verde
        </p>
        <p className="text-xs text-surface-500">Sistema de Gestão Corporativa</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Notificações */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
        </button>

        {/* Perfil do usuário */}
        <div className="flex items-center gap-2 pl-2 border-l border-surface-200">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-surface-900 leading-tight">
              {displayName}
            </p>
            <p className="text-xs text-surface-500 leading-tight">
              {displayRole}
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
