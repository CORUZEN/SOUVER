import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'

const updatePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).default([]),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Nao autenticado' }, { status: 401 })
  if (user.role?.code !== 'DEVELOPER') {
    return NextResponse.json({ message: 'Area Dev exclusiva para desenvolvedor.' }, { status: 403 })
  }

  const { id } = await params
  const role = await prisma.role.findUnique({ where: { id }, select: { id: true, code: true, name: true } })
  if (!role) return NextResponse.json({ message: 'Grupo nao encontrado.' }, { status: 404 })

  if (role.code === 'DEVELOPER') {
    return NextResponse.json({ message: 'Grupo DEVELOPER nao pode ser alterado por este painel.' }, { status: 400 })
  }

  const parsed = updatePermissionsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ message: 'Dados invalidos.' }, { status: 400 })
  }

  const validPermissions = await prisma.permission.findMany({
    where: { code: { in: parsed.data.permissionCodes } },
    select: { id: true, code: true },
  })

  const validPermissionIds = validPermissions.map((p) => p.id)

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } })
    if (validPermissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: validPermissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      })
    }
  })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  await auditLog({
    userId: user.id,
    module: 'roles',
    action: 'PERMISSION_CHANGED',
    entityType: 'role',
    entityId: role.id,
    newData: { permissionCodes: validPermissions.map((p) => p.code) },
    description: `Permissoes do grupo ${role.name} atualizadas no painel Dev.`,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({
    message: 'Permissoes do grupo atualizadas com sucesso.',
    appliedPermissions: validPermissions.map((p) => p.code),
  })
}
