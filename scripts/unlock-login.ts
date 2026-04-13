import { prisma } from '../src/lib/prisma'

const LOCK_DURATION_MS = 30 * 60 * 1000

async function main() {
  const loginOrEmail = process.argv[2]

  if (!loginOrEmail) {
    console.error('Uso: npx tsx scripts/unlock-login.ts <login-ou-email>')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ login: loginOrEmail }, { email: loginOrEmail }],
    },
    select: { id: true, login: true, email: true, fullName: true },
  })

  if (!user) {
    console.error(`Usuário não encontrado: ${loginOrEmail}`)
    process.exit(1)
  }

  const cutoff = new Date(Date.now() - LOCK_DURATION_MS)

  const recentFailures = await prisma.auditLog.findMany({
    where: {
      userId: user.id,
      action: 'LOGIN_FAILED',
      createdAt: { gte: cutoff },
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  if (recentFailures.length === 0) {
    console.log(`Sem tentativas recentes para desbloquear: ${user.login} (${user.email})`)
    return
  }

  const deleteResult = await prisma.auditLog.deleteMany({
    where: {
      id: { in: recentFailures.map((item: { id: string }) => item.id) },
    },
  })

  console.log(
    `Desbloqueado ${user.login} (${user.email}). Falhas recentes removidas: ${deleteResult.count}.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
