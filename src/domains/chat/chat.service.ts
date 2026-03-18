import { prisma } from '@/lib/prisma'

// ─── Tipos ───────────────────────────────────────────────────────
export type ConversationTypeValue = 'DIRECT' | 'GROUP' | 'DEPARTMENT'
export type MessageTypeValue      = 'TEXT' | 'SYSTEM'

export interface CreateConversationInput {
  type:         ConversationTypeValue
  name?:        string
  departmentId?: string
  createdById:  string
  memberIds:    string[]   // IDs dos participantes (além do criador)
}

export interface SendMessageInput {
  conversationId: string
  senderId:       string
  content:        string
  messageType?:   MessageTypeValue
}

// ─── Conversas ───────────────────────────────────────────────────

export async function listConversations(userId: string) {
  // Retorna conversas em que o usuário participa, com última mensagem
  return prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  })
}

export async function getConversationById(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true, status: true } } },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
  })
}

export async function createConversation(input: CreateConversationInput) {
  // Para DM: verifica se já existe conversa direta entre os dois usuários
  if (input.type === 'DIRECT' && input.memberIds.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: input.createdById } } },
          { participants: { some: { userId: input.memberIds[0] } } },
        ],
      },
    })
    if (existing) return existing
  }

  const allMembers = Array.from(new Set([input.createdById, ...input.memberIds]))

  return prisma.conversation.create({
    data: {
      type:        input.type as never,
      name:        input.name        ?? null,
      departmentId: input.departmentId ?? null,
      createdById: input.createdById,
      participants: {
        create: allMembers.map(uid => ({ userId: uid })),
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
    },
  })
}

export async function markConversationRead(conversationId: string, userId: string) {
  return prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data:  { lastReadAt: new Date() },
  })
}

// ─── Mensagens ───────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
) {
  const { before, limit = 50 } = opts

  const where: Record<string, unknown> = {
    conversationId,
    deletedAt: null,
  }
  if (before) {
    where.createdAt = { lt: new Date(before) }
  }

  return prisma.message.findMany({
    where,
    take:    limit,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  })
}

export async function sendMessage(input: SendMessageInput) {
  const [message] = await Promise.all([
    prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId:       input.senderId,
        content:        input.content,
        messageType:    (input.messageType ?? 'TEXT') as never,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    }),
    // Atualiza updatedAt da conversa para manter ordenação
    prisma.conversation.update({
      where: { id: input.conversationId },
      data:  { updatedAt: new Date() },
    }),
  ])
  return message
}

export async function deleteMessage(messageId: string, userId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } })
  if (!msg || msg.senderId !== userId) return null
  return prisma.message.update({
    where: { id: messageId },
    data:  { deletedAt: new Date() },
  })
}

// ─── Contagem de não-lidas ───────────────────────────────────────

export async function getUnreadCounts(userId: string) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  })

  const counts: Record<string, number> = {}
  await Promise.all(
    participations.map(async (p: { conversationId: string; lastReadAt: Date | null }) => {
      const count = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId:       { not: userId },
          deletedAt:      null,
          createdAt:      p.lastReadAt ? { gt: p.lastReadAt } : undefined,
        },
      })
      counts[p.conversationId] = count
    }),
  )
  return counts
}

export async function getTotalUnread(userId: string) {
  const counts = await getUnreadCounts(userId)
  return Object.values(counts).reduce((a, b) => a + b, 0)
}
