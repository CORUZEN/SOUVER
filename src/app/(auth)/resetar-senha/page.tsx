'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LockKeyhole, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react'

function ResetarSenhaForm() {
  const params       = useSearchParams()
  const token        = params.get('token') ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)

  useEffect(() => {
    if (!token) setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('A senha deve ter pelo menos 6 caracteres.'); return }

    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao redefinir senha.'); return }
      setSuccess(true)
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-surface-900">Senha redefinida!</h2>
        <p className="text-sm text-surface-500">
          Sua senha foi alterada com sucesso. Todas as sessões ativas foram encerradas.
        </p>
        <Link href="/login"
          className="mt-2 w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl text-center transition-colors">
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center mb-4">
          <LockKeyhole className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-surface-900">Nova senha</h2>
        <p className="text-surface-500 text-sm mt-1">
          Escolha uma senha segura para sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Nova senha</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={!token}
              autoFocus
              placeholder="Mínimo 6 caracteres"
              className="w-full pl-3 pr-10 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-2.5 text-surface-400 hover:text-surface-700">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Confirmar senha</label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            disabled={!token}
            placeholder="Repita a senha"
            className="w-full px-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !token || !password || !confirm}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </button>

        <div className="text-center">
          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-brand-600 hover:underline">
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function ResetarSenhaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-center text-surface-400 py-8">Carregando…</p>}>
      <ResetarSenhaForm />
    </Suspense>
  )
}
