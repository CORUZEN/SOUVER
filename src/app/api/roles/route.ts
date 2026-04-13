import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { ensureRoleCatalog, ROLE_CATALOG_CODES, sortRolesByCatalogOrder } from '@/lib/role-catalog'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  await ensureRoleCatalog(prisma)

  const rolesRaw = await prisma.role.findMany({
    where: { code: { in: ROLE_CATALOG_CODES } },
    select: {
      id: true, name: true, code: true, description: true,
      requireTwoFactor: true,
      _count: { select: { users: true, rolePermissions: true } },
    },
  })

  const roles = sortRolesByCatalogOrder(rolesRaw)

  return NextResponse.json({ roles })
}
