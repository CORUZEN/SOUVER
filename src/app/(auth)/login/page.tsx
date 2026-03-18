import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Acesso ao Sistema',
}

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-surface-900">
          Bem-vindo de volta
        </h2>
        <p className="text-surface-500 text-sm mt-1">
          Informe suas credenciais para acessar o sistema
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
