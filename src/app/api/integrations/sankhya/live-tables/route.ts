import { NextRequest, NextResponse } from 'next/server'
import { canAccessIntegrations, getAuthUser } from '@/lib/auth/permissions'
import { fetchSankhyaLiveCatalog } from '@/lib/integrations/sankhya-live-catalog'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  if (!(await canAccessIntegrations(authUser))) {
    return NextResponse.json({ message: 'Sem permissao para acessar Integracoes.' }, { status: 403 })
  }

  try {
    const payload = await fetchSankhyaLiveCatalog()
    const pretty = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('pretty') ?? '').toLowerCase())
    const download = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('download') ?? '').toLowerCase())

    if (!pretty && !download) {
      return NextResponse.json(payload)
    }

    const body = `${JSON.stringify(payload, null, 2)}\n`
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
    })

    if (download) {
      headers.set('Content-Disposition', 'attachment; filename="sankhya-live-tables.json"')
    }

    return new Response(body, { status: 200, headers })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha inesperada ao coletar tabelas reais da integracao Sankhya.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
