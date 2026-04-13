'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react'

export default function LoginForm() {
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
        window.location.href = '/login/2fa'
        return
      }

      if (data.requiresTwoFactorSetup) {
        window.location.href = '/configuracoes/2fa?setup=required'
        return
      }

      window.location.href = '/dashboard'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setApiError('A autenticacao demorou mais que o esperado. Tente novamente.')
      } else {
        setApiError('Falha de conexao. Tente novamente.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        label="Login ou E-mail"
        name="login"
        type="text"
        autoComplete="username"
        placeholder="seu.login ou email@empresa.com"
        value={form.login}
        onChange={handleChange}
        error={errors.login}
        leftIcon={<Mail className="h-4 w-4" />}
        className="h-11 rounded-xl border-slate-300/90 bg-white/90 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500"
        required
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleSubmit()
          }
        }}
      />

      <Input
        label="Senha"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Digite sua senha"
        value={form.password}
        onChange={handleChange}
        error={errors.password}
        className="h-11 rounded-xl border-slate-300/90 bg-white/90 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500"
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-slate-400 transition-colors hover:text-slate-700 focus:outline-none"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        required
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleSubmit()
          }
        }}
      />

      {apiError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          {apiError}
        </div>
      )}

      <Button
        type="button"
        onClick={() => {
          void handleSubmit()
        }}
        variant="primary"
        size="lg"
        loading={loading || !hydrated}
        disabled={!hydrated || loading}
        className="mt-2 h-12 w-full rounded-xl bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 focus-visible:ring-slate-900"
      >
        <LogIn className="h-4 w-4" />
        {!hydrated ? 'Carregando...' : loading ? 'Autenticando...' : 'Entrar'}
      </Button>

      <div className="pt-1 text-center">
        <Link
          href="/esqueci-senha"
          className="text-xs font-medium text-slate-600 hover:text-emerald-700 hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>
    </div>
  )
}
