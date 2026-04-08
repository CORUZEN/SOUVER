import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const isDev = process.env.APP_ENV === 'development'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { prisma?: any }

function sanitizeConnectionString(raw: string): string {
  try {
    const url = new URL(raw)
    // channel_binding is not supported by the pg adapter and causes failures
    // with Neon's pooler when combined with the adapter-pg SSL handshake.
    url.searchParams.delete('channel_binding')
    // Keep sslmode=require — upgrading to verify-full requires the Neon CA cert
    // to be in the system trust store, which is not guaranteed on Windows dev machines.
    return url.toString()
  } catch {
    return raw
  }
}

function createPrismaClient() {
  const connectionString = sanitizeConnectionString(process.env.DATABASE_URL ?? '')

  const adapter = new PrismaPg({
    connectionString,
    // rejectUnauthorized=false in development avoids Windows CA-store failures;
    // in production the Neon certificate is signed by a trusted CA.
    ssl: { rejectUnauthorized: !isDev },
    // Give Neon's compute endpoint time to wake from auto-suspend (can take up to 5 s).
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })

  return new PrismaClient({
    adapter,
    log: isDev ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (!isDev) {
  // In production the module is loaded once per worker; no global caching needed.
} else {
  globalForPrisma.prisma = prisma
}
