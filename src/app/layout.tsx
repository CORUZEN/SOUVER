import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { APP_VERSION } from '@/generated/app-version'
import { QueryProvider } from '@/components/providers/QueryProvider'
import ServiceWorkerManager from '@/components/ServiceWorkerManager'
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
  manifest: `/manifest.json?v=${APP_VERSION}`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ouro Verde',
  },
  icons: {
    icon: [
      { url: '/branding/ouroverde-badge.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#10b981" />
        <link rel="manifest" href={`/manifest.json?v=${APP_VERSION}`} />
      </head>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
        <ServiceWorkerManager />
      </body>
    </html>
  )
}


