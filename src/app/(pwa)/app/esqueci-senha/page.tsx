'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Mail, ArrowLeft, CheckCircle2, Copy } from 'lucide-react'

export default function PwaForgotPasswordPage() {
  const [login, setLogin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devUrl, setDevUrl] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!login.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao processar pedido.'); return }
      setSent(true)
      if (data._dev?.resetUrl) setDevUrl(data._dev.resetUrl)
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header — logos ──────────────────────────────────────── */}
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

      {/* ── Form card ───────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
        <div className="flex flex-col rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-[0_4px_24px_rgba(0,0,0,0.30),0_1px_6px_rgba(0,0,0,0.18)] backdrop-blur-xl">

          {sent ? (
            /* ── Success state ────────────────────────────────── */
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-white">Link enviado</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                    Se o cadastro existir, um link de redefinição foi enviado para o e-mail vinculado à conta.
                  </p>
                </div>

                {devUrl && (
                  <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-left">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">
                      Ambiente dev — link gerado
                    </p>
                    <div className="flex items-start gap-2">
                      <code className="flex-1 break-all text-[11px] text-amber-300/80">{devUrl}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(devUrl)}
                        className="shrink-0 rounded-lg p-1.5 text-amber-400/60 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                        title="Copiar"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <a href={devUrl} className="mt-2 block text-[11px] text-emerald-400 hover:underline">
                      Clique aqui para redefinir →
                    </a>
                  </div>
                )}
              </div>

              <a
                href="/app/login"
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/8"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </a>
            </>
          ) : (
            /* ── Form state ───────────────────────────────────── */
            <>
              {/* Title */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Recuperar acesso
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Informe seu login ou e-mail para receber o link de redefinição de senha.
                </p>
              </div>

              {/* Field */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Login ou E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="seu.login ou e-mail"
                    value={login}
                    onChange={(e) => { setLogin(e.target.value); setError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                    className="pwa-input h-11 w-full rounded-xl border border-white/10 bg-white/6 pl-10 pr-4 text-[14px] font-light text-white/90 placeholder:text-white/20 transition-colors focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
                {error && <p className="text-[11px] text-rose-400">{error}</p>}
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!login.trim() || loading}
                className="mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar link de redefinição
                  </>
                )}
              </button>

              {/* Back link — logo abaixo do botão */}
              <div className="mt-4 flex flex-col items-center gap-3">
                <a
                  href="/app/login"
                  className="flex items-center gap-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </a>
              </div>

              <div className="mt-8" />

              <p className="text-center text-[10px] text-white/20">
                Desenvolvido por Jucélio Verissimo
              </p>
            </>
          )}
        </div>
      </div>

      <div className="h-6 shrink-0" />
    </div>
  )
}
