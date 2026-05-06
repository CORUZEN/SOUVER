import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listConversations, createConversation } from '@/domains/chat/chat.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 })

  const conversations = await listConversations(user.id)
  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 })

  const body = await req.json()
  const { type, name, departmentId, memberIds } = body

  if (!type || !memberIds || !Array.isArray(memberIds)) {
    return NextResponse.json({ error: 'type e memberIds sÃ£o obrigatÃ³rios' }, { status: 400 })
  }
  if (type === 'DIRECT' && memberIds.length !== 1) {
    return NextResponse.json({ error: 'Conversa direta requer exatamente 1 membro' }, { status: 400 })
  }

  const conversation = await createConversation({
    type,
    name,
    departmentId,
    createdById: user.id,
    memberIds,
  })

  return NextResponse.json({ conversation }, { status: 201 })
}

