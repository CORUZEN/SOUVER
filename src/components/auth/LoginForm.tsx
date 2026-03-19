'use client'

import { useState } from 'react'
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (apiError) setApiError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setApiError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
        window.location.href = `/login/2fa?userId=${data.userId}`
        return
      }

      // Perfil obriga 2FA — sessão criada, redireciona para configuração
      if (data.requiresTwoFactorSetup) {
        window.location.href = '/configuracoes/2fa?setup=required'
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setApiError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Login ou E-mail"
        name="login"
        type="text"
        autoComplete="username"
        placeholder="seu.login ou email@empresa.com"
        value={form.login}
        onChange={handleChange}
        error={errors.login}
        leftIcon={<Mail className="w-4 h-4" />}
        required
        autoFocus
      />

      <Input
        label="Senha"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="••••••••"
        value={form.password}
        onChange={handleChange}
        error={errors.password}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-surface-400 hover:text-surface-600 focus:outline-none"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        }
        required
      />

      {apiError && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full mt-2"
      >
        <LogIn className="w-4 h-4" />
        {loading ? 'Autenticando...' : 'Entrar'}
      </Button>

      <div className="text-center pt-1">
        <Link href="/esqueci-senha" className="text-xs text-brand-600 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
    </form>
  )
}
