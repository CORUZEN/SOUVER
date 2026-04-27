import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',       value: 'on' },
  { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',       value: 'nosniff' },
  { key: 'Referrer-Policy',              value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',           value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection',            value: '1; mode=block' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'fflate'],
  experimental: {
    webpackBuildWorker: true,
    serverActions: {
      allowedOrigins: ['localhost:3001'],
    },
  },
  async rewrites() {
    return [
      { source: '/controle', destination: '/dev' },
      { source: '/controle/gestao-usuarios', destination: '/dev/gestao-usuarios' },
      { source: '/controle/gestao-permissoes', destination: '/dev/gestao-permissoes' },
    ]
  },
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]

    if (process.env.NODE_ENV === 'production') {
      headers.push({
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      })
    }

    return headers
  },
}

export default nextConfig
