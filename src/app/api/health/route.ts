import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'Sistema Ouro Verde',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.APP_ENV ?? 'development',
  })
}
