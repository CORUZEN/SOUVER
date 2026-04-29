import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { createSession } from '@/lib/auth/session'
import { auditLog } from '@/domains/audit/audit.service'

const impersonateSchema = z.object({
  userId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  if (!currentUser) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })
  if (currentUser.role?.code !== 'DEVELOPER') {
    return NextResponse.json({ message: 'Acesso permitido apenas para desenvolvedor.' }, { status: 403 })
  }

  const payload = impersonateSchema.safeParse(await req.json())
  if (!payload.success) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 })
  }

  if (payload.data.userId === currentUser.id) {
    return NextResponse.json({ message: 'Você já está autenticado com este usuário.' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: payload.data.userId },
    include: { role: { select: { sessionDurationHours: true } } },
  })

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json({ message: 'Usuário não encontrado ou inativo.' }, { status: 404 })
  }

  const currentToken = req.cookies.get('souver_token')?.value
  if (!currentToken) return NextResponse.json({ message: 'Sessão atual inválida.' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const { token: impersonatedToken, expiresAt } = await createSession(
    targetUser.id,
    ip,
    userAgent,
    targetUser.role?.sessionDurationHours ?? null
  )

  await auditLog({
    userId: currentUser.id,
    module: 'auth',
    action: 'IMPERSONATION_STARTED',
    entityType: 'user',
    entityId: targetUser.id,
    description: `Desenvolvedor iniciou locação como ${targetUser.fullName}.`,
    ipAddress: ip,
    userAgent,
  })

  const response = NextResponse.json({
    message: `Sessão locada como ${targetUser.fullName}.`,
  })

  response.cookies.set('souver_token', impersonatedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/',
  })

  const existingImpersonator = req.cookies.get('souver_impersonator_token')?.value
  if (!existingImpersonator) {
    response.cookies.set('souver_impersonator_token', currentToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })
  }

  return response
}
