import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import {
  listMessages,
  sendMessage,
  markConversationRead,
  getConversationById,
} from '@/domains/chat/chat.service'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/chat/conversations/[id]/messages — lista mensagens (paginação por cursor)
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { searchParams } = req.nextUrl
  const before = searchParams.get('before') ?? undefined
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  // Verifica se o usuário é participante
  const conv = await getConversationById(id)
  if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
  const isMember = conv.participants.some((p: { user: { id: string } }) => p.user.id === user.id)
  if (!isMember) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const messages = await listMessages(id, { before, limit })
  return NextResponse.json({ messages: messages.reverse() }) // cronológico
}

// POST /api/chat/conversations/[id]/messages — envia mensagem
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const conv = await getConversationById(id)
  if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
  const isMember = conv.participants.some((p: { user: { id: string } }) => p.user.id === user.id)
  if (!isMember) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json()
  const { content } = body
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Conteúdo da mensagem é obrigatório' }, { status: 400 })
  }

  const message = await sendMessage({
    conversationId: id,
    senderId:       user.id,
    content:        content.trim(),
  })

  return NextResponse.json({ message }, { status: 201 })
}

// PATCH /api/chat/conversations/[id]/messages — marca como lido
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  await markConversationRead(id, user.id)
  return NextResponse.json({ ok: true })
}
