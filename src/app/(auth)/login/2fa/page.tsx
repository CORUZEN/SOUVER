import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import LoginTwoFactorForm from '@/components/auth/LoginTwoFactorForm'

export const metadata: Metadata = {
  title: 'Verificação em duas etapas',
}

export default function LoginTwoFactorPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verificação adicional
        </div>

        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
            Autenticação em dois fatores obrigatória
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Para continuar no sistema, informe o código de 6 dígitos do aplicativo autenticador
            ou um código de recuperação válido.
          </p>
        </div>
      </header>

      <LoginTwoFactorForm />
    </div>
  )
}
