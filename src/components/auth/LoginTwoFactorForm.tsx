'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useInvalidateAuth } from '@/lib/client/hooks/use-auth'
import { getPostAuthRedirect } from '@/lib/client/pwa-utils'

function normalizeToken(value: string) {
  return value.toUpperCase().replace(/\s+/g, '')
}

export default function LoginTwoFactorForm() {
  const invalidateAuth = useInvalidateAuth()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizedToken = useMemo(() => normalizeToken(token), [token])
  const canSubmit = normalizedToken.length >= 6

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

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

      invalidateAuth()
      window.location.href = getPostAuthRedirect('/dashboard')
    } catch {
      setError('Falha de conexão ao validar o segundo fator. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Código de verificação"
        name="token"
        type="text"
        autoComplete="one-time-code"
        placeholder="000000 ou ABCDE-12345"
        value={token}
        onChange={(e) => {
          setToken(e.target.value)
          if (error) setError('')
        }}
        leftIcon={<KeyRound className="h-4 w-4" />}
        className="h-11 rounded-xl border-slate-300/90 bg-white/90 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500"
        required
        autoFocus
      />

      {error && (
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
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!canSubmit}
        className="mt-2 h-12 w-full rounded-xl bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 focus-visible:ring-slate-900"
      >
        <ShieldCheck className="h-4 w-4" />
        {loading ? 'Validando...' : 'Confirmar acesso'}
      </Button>

      <div className="pt-1 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para login
        </Link>
      </div>
    </form>
  )
}

