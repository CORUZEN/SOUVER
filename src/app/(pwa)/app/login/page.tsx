'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react'
import { clearAuthMeCache } from '@/lib/client/auth-me-cache'

export default function PwaLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ login: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (apiError) setApiError('')
  }

  async function handleSubmit() {
    if (!hydrated || loading) return

    const nextErrors: Record<string, string> = {}
    if (!form.login.trim()) nextErrors.login = 'Informe o login ou e-mail.'
    if (!form.password.trim()) nextErrors.password = 'Informe a senha.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setApiError('')

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setApiError(data.message ?? 'Erro ao autenticar.')
        }
        return
      }

      if (data.requiresTwoFactor) {
        window.location.href = '/app/login/2fa'
        return
      }

      if (data.requiresTwoFactorSetup) {
        window.location.href = '/configuracoes/2fa?setup=required'
        return
      }

      clearAuthMeCache()

      // Resolve the target PWA route immediately — avoids any soft-navigation
      // flash through the /app entry page or web routes.
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' })
        const me = meRes.ok ? await meRes.json() : null
        const roleCode: string = me?.user?.roleCode?.toUpperCase() ?? ''

        if (roleCode === 'COMMERCIAL_SUPERVISOR' || roleCode === 'SALES_SUPERVISOR') {
          window.location.replace('/app/supervisor')
        } else if (roleCode === 'SELLER') {
          window.location.replace('/app/vendedor')
        } else {
          // Managers, Directors, Developers — go directly to the web system
          window.location.replace('/metas')
        }
      } catch {
        window.location.replace('/app')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setApiError('A autenticação demorou mais que o esperado. Tente novamente.')
      } else {
        setApiError('Falha de conexão. Tente novamente.')
      }
    } finally {
      window.clearTimeout(timeoutId)
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
              Boas vindas,
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-4">

            {/* Login */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Login ou E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-3.75 w-3.75 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  name="login"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="seu.login ou e-mail"
                  value={form.login}
                  onChange={handleChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                  className={`pwa-input h-11 w-full rounded-xl border bg-white/6 pl-10 pr-4 text-[14px] font-light text-white/90 placeholder:text-white/20 transition-colors focus:outline-none focus:ring-1 ${
                    errors.login
                      ? 'border-rose-500/50 focus:ring-rose-500/25'
                      : 'border-white/10 focus:border-white/25 focus:ring-white/10'
                  }`}
                />
              </div>
              {errors.login && <p className="text-[11px] text-rose-400">{errors.login}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-3.75 w-3.75 -translate-y-1/2 text-white/25" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Sua senha de acesso"
                  value={form.password}
                  onChange={handleChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                  className={`pwa-input h-11 w-full rounded-xl border bg-white/6 pl-10 pr-11 text-[14px] font-light text-white/90 placeholder:text-white/20 transition-colors focus:outline-none focus:ring-1 ${
                    errors.password
                      ? 'border-rose-500/50 focus:ring-rose-500/25'
                      : 'border-white/10 focus:border-white/25 focus:ring-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/50"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-400">{errors.password}</p>}
            </div>

            {/* API error */}
            {apiError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3.5 py-2.5 text-[13px] text-rose-300">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {apiError}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!hydrated || loading}
            className="mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-emerald-500"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Autenticando…
              </>
            ) : !hydrated ? 'Carregando…' : (
              <>
                <LogIn className="h-4 w-4" />
                Entrar
              </>
            )}
          </button>

          {/* Esqueci minha senha — logo abaixo do botão */}
          <div className="mt-4 flex justify-center">
            <a
              href="/app/esqueci-senha"
              className="text-xs font-medium text-white/40 transition-colors hover:text-white/70"
            >
              Esqueci minha senha
            </a>
          </div>

          <div className="mt-8" />

          {/* Footer */}
          <div className="flex justify-center">
            <p className="text-[10px] text-white/20">
              Desenvolvido por Jucélio Verissimo
            </p>
          </div>
        </div>
      </div>

      <div className="h-6 shrink-0" />
    </div>
  )
}
