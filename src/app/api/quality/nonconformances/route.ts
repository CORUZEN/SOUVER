import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listNonConformances, createNC, NCStatusValue, NCSeverityValue } from '@/domains/quality/quality.service'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'
import {
  createNotificationsForRole,
  NOTIFICATION_TYPES,
} from '@/domains/notifications/notifications.service'

const createSchema = z.object({
  title:           z.string().min(1, 'TÃ­tulo obrigatÃ³rio'),
  description:     z.string().min(1, 'DescriÃ§Ã£o obrigatÃ³ria'),
  severity:        z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  batchId:         z.string().optional(),
  departmentId:    z.string().optional(),
  qualityRecordId: z.string().optional(),
  assignedToId:    z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'qualidade')
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const result = await listNonConformances({
    search:       searchParams.get('search')       ?? undefined,
    severity:     (searchParams.get('severity') as unknown as NCSeverityValue | null) ?? undefined,
    status:       (searchParams.get('status')   as unknown as NCStatusValue   | null) ?? undefined,
    batchId:      searchParams.get('batchId')      ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    assignedToId: searchParams.get('assignedToId') ?? undefined,
    dateFrom:     searchParams.get('dateFrom')     ?? undefined,
    dateTo:       searchParams.get('dateTo')       ?? undefined,
    page:         Number(searchParams.get('page')     ?? 1),
    pageSize:     Number(searchParams.get('pageSize') ?? 20),
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'qualidade')
  if (denied) return denied

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo invÃ¡lido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invÃ¡lidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const nc = await createNC({ ...parsed.data, openedById: user.id })

  emitDomainEvent('quality:nc.opened', { ncId: nc.id, severity: parsed.data.severity, userId: user.id })

  await auditLog({
    userId:      user.id,
    module:      'quality',
    entityType:  'NonConformance',
    entityId:    nc.id,
    action:      'CREATE',
    newData:     nc,
    description: `NC aberta: ${nc.title}`,
    ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
  })

  // â”€â”€ AutomaÃ§Ã£o: alertas por severidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (parsed.data.severity === 'CRITICAL' || parsed.data.severity === 'HIGH') {
    const type    = parsed.data.severity === 'CRITICAL' ? NOTIFICATION_TYPES.NC_CRITICAL : NOTIFICATION_TYPES.NC_OPENED
    const sevLabel = parsed.data.severity === 'CRITICAL' ? 'ðŸ”´ CRÃTICA' : 'ðŸŸ  ALTA'

    createNotificationsForRole('QUALITY', {
      type,
      title:   `NC ${sevLabel} aberta: ${nc.title}`,
      message: `Uma nÃ£o conformidade de severidade ${parsed.data.severity} foi registrada por ${user.fullName ?? user.id}. Requer atenÃ§Ã£o.`,
      module:  'quality',
      link:    '/qualidade',
    }).catch(() => null)

    // NCs CRÃTICAS tambÃ©m alertam ADMIN
    if (parsed.data.severity === 'CRITICAL') {
      createNotificationsForRole('ADMIN', {
        type,
        title:   `NC CRÃTICA aberta: ${nc.title}`,
        message: `Uma nÃ£o conformidade crÃ­tica foi registrada no mÃ³dulo de Qualidade por ${user.fullName ?? user.id}. Verifique imediatamente.`,
        module:  'quality',
        link:    '/qualidade',
      }).catch(() => null)
    }
  }
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return NextResponse.json(nc, { status: 201 })
}

