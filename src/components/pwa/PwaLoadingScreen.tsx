import Image from 'next/image'

type PwaLoadingScreenProps = {
  label?: string
  progress?: number | null
}

export default function PwaLoadingScreen({ label = 'Preparando painel...', progress = null }: PwaLoadingScreenProps) {
  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_84%_80%,rgba(34,197,94,0.12),transparent_44%)]" />

      <div className="relative w-[86%] max-w-sm">
        <div className="mx-auto mb-6 h-32 w-32">
          <div className="relative h-full w-full">
            <Image src="/branding/ouroverde.png" alt="Ouro Verde" fill sizes="128px" className="object-contain" />
          </div>
        </div>

        <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-[0.09em] text-emerald-300/90">{label}</p>

        {progressValue !== null && (
          <>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-800/90 ring-1 ring-emerald-500/25">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-lime-300 transition-[width] duration-500 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold tabular-nums text-emerald-200">{progressValue}%</p>
          </>
        )}
      </div>
    </div>
  )
}
