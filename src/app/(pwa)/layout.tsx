import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Ouro Verde',
    template: '%s | Ouro Verde',
  },
  description: 'Plataforma corporativa Ouro Verde',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ouro Verde',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#10b981',
}

export default function PwaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-950 text-white antialiased">
      {children}
    </div>
  )
}
