import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { readCityList, writeCityList } from '@/lib/faturamento/city-store'
import type { City } from '@/lib/faturamento/city-types'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const denied = await requireModuleInteract(request, 'previsao')
  if (denied) return denied

    const cities = await readCityList()
    return NextResponse.json({ cities, count: cities.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const denied = await requireModuleInteract(request, 'previsao')
  if (denied) return denied

    const body = await request.json()
    const incoming: unknown = Array.isArray(body.cities) ? body.cities : body
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: 'Payload invÃ¡lido: esperado { cities: City[] }' }, { status: 400 })
    }

    const saved = await writeCityList(incoming as City[])
    return NextResponse.json({ cities: saved, count: saved.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

