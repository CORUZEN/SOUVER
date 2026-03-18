import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { verifyTokenEdge } from '@/lib/auth/jwt-edge'

// DELETE /api/users/me/sessions/[id]  — revoga uma sessão específica do usuário atual
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: sessionId } = await params

  // Confirma que a sessão pertence ao usuário
  const session = await prisma.userSession.findFirst({
    where: { id: sessionId, userId: user.id, status: 'ACTIVE' },
  })

  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
  }

  // Impede revogar a sessão atual
  const currentToken = req.cookies.get('souver_token')?.value
  const currentPayload = currentToken ? await verifyTokenEdge(currentToken) : null
  if (currentPayload?.sessionId === sessionId) {
    return NextResponse.json({ error: 'Não é possível encerrar a sessão atual por aqui. Use o botão Sair.' }, { status: 400 })
  }

  await prisma.userSession.update({
    where: { id: sessionId },
    data:  { status: 'REVOKED', revokedAt: new Date() },
  })

  return NextResponse.json({ message: 'Sessão encerrada com sucesso.' })
}
