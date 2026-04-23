import Image from 'next/image'
import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'
import PwaInstallBanner from '@/components/ui/PwaInstallBanner'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className={cn(manrope.className, 'relative h-dvh overflow-hidden bg-[#08142a]')}>
      <div className="pointer-events-none absolute left-[-20%] top-[-20%] h-144 w-xl rounded-full bg-emerald-400/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-26%] right-[-12%] h-120 w-120 rounded-full bg-cyan-400/10 blur-[110px]" />

      <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="mx-auto flex min-h-full w-full max-w-360 items-center">
          <div className="grid w-full overflow-hidden rounded-[28px] border border-white/20 bg-white/6 shadow-[0_24px_70px_rgba(2,8,23,0.45)] backdrop-blur-md lg:grid-cols-[1.08fr_0.92fr]">
            <section className="order-2 relative min-h-90 overflow-hidden lg:order-1">
              <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(4,14,32,0.9),rgba(6,78,59,0.72))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_52%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.24),transparent_45%)]" />

              <div className="relative z-10 flex h-full items-center justify-center p-7 sm:p-10 lg:p-10 xl:p-12">
                <div className="w-full max-w-2xl space-y-6">
                  <div className="animate-[authFadeUp_620ms_ease-out] rounded-3xl border border-white/30 bg-white/12 p-5 shadow-[0_12px_40px_rgba(2,8,23,0.35)] backdrop-blur-xl sm:p-6">
                    <div className="relative h-36 w-full sm:h-40">
                      <Image
                        src="/branding/graoverde.png"
                        alt="Logo Grão Verde"
                        fill
                        priority
                        sizes="(max-width: 640px) 80vw, 520px"
                        className="object-contain"
                      />
                    </div>
                  </div>

                  <div className="animate-[authFadeUp_760ms_ease-out] rounded-3xl border border-white/30 bg-white/12 p-5 shadow-[0_12px_40px_rgba(2,8,23,0.35)] backdrop-blur-xl sm:p-6 [animation-fill-mode:both]">
                    <div className="relative h-36 w-full sm:h-40">
                      <Image
                        src="/branding/ouroverde.png"
                        alt="Logo Ouro Verde"
                        fill
                        priority
                        sizes="(max-width: 640px) 80vw, 520px"
                        className="object-contain"
                      />
                    </div>
                  </div>
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
      <PwaInstallBanner />
    </>
  )
}
