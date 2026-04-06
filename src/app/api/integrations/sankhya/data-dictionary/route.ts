import { NextResponse } from 'next/server'
import { fetchSankhyaDataDictionary } from '@/lib/integrations/sankhya-data-dictionary'

export async function GET(req: Request) {
  try {
    const payload = await fetchSankhyaDataDictionary()
    const url = new URL(req.url)
    const pretty = ['1', 'true', 'yes'].includes((url.searchParams.get('pretty') ?? '').toLowerCase())
    const download = ['1', 'true', 'yes'].includes((url.searchParams.get('download') ?? '').toLowerCase())

    if (!pretty && !download) {
      return NextResponse.json(payload)
    }

    const body = `${JSON.stringify(payload, null, 2)}\n`
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
    })

    if (download) {
      headers.set('Content-Disposition', 'attachment; filename="sankhya-data-dictionary.json"')
    }

    return new Response(body, { status: 200, headers })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha inesperada ao coletar o dicionário de dados da Sankhya.'

    return NextResponse.json({ message }, { status: 502 })
  }
}
