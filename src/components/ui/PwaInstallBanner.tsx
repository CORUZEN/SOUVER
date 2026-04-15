'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, Download, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'ov-pwa-banner-dismissed'

export default function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return
    // Only on mobile-width devices
    if (window.innerWidth >= 768) return

    // Detect iOS (no beforeinstallprompt support — different instructions needed)
    const ua = navigator.userAgent
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream
    if (iosDevice) {
      setIsIos(true)
      setShow(true)
      return
    }

    // Android / Chrome: listen for the native prompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  async function install() {
    if (!promptEvent) return
    setInstalling(true)
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') {
        setShow(false)
      }
    } finally {
      setInstalling(false)
    }
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instalar aplicativo Ouro Verde"
        className="fixed bottom-0 left-0 right-0 z-[91] animate-[slideUp_300ms_cubic-bezier(0.16,1,0.3,1)] rounded-t-[24px] border-t border-white/10 bg-[#0f172a] px-6 pb-8 pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      >
        {/* Handle bar */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* App identity */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border border-white/15 bg-[#0c1f14] shadow-lg">
            <Image
              src="/branding/ouroverde-badge.png"
              alt="Ouro Verde"
              fill
              sizes="64px"
              className="object-contain p-1"
            />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-white">Ouro Verde</p>
            <p className="text-xs text-emerald-400 font-medium">Sistema Empresarial</p>
            <div className="mt-1 flex items-center gap-1">
              <Smartphone className="h-3 w-3 text-white/30" />
              <span className="text-[11px] text-white/40">Instale na sua tela inicial</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Acesse metas, pedidos e indicadores de forma rápida — mesmo sem sinal. Sem precisar abrir o navegador.
        </p>

        {/* Features chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {['Funciona offline', 'Acesso rápido', 'Sem navegador'].map((f) => (
            <span
              key={f}
              className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400"
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        {isIos ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/80">Como instalar no iPhone / iPad:</p>
            <ol className="mt-2 space-y-1.5 text-xs text-white/55 list-decimal list-inside">
              <li>Toque no botão <strong className="text-white/75">Compartilhar</strong> no Safari <span className="text-base leading-none">⎋</span></li>
              <li>Role e toque em <strong className="text-white/75">"Adicionar à Tela de Início"</strong></li>
              <li>Confirme tocando em <strong className="text-white/75">Adicionar</strong></li>
            </ol>
          </div>
        ) : (
          <button
            type="button"
            onClick={install}
            disabled={installing}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-60"
          >
            {installing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {installing ? 'Instalando…' : 'Instalar App'}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full py-2 text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          Agora não
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
