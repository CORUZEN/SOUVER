import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'OURO VERDE | Sistema de Gestão Industrial',
    template: '%s | OURO VERDE | Sistema de Gestão Industrial',
  },
  description: 'Plataforma Corporativa Integrada — Fábrica Café Ouro Verde',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
