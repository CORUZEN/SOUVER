import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureMetasPermissionCatalog, getAuthUser } from '@/lib/auth/permissions'
import { auditLog } from '@/domains/audit/audit.service'
import type { Prisma } from '@prisma/client'

const updatePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).default([]),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })
  if (user.role?.code !== 'DEVELOPER') {
    return NextResponse.json({ message: 'Área Dev exclusiva para desenvolvedor.' }, { status: 403 })
  }

  const { id } = await params
  const role = await prisma.role.findUnique({ where: { id }, select: { id: true, code: true, name: true } })
  if (!role) return NextResponse.json({ message: 'Grupo não encontrado.' }, { status: 404 })

  if (role.code === 'DEVELOPER') {
    return NextResponse.json({ message: 'Grupo DEVELOPER não pode ser alterado por este painel.' }, { status: 400 })
  }

  const parsed = updatePermissionsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 })
  }

  await ensureMetasPermissionCatalog()

  const validPermissions = await prisma.permission.findMany({
    where: { code: { in: parsed.data.permissionCodes } },
    select: { id: true, code: true },
  })

  const validPermissionIds = validPermissions.map((p: { id: string }) => p.id)

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } })
    if (validPermissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: validPermissionIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
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
    newData: { permissionCodes: validPermissions.map((p: { code: string }) => p.code) },
    description: `Permissões do grupo ${role.name} atualizadas no painel Dev.`,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({
    message: 'Permissões do grupo atualizadas com sucesso.',
    appliedPermissions: validPermissions.map((p: { code: string }) => p.code),
  })
}
