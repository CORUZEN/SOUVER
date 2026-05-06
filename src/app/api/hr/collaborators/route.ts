import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listCollaborators, CollaboratorStatus } from '@/domains/hr/hr.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'rh')
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const result = await listCollaborators({
    search:       searchParams.get('search')       ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    roleId:       searchParams.get('roleId')       ?? undefined,
    status:       (searchParams.get('status') as unknown as CollaboratorStatus | null) ?? undefined,
    page:         Number(searchParams.get('page')     ?? 1),
    pageSize:     Number(searchParams.get('pageSize') ?? 20),
  })

  return NextResponse.json(result)
}

