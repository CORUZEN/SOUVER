import type { Metadata } from 'next'
import Image from 'next/image'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Acesso ao Sistema',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">

      {/* Header — logos */}
      <div className="flex flex-col items-center px-6 pb-6 pt-12">
        <div className="flex items-center justify-center gap-5">
          <div className="relative h-14 w-28">
            <Image src="/branding/ouroverde.webp" alt="Ouro Verde" fill priority sizes="112px" className="object-contain" />
          </div>
          <div className="h-10 w-px bg-white/20" />
          <div className="relative h-14 w-28">
            <Image src="/branding/graoverde.webp" alt="Grão Verde" fill priority sizes="112px" className="object-contain" />
          </div>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-white/40">
          Sistema Corporativo
        </p>
      </div>

      {/* Form card */}
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
        <div className="flex flex-col rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-[0_4px_24px_rgba(0,0,0,0.30),0_1px_6px_rgba(0,0,0,0.18)] backdrop-blur-xl">

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Boas vindas,
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Acesse sua conta para continuar
            </p>
          </div>

          <LoginForm />

          <div className="mt-8" />

          <div className="flex justify-center">
            <p className="text-[10px] text-white/20">
              Desenvolvido por Jucélio Verissimo
            </p>
          </div>
        </div>
      </div>

      <div className="h-6 shrink-0" />
    </div>
  )
}
