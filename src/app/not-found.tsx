import Link from 'next/link'
import { Search } from 'lucide-react'

export default function NotFound() {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-surface-200 flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-surface-400" />
            </div>
            <h1 className="text-6xl font-bold text-surface-300 mb-2">404</h1>
            <h2 className="text-xl font-semibold text-surface-800 mb-3">
              Página não encontrada
            </h2>
            <p className="text-surface-500 text-sm mb-8 leading-relaxed">
              A página que você está procurando não existe ou foi movida.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Voltar ao Painel
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
