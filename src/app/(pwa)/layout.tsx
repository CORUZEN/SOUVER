import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Ouro Verde | Café pra vida inteira!',
  },
  description: 'Plataforma corporativa Ouro Verde',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ouro Verde | Café pra vida inteira!',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3f783d',
}

import PwaUpdateToast from '@/components/pwa/PwaUpdateToast'

export default function PwaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pwa-theme min-h-dvh bg-surface-950 text-white antialiased">
      {children}
      <PwaUpdateToast />
    </div>
  )
}
