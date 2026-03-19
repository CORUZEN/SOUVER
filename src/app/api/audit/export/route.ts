import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, hasPermission } from '@/lib/auth/permissions'

function escapeCell(value: string | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  // Envolve em aspas se contiver vírgula, aspas ou quebra de linha
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req)
  if (!currentUser) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })

  const canRead = await hasPermission(currentUser.roleId, 'audit:read')
  if (!canRead) return NextResponse.json({ message: 'Sem permissão' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const module = searchParams.get('module') || undefined
  const action = searchParams.get('action') || undefined
  const userId = searchParams.get('userId') || undefined
  const period = searchParams.get('period') ?? '7d'

  let since: Date | undefined
  const now = new Date()
  if (period === '1h')        since = new Date(now.getTime() - 60 * 60 * 1000)
  else if (period === '24h')  since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  else if (period === '7d')   since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  else if (period === '30d')  since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  else if (period === '90d')  since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  // period === 'all' → sem filtro de data

  const where = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(module ? { module } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' as const } },
            { action:      { contains: search, mode: 'insensitive' as const } },
            { module:      { contains: search, mode: 'insensitive' as const } },
            { user: { fullName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  // Máximo de 10 000 linhas para proteger memória
  const logs = await prisma.auditLog.findMany({
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
      user: { select: { fullName: true, login: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10_000,
  })

  const header = ['Data/Hora', 'Usuário', 'Login', 'Módulo', 'Ação', 'Entidade', 'ID Entidade', 'Descrição', 'IP']
  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    l.user?.fullName ?? '',
    l.user?.login ?? '',
    l.module,
    l.action,
    l.entityType ?? '',
    l.entityId ?? '',
    l.description ?? '',
    l.ipAddress ?? '',
  ].map(escapeCell).join(','))

  const csv = [header.join(','), ...rows].join('\r\n')
  const filename = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
