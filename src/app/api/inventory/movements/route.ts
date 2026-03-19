import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import { listMovements, registerMovement, MovementTypeValue } from '@/domains/inventory/inventory.service'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'
import { prisma } from '@/lib/prisma'
import {
  createNotificationsForRole,
  NOTIFICATION_TYPES,
} from '@/domains/notifications/notifications.service'

const createSchema = z.object({
  itemId: z.string().min(1, 'Item é obrigatório'),
  type: z.enum(['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'WASTE']),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  reason: z.string().optional(),
  batchRef: z.string().optional(),
  supplier: z.string().optional(),
  documentRef: z.string().optional(),
  movedAt: z.string().datetime().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const result = await listMovements({
    itemId: searchParams.get('itemId') ?? undefined,
    type: (searchParams.get('type') as MovementTypeValue) ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 20),
  })

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=15',
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const movement = await registerMovement({
    ...parsed.data,
    type: parsed.data.type as MovementTypeValue,
    movedAt: parsed.data.movedAt ? new Date(parsed.data.movedAt) : undefined,
    createdByUserId: user.id,
  })

  emitDomainEvent('inventory:movement.created', {
    movementId: movement.id,
    itemId: parsed.data.itemId,
    type: parsed.data.type,
    userId: user.id,
  })

  await auditLog({
    userId: user.id,
    module: 'logistics',
    entityType: 'InventoryMovement',
    entityId: movement.id,
    action: 'CREATE',
    newData: { itemId: parsed.data.itemId, type: parsed.data.type, quantity: parsed.data.quantity },
    description: `Movimentação ${parsed.data.type}: ${movement.item.name} (${parsed.data.quantity} ${movement.item.unit})`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  // ── Automação: alerta de estoque mínimo ───────────────────────
  if (['EXIT', 'WASTE', 'TRANSFER'].includes(parsed.data.type)) {
    const item = await prisma.inventoryItem.findUnique({
      where:  { id: parsed.data.itemId },
      select: { name: true, sku: true, currentQty: true, minQty: true, unit: true },
    })
    if (item?.minQty && item.currentQty.lte(item.minQty)) {
      createNotificationsForRole('LOGISTICS', {
        type:    NOTIFICATION_TYPES.LOW_STOCK,
        title:   `Estoque mínimo atingido: ${item.name}`,
        message: `O item ${item.sku} — ${item.name} está com ${item.currentQty} ${item.unit} (mínimo: ${item.minQty} ${item.unit}). Reposição necessária.`,
        module:  'inventory',
        link:    '/logistica',
      }).catch(() => null)
    }
  }
  // ─────────────────────────────────────────────────────────────

  return NextResponse.json(movement, { status: 201 })
}
