import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'
import { ensureRoleCatalog, ROLE_CATALOG_CODES, sortRolesByCatalogOrder } from '@/lib/role-catalog'

function deny() {
  return NextResponse.json({ message: 'Área Dev exclusiva para desenvolvedor.' }, { status: 403 })
}

async function requireDeveloper(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return { user: null, response: NextResponse.json({ message: 'Não autenticado' }, { status: 401 }) }
  if (user.role?.code !== 'DEVELOPER') return { user: null, response: deny() }
  return { user, response: null as NextResponse | null }
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireDeveloper(req)
  if (!user) return response

  await ensureRoleCatalog(prisma)

  const [rolesRaw, permissions, users, administrationGroup] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: ROLE_CATALOG_CODES } },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        rolePermissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    }),
    prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
      select: { id: true, module: true, action: true, code: true, description: true },
    }),
    prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        login: true,
        email: true,
        roleId: true,
        role: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.role.findUnique({
      where: { code: 'ADMINISTRACAO' },
      select: { id: true },
    }),
  ])

  const roles = sortRolesByCatalogOrder(rolesRaw)

  const rolesWithCodes = roles.map((role) => ({
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    permissionCodes: role.rolePermissions.map((rp) => rp.permission.code),
  }))

  return NextResponse.json({
    roles: rolesWithCodes,
    permissions,
    users,
    hasAdministrationGroup: Boolean(administrationGroup),
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireDeveloper(req)
  if (!user) return response

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const existing = await prisma.role.findUnique({ where: { code: 'ADMINISTRACAO' }, select: { id: true, code: true } })
  if (existing) {
    return NextResponse.json({ message: 'Grupo Administração já existe.', roleId: existing.id })
  }

  const role = await prisma.role.create({
    data: {
      name: 'Administração',
      code: 'ADMINISTRACAO',
      description: 'Grupo com permissões amplas operacionais, sem acesso ao painel Dev.',
    },
    select: { id: true, name: true, code: true },
  })

  const defaultPermissions = await prisma.permission.findMany({
    where: {
      module: { notIn: ['users', 'roles'] },
      code: { not: 'settings:admin' },
    },
    select: { id: true },
  })

  if (defaultPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: defaultPermissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    })
  }

  await auditLog({
    userId: user.id,
    module: 'roles',
    action: 'ROLE_CREATED',
    entityType: 'role',
    entityId: role.id,
    description: 'Grupo de permissao Administração criado no painel Dev.',
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Grupo Administração criado com sucesso.', roleId: role.id }, { status: 201 })
}
