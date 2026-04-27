'use client'

import { X, ExternalLink } from 'lucide-react'
import { APP_VERSION_LABEL } from '@/generated/app-version'

interface AboutSystemModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutSystemModal({ isOpen, onClose }: AboutSystemModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl border border-emerald-500/15 bg-[#0f1f14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Sobre o sistema</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-surface-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="my-4 h-px w-full bg-emerald-500/10" />

        {/* Info rows */}
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Software</p>
            <p className="mt-0.5 text-[13px] font-semibold text-white">Sistema Ouro Verde</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Versão</p>
            <p className="mt-0.5 text-[13px] font-semibold text-emerald-300">{APP_VERSION_LABEL}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Desenvolvedor</p>
            <div className="mt-0.5 flex flex-col">
              <a
                href="https://instagram.com/jucelio.verissimo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-white hover:text-emerald-300 transition-colors"
              >
                Jucélio Verissimo
                <ExternalLink className="h-3 w-3 text-surface-500" />
              </a>
              <a
                href="https://coruzen.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-white hover:text-emerald-300 transition-colors"
              >
                Coruzen
                <ExternalLink className="h-3 w-3 text-surface-500" />
              </a>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Propriedade Intelectual</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-surface-400">
              Este software é de propriedade exclusiva do Café Ouro Verde. Todo o código-fonte, arquitetura, design e funcionalidades foram desenvolvidos sob medida para atender às demandas operacionais, gerenciais e estratégicas da empresa, sendo vedada a reprodução, distribuição ou uso não autorizado.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 h-px w-full bg-emerald-500/10" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-emerald-500/15 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/25 active:scale-95 transition-all"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
