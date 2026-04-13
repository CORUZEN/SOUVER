import { prisma } from '@/lib/prisma'

// Tipos padronizados de notificação
export const NOTIFICATION_TYPES = {
  NC_OPENED:        'NC_OPENED',
  NC_CRITICAL:      'NC_CRITICAL',
  LOW_STOCK:        'LOW_STOCK',
  BATCH_FINISHED:   'BATCH_FINISHED',
  BATCH_CANCELLED:  'BATCH_CANCELLED',
  BATCH_STARTED:    'BATCH_STARTED',
  LOGIN_SUSPICIOUS: 'LOGIN_SUSPICIOUS',
  USER_CREATED:     'USER_CREATED',
  USER_BLOCKED:     'USER_BLOCKED',
  SYSTEM:           'SYSTEM',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

interface CreateParams {
  type: string
  title: string
  message: string
  module?: string
  link?: string
}

// Cria notificação para um único usuário
export async function createNotification(
  userId: string,
  params: CreateParams,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type:    params.type,
      title:   params.title,
      message: params.message,
      module:  params.module ?? null,
      link:    params.link ?? null,
    },
  })
}

// Cria notificações para todos os usuários de um perfil
export async function createNotificationsForRole(
  roleCode: string,
  params: CreateParams,
): Promise<number> {
  const role = await prisma.role.findUnique({
    where:  { code: roleCode },
    select: { id: true },
  })
  if (!role) return 0

  const users = await prisma.user.findMany({
    where:  { roleId: role.id, status: 'ACTIVE' },
    select: { id: true },
  })
  if (users.length === 0) return 0

  const result = await prisma.notification.createMany({
    data: users.map((u: { id: string }) => ({
      userId:  u.id,
      type:    params.type,
      title:   params.title,
      message: params.message,
      module:  params.module ?? null,
      link:    params.link ?? null,
    })),
  })
  return result.count
}

// Cria notificações para todos os usuários ativos do sistema
export async function createNotificationsForAll(
  params: CreateParams,
): Promise<number> {
  const users = await prisma.user.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
  })
  if (users.length === 0) return 0

  const result = await prisma.notification.createMany({
    data: users.map((u: { id: string }) => ({
      userId:  u.id,
      type:    params.type,
      title:   params.title,
      message: params.message,
      module:  params.module ?? null,
      link:    params.link ?? null,
    })),
  })
  return result.count
}

// Cria notificações para uma lista de IDs de usuários
export async function createNotificationsForUsers(
  userIds: string[],
  params: CreateParams,
): Promise<number> {
  if (userIds.length === 0) return 0

  const result = await prisma.notification.createMany({
    data: userIds.map((uid: string) => ({
      userId:  uid,
      type:    params.type,
      title:   params.title,
      message: params.message,
      module:  params.module ?? null,
      link:    params.link ?? null,
    })),
  })
  return result.count
}
