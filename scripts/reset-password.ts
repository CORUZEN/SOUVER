import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/lib/auth/password'

async function main() {
  const loginOrEmail = process.argv[2]
  const newPassword = process.argv[3]

  if (!loginOrEmail || !newPassword) {
    console.error('Uso: npx tsx scripts/reset-password.ts <login-ou-email> <nova-senha>')
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

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
    },
  })

  // Revoga todas as sessões ativas por segurança
  await prisma.userSession.deleteMany({
    where: { userId: user.id },
  })

  console.log(`Senha alterada com sucesso para: ${user.login} (${user.email})`)
  console.log('Todas as sessões ativas foram encerradas.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
