import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { getCollaboratorById } from '@/domains/hr/hr.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const collaborator = await getCollaboratorById(id)
  if (!collaborator) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(collaborator)
}
