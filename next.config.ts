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
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
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
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'souver-8lzr7vsw8-ouroverde.vercel.app' }],
        destination: 'https://sistema.cafeouroverde.com.br/:path*',
        permanent: true,
      },
    ]
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
