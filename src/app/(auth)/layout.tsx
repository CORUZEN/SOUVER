import { BarChart3, Factory, ShieldCheck } from 'lucide-react'
import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const leftPanelBackgroundImage =
  process.env.NEXT_PUBLIC_AUTH_LEFT_BG_IMAGE ?? '/images/auth-enterprise-bg.svg'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={cn(manrope.className, 'relative h-dvh overflow-hidden bg-[#08142a]')}>
      <div className="pointer-events-none absolute left-[-20%] top-[-20%] h-144 w-xl rounded-full bg-emerald-400/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-26%] right-[-12%] h-120 w-120 rounded-full bg-cyan-400/10 blur-[110px]" />

      <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="mx-auto flex min-h-full w-full max-w-360 items-center">
          <div className="grid w-full overflow-hidden rounded-[28px] border border-white/20 bg-white/6 shadow-[0_24px_70px_rgba(2,8,23,0.45)] backdrop-blur-md lg:grid-cols-[1.08fr_0.92fr]">
            <section className="order-2 relative min-h-90 overflow-hidden lg:order-1">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(140deg, rgba(4, 14, 32, 0.88), rgba(6, 78, 59, 0.68)), url("${leftPanelBackgroundImage}")`,
                }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_52%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.24),transparent_45%)]" />

              <div className="relative z-10 flex h-full flex-col justify-between p-7 text-white sm:p-10 lg:p-10 xl:p-12">
                <div className="animate-[authFadeUp_650ms_ease-out]">
                  <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-xl">
                    Sistema Ouro Verde
                  </div>
                  <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
                    Plataforma empresarial com acesso seguro e operação integrada.
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/82 sm:text-base">
                    Gerencie produção, auditoria, pessoas e indicadores em uma única experiência
                    corporativa.
                  </p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:mt-8 lg:grid-cols-1">
                  <article className="animate-[authFadeUp_760ms_ease-out] rounded-2xl border border-white/30 bg-white/12 p-4 backdrop-blur-xl [animation-fill-mode:both]">
                    <div className="mb-2 inline-flex rounded-lg bg-white/20 p-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-100" />
                    </div>
                    <p className="text-sm font-semibold text-white">Conformidade e segurança</p>
                    <p className="mt-1 text-xs text-white/75">
                      Controle de acesso, trilhas de auditoria e proteção para dados sensíveis.
                    </p>
                  </article>

                  <article className="animate-[authFadeUp_900ms_ease-out] rounded-2xl border border-white/30 bg-white/12 p-4 backdrop-blur-xl [animation-fill-mode:both]">
                    <div className="mb-2 inline-flex rounded-lg bg-white/20 p-2">
                      <BarChart3 className="h-4 w-4 text-cyan-100" />
                    </div>
                    <p className="text-sm font-semibold text-white">Indicadores em tempo real</p>
                    <p className="mt-1 text-xs text-white/75">
                      Decisões mais rápidas com dashboards executivos e visão consolidada.
                    </p>
                  </article>

                  <article className="animate-[authFadeUp_1040ms_ease-out] rounded-2xl border border-white/30 bg-white/12 p-4 backdrop-blur-xl [animation-fill-mode:both] sm:col-span-2 lg:col-span-1">
                    <div className="mb-2 inline-flex rounded-lg bg-white/20 p-2">
                      <Factory className="h-4 w-4 text-emerald-100" />
                    </div>
                    <p className="text-sm font-semibold text-white">Operação industrial conectada</p>
                    <p className="mt-1 text-xs text-white/75">
                      Padronização entre plantas, equipes e processos de ponta a ponta.
                    </p>
                  </article>
                </div>
              </div>
            </section>

            <section className="order-1 relative flex items-center justify-center bg-white/92 px-6 py-8 sm:px-10 sm:py-10 lg:order-2 lg:px-10 lg:py-10 xl:px-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_86%_92%,rgba(6,182,212,0.12),transparent_40%)]" />
              <div className="relative z-10 w-full max-w-md animate-[authFadeUp_580ms_ease-out]">
                {children}
                <p className="mt-8 text-center text-xs text-slate-500">
                  Sistema Ouro Verde © {new Date().getFullYear()}. Todos os direitos reservados.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
