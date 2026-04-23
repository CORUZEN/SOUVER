import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { getTelemetrySnapshot, resetTelemetry } from '@/lib/server/telemetry'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}

const ALLOWED_ROLES = new Set(['DEVELOPER', 'IT_ANALYST', 'ANALISTA_TI'])

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401, headers: NO_CACHE })

  const roleCode = String(user.role?.code ?? '').toUpperCase()
  if (!ALLOWED_ROLES.has(roleCode)) {
    return NextResponse.json({ message: 'Sem permissao para acessar telemetria.' }, { status: 403, headers: NO_CACHE })
  }

  const reset = req.nextUrl.searchParams.get('reset') === '1'
  if (reset) resetTelemetry()

  const snapshot = getTelemetrySnapshot()
  return NextResponse.json(snapshot, { headers: NO_CACHE })
}

