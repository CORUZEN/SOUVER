'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-semibold text-surface-900 mb-2">
              Algo deu errado
            </h1>
            <p className="text-surface-500 text-sm mb-8 leading-relaxed">
              Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.
            </p>
            {error.digest && (
              <p className="text-xs text-surface-400 mb-6 font-mono">ID: {error.digest}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-surface-200 text-surface-700 text-sm font-medium rounded-lg hover:bg-surface-100 transition-colors"
              >
                <Home className="w-4 h-4" />
                Ir para o Painel
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
