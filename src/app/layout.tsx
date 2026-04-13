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
    default: 'OURO VERDE | Café pra vida inteira!',
    template: '%s | OURO VERDE | Café pra vida inteira!',
  },
  description: 'Plataforma Corporativa Integrada — Fábrica Café Ouro Verde',
  icons: {
    icon: '/branding/ouroverde-badge.png',
    shortcut: '/branding/ouroverde-badge.png',
    apple: '/apple-icon.png',
  },
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
