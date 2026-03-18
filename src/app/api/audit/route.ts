import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, hasPermission } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  if (!currentUser) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const canRead = await hasPermission(currentUser.roleId, 'audit:read')
  if (!canRead) return NextResponse.json({ message: 'Sem permissão para acessar auditoria' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const module = searchParams.get('module') || undefined
  const action = searchParams.get('action') || undefined
  const userId = searchParams.get('userId') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

  // Filtro de período
  const period = searchParams.get('period') ?? '7d'
  let since: Date | undefined
  const now = new Date()
  if (period === '1h') since = new Date(now.getTime() - 60 * 60 * 1000)
  else if (period === '24h') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  else if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const where = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(module ? { module } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' as const } },
            { action: { contains: search, mode: 'insensitive' as const } },
            { module: { contains: search, mode: 'insensitive' as const } },
            { user: { fullName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        module: true,
        action: true,
        description: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, login: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
