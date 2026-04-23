import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import LoginForm from '@/components/auth/LoginForm'
import MobileLoginDark from '@/components/auth/MobileLoginDark'

export const metadata: Metadata = {
  title: 'Acesso ao Sistema',
}

export default function LoginPage() {
  return (
    <>
      {/* Mobile: dark themed full-screen login (hidden on md+) */}
      <MobileLoginDark />

      {/* Desktop/tablet: standard web layout (hidden on mobile — dark overlay takes over) */}
      <div className="hidden space-y-8 md:block">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            SISTEMA OURO VERDE
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
              Boas-vindas, efetue o login!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Informe suas credenciais para entrar no sistema e continuar a operação.
            </p>
          </div>
        </header>

        <LoginForm />
      </div>
    </>
  )
}
