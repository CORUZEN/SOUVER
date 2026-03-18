'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, Mail, ArrowLeft, CheckCircle2, Copy } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const [login,    setLogin]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [devUrl,   setDevUrl]   = useState('')
  const [sent,     setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!login.trim()) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/forgot-password', {
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

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-surface-900">Pedido enviado</h2>
          <p className="text-sm text-surface-500">
            Se o cadastro existir, um link de redefinição foi gerado. Em produção, ele chegaria por e-mail.
          </p>
        </div>

        {devUrl && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1.5">DEV — link gerado:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-amber-800 break-all">{devUrl}</code>
              <button
                onClick={() => navigator.clipboard.writeText(devUrl)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-amber-100 text-amber-600"
                title="Copiar link"
              >
                <Copy size={14} />
              </button>
            </div>
            <Link href={devUrl} className="mt-2 text-xs text-brand-600 hover:underline block">
              Clique aqui para redefinir →
            </Link>
          </div>
        )}

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-brand-600 hover:underline mt-2">
          <ArrowLeft size={14} /> Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center mb-4">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-surface-900">Recuperar senha</h2>
        <p className="text-surface-500 text-sm mt-1">
          Informe seu login ou e-mail para receber o link de redefinição.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Login ou E-mail</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              autoFocus
              placeholder="seu.login ou email@empresa.com"
              className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !login.trim()}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {loading ? 'Processando...' : 'Enviar link de recuperação'}
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
