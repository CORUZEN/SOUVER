export const dynamic = 'force-static'

import Link from 'next/link'
import { ShieldOff, ArrowLeft } from 'lucide-react'

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-error-50 border border-error-100 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-error-400" />
        </div>
        <h1 className="text-5xl font-bold text-surface-200 mb-2">403</h1>
        <h2 className="text-xl font-semibold text-surface-800 mb-3">
          Acesso negado
        </h2>
        <p className="text-surface-500 text-sm mb-8 leading-relaxed">
          Você não tem permissão para acessar este recurso.
          Entre em contato com o administrador do sistema caso acredite que isso é um erro.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel Executivo
        </Link>
      </div>
    </div>
  )
}
