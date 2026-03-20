import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  // Replace sslmode=require with sslmode=verify-full to suppress pg deprecation warning.
  // pg-connection-string triggers a warning when it encounters sslmode=require; using
  // verify-full makes the intent explicit and keeps identical security behaviour.
  const connectionString = (process.env.DATABASE_URL ?? '').replace(
    /sslmode=require/gi,
    'sslmode=verify-full'
  )
  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: true },
  })
  return new PrismaClient({
    adapter,
    log: process.env.APP_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.APP_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
