export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-primary-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logotipo e identidade */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 shadow-lg mb-4">
            <svg
              className="w-9 h-9 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Sistema Ouro Verde
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            Plataforma Corporativa — Café Ouro Verde
          </p>
        </div>

        {/* Card de conteúdo */}
        <div className="bg-white rounded-2xl shadow-modal p-8">
          {children}
        </div>

        <p className="text-center text-surface-500 text-xs mt-6">
          © {new Date().getFullYear()} Fábrica Café Ouro Verde. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
