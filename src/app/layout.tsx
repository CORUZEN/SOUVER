import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { APP_VERSION } from '@/generated/app-version'
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
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (!('serviceWorker' in navigator)) return;
                var isLocalhost =
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1' ||
                  location.hostname === '::1';
                var isProd = ${JSON.stringify(process.env.NODE_ENV === 'production')};

                window.addEventListener('load', function () {
                  if (!isProd || isLocalhost) {
                    navigator.serviceWorker.getRegistrations()
                      .then(function (regs) { return Promise.all(regs.map(function (r) { return r.unregister(); })); })
                      .catch(function () {});
                    if ('caches' in window) {
                      caches.keys()
                        .then(function (keys) {
                          return Promise.all(
                            keys
                              .filter(function (k) { return k.indexOf('ov-pwa-') === 0; })
                              .map(function (k) { return caches.delete(k); })
                          );
                        })
                        .catch(function () {});
                    }
                    return;
                  }
                  navigator.serviceWorker.register('/sw.js?v=${APP_VERSION}').catch(function () {});
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}


