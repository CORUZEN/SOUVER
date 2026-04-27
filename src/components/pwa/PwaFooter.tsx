'use client'

import { useState } from 'react'
import { APP_VERSION_LABEL } from '@/generated/app-version'
import AboutSystemModal from './AboutSystemModal'

export default function PwaFooter() {
  const [showVersionInfo, setShowVersionInfo] = useState(false)

  return (
    <>
      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-1 pb-6">
        <div className="h-px w-12 bg-emerald-500/15" />
        <p className="mt-3 text-[11px] font-semibold tracking-wide text-surface-400 uppercase">
          Sistema Ouro Verde © 2026
        </p>
        <button
          type="button"
          onClick={() => setShowVersionInfo(true)}
          className="text-[10px] text-surface-600 hover:text-emerald-400 transition-colors"
        >
          Versão {APP_VERSION_LABEL}
        </button>
      </div>

      <AboutSystemModal isOpen={showVersionInfo} onClose={() => setShowVersionInfo(false)} />
    </>
  )
}
