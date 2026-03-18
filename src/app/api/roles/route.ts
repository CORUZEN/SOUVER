import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, code: true, description: true,
      _count: { select: { users: true, rolePermissions: true } },
    },
  })

  return NextResponse.json({ roles })
}
