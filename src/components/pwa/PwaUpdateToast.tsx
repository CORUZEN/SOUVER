'use client'

import { usePwaUpdate } from '@/lib/client/hooks/use-pwa-update'
import { RefreshCw, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function PwaUpdateToast() {
  const { hasUpdate, applyUpdate } = usePwaUpdate()
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (hasUpdate && !dismissed) {
      // Small delay to avoid flashing on initial load
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [hasUpdate, dismissed])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-900/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
          <RefreshCw size={18} className="text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-50">Nova versão disponível</p>
          <p className="text-xs text-emerald-200/80">Atualize para obter as correções mais recentes.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDismissed(true)
              setVisible(false)
            }}
            className="rounded-lg p-2 text-emerald-300/70 hover:bg-emerald-800/60 hover:text-emerald-100 transition-colors"
            aria-label="Dispensar"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  )
}
