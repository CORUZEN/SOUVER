import Image from 'next/image'
import { AlertTriangle, Loader2, LogOut } from 'lucide-react'

type PwaLogoutConfirmDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
}

export function PwaLogoutConfirmDialog({ open, onCancel, onConfirm, busy = false }: PwaLogoutConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-surface-950/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-surface-700/70 bg-surface-900 p-4 shadow-2xl shadow-black/45">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-500/15 p-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Sair do sistema?</p>
            <p className="mt-1 text-xs leading-relaxed text-surface-300">
              Ao confirmar, sua sessão será encerrada e os dados locais serão limpos neste dispositivo.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-surface-700 bg-surface-800/80 px-3 py-2 text-xs font-semibold text-surface-200 transition hover:bg-surface-700/80 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Confirmar saída
          </button>
        </div>
      </div>
    </div>
  )
}

type PwaSigningOutOverlayProps = {
  visible: boolean
}

export function PwaSigningOutOverlay({ visible }: PwaSigningOutOverlayProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-surface-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.16),transparent_44%),radial-gradient(circle_at_84%_80%,rgba(34,197,94,0.12),transparent_46%)]" />
      <div className="relative flex w-[88%] max-w-sm flex-col items-center rounded-2xl border border-emerald-500/20 bg-surface-900/80 px-6 py-8 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="relative h-20 w-20">
          <Image src="/branding/ouroverde.png" alt="Ouro Verde" fill sizes="80px" className="object-contain" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-emerald-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm font-semibold uppercase tracking-[0.08em]">Saindo do sistema</p>
        </div>
        <p className="mt-2 text-center text-xs text-surface-300">Finalizando sessão com segurança...</p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-800/90 ring-1 ring-emerald-500/25">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-lime-300" />
        </div>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-surface-400">
          <LogOut className="h-3.5 w-3.5" />
          Redirecionando para o login
        </div>
      </div>
    </div>
  )
}
