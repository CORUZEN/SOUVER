'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react'
import { clearAuthMeCache } from '@/lib/client/auth-me-cache'

function normalizeToken(value: string) {
  return value.toUpperCase().replace(/\s+/g, '')
}

export default function PwaLoginTwoFactorPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const normalizedToken = useMemo(() => normalizeToken(token), [token])
  const canSubmit = normalizedToken.length >= 6

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || loading) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: normalizedToken }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.message ?? 'Não foi possível validar o código de segurança.')
        return
      }

      clearAuthMeCache()

      // Resolve the target PWA route immediately
      const meRes = await fetch('/api/auth/me', { cache: 'no-store' })
      const me = meRes.ok ? await meRes.json() : null
      const roleCode: string = me?.user?.roleCode?.toUpperCase() ?? ''

      if (roleCode === 'COMMERCIAL_SUPERVISOR' || roleCode === 'SALES_SUPERVISOR') {
        window.location.replace('/app/supervisor')
      } else if (roleCode === 'SELLER') {
        window.location.replace('/app/vendedor')
      } else if (roleCode === 'DIRECTORATE') {
        window.location.replace('/app/diretoria')
      } else {
        window.location.replace('/metas')
      }
    } catch {
      setError('Falha de conexão ao validar o segundo fator. Tente novamente.')
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

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Verificação adicional
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Informe o código de 6 dígitos do aplicativo autenticador para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Token */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Código de verificação
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-3.75 w-3.75 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  name="token"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="000000"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    if (error) setError('')
                  }}
                  className={`pwa-input h-11 w-full rounded-xl border bg-white/6 pl-10 pr-4 text-[14px] font-light text-white/90 placeholder:text-white/20 transition-colors focus:outline-none focus:ring-1 ${
                    error
                      ? 'border-rose-500/50 focus:ring-rose-500/25'
                      : 'border-white/10 focus:border-white/25 focus:ring-white/10'
                  }`}
                />
              </div>
              {error && <p className="text-[11px] text-rose-400">{error}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!hydrated || loading || !canSubmit}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-emerald-500"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Validando…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Confirmar acesso
                </>
              )}
            </button>
          </form>

          {/* Voltar */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => router.replace('/app/login')}
              className="inline-flex items-center gap-1 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para login
            </button>
          </div>
        </div>
      </div>

      <div className="h-6 shrink-0" />
    </div>
  )
}
