import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/metas/config?scope=1|2|all
 * Returns the stored MetasConfig for the given company scope.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 })

  const scope = req.nextUrl.searchParams.get('scope') ?? 'all'
  if (scope !== '1' && scope !== '2' && scope !== 'all') {
    return NextResponse.json({ message: 'Parâmetro scope inválido.' }, { status: 400 })
  }

  const row = await prisma.metasConfig.findUnique({ where: { scopeKey: scope } })

  if (!row) {
    return NextResponse.json({ metaConfigs: {}, monthConfigs: {} })
  }

  return NextResponse.json({
    metaConfigs: row.metaConfigs,
    monthConfigs: row.monthConfigs,
    updatedAt: row.updatedAt,
    updatedByLogin: row.updatedByLogin,
  })
}

/**
 * PUT /api/metas/config
 * Upserts the MetasConfig for the given company scope.
 * Body: { scope: string; metaConfigs: object; monthConfigs: object }
 */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 })
  }

  const { scope, metaConfigs, monthConfigs } = body as Record<string, unknown>

  if (scope !== '1' && scope !== '2' && scope !== 'all') {
    return NextResponse.json({ message: 'Parâmetro scope inválido.' }, { status: 400 })
  }

  if (!metaConfigs || typeof metaConfigs !== 'object' || Array.isArray(metaConfigs)) {
    return NextResponse.json({ message: 'metaConfigs inválido.' }, { status: 400 })
  }

  if (!monthConfigs || typeof monthConfigs !== 'object' || Array.isArray(monthConfigs)) {
    return NextResponse.json({ message: 'monthConfigs inválido.' }, { status: 400 })
  }

  const row = await prisma.metasConfig.upsert({
    where: { scopeKey: scope as string },
    update: {
      metaConfigs: metaConfigs as object,
      monthConfigs: monthConfigs as object,
      updatedByLogin: user.login,
    },
    create: {
      scopeKey: scope as string,
      metaConfigs: metaConfigs as object,
      monthConfigs: monthConfigs as object,
      updatedByLogin: user.login,
    },
  })

  return NextResponse.json({ ok: true, updatedAt: row.updatedAt })
}
