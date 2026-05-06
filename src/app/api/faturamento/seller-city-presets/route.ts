import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

/* â”€â”€ GET: listar presets â”€â”€ */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'NÃ£o autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sellerName = searchParams.get('sellerName')

  try {
    const presets = await prisma.sellerCityFilterPreset.findMany({
      where: sellerName ? { sellerName } : undefined,
      orderBy: [{ sellerName: 'asc' }, { cityKey: 'asc' }],
    })
    return NextResponse.json({ presets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar presets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* â”€â”€ POST: criar ou substituir presets de um vendedor â”€â”€ */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'NÃ£o autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      sellerName: string
      cityKeys: string[]
    }

    if (!body.sellerName || !Array.isArray(body.cityKeys)) {
      return NextResponse.json({ error: 'Dados invÃ¡lidos' }, { status: 400 })
    }

    await prisma.$transaction(async (tx: typeof prisma) => {
      // Remove presets existentes para este vendedor
      await tx.sellerCityFilterPreset.deleteMany({
        where: { sellerName: body.sellerName },
      })
      // Cria novos presets
      if (body.cityKeys.length > 0) {
        await tx.sellerCityFilterPreset.createMany({
          data: body.cityKeys.map((cityKey) => ({
            sellerName: body.sellerName,
            cityKey,
          })),
          skipDuplicates: true,
        })
      }
    })

    const presets = await prisma.sellerCityFilterPreset.findMany({
      where: { sellerName: body.sellerName },
      orderBy: { cityKey: 'asc' },
    })

    return NextResponse.json({ presets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar presets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* â”€â”€ DELETE: remover presets de um vendedor â”€â”€ */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'NÃ£o autenticado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const sellerName = searchParams.get('sellerName')

    if (!sellerName) {
      return NextResponse.json({ error: 'sellerName obrigatÃ³rio' }, { status: 400 })
    }

    await prisma.sellerCityFilterPreset.deleteMany({
      where: { sellerName },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao remover presets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

