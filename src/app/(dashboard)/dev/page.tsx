'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Lock, Shield, Users, KeyRound } from 'lucide-react'
import { Spinner } from '@/components/ui/Skeleton'

interface CurrentUser {
  id: string
  roleCode?: string | null
}

export default function DevPage() {
  const [authLoaded, setAuthLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser({ id: d.user.id, roleCode: d.user.roleCode ?? null })
      })
      .finally(() => setAuthLoaded(true))
  }, [])

  const isDeveloper = currentUser?.roleCode === 'DEVELOPER'

  if (!authLoaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-surface-500">
        <Spinner />
        Validando acesso Dev...
      </div>
    )
  }

  if (!isDeveloper) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-700">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-surface-600">Esta página Dev é exclusiva do usuário Desenvolvedor.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Área Dev</p>
        <h1 className="mt-2 text-2xl font-semibold text-surface-900">Central do Desenvolvedor</h1>
        <p className="mt-2 max-w-3xl text-sm text-surface-600">
          Painel de governança técnica para administração de contas e controle de permissões do sistema empresarial.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Link
          href="/dev/gestao-usuarios"
          className="group rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
        >
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-surface-900">Gestão de Usuários</h2>
          <p className="mt-1 text-sm text-surface-600">Cadastro, edição, status, locação e ciclo de vida das contas.</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-700">
            Acessar seção
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/dev/gestao-permissoes"
          className="group rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
        >
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-surface-900">Gestão de Permissões</h2>
          <p className="mt-1 text-sm text-surface-600">Ajuste de permissões por grupo e atribuição de grupo por usuário.</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            Acessar seção
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <section className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600">
        <p className="inline-flex items-center gap-2 font-medium text-surface-700">
          <Shield className="h-4 w-4" />
          Uso restrito ao perfil Desenvolvedor.
        </p>
      </section>
    </div>
  )
}
