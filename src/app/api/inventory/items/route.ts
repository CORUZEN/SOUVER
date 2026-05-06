import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireModuleInteract } from '@/lib/auth/permissions'
import { listItems, createItem } from '@/domains/inventory/inventory.service'
import { auditLog } from '@/domains/audit/audit.service'
import { emitDomainEvent } from '@/lib/events'

const createSchema = z.object({
  sku: z.string().min(1, 'SKU Ã© obrigatÃ³rio'),
  name: z.string().min(1, 'Nome Ã© obrigatÃ³rio'),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  minQty: z.number().nonnegative().optional(),
  maxQty: z.number().positive().optional(),
  location: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const denied = await requireModuleInteract(req, 'logistica')
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const result = await listItems({
    search: searchParams.get('search') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    location: searchParams.get('location') ?? undefined,
    compact: searchParams.get('compact') === 'true',
    isActive: searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined,
    lowStock: searchParams.get('lowStock') === 'true',
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

  const denied = await requireModuleInteract(req, 'logistica')
  if (denied) return denied

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo invÃ¡lido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invÃ¡lidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const item = await createItem({ ...parsed.data, createdByUserId: user.id })

  emitDomainEvent('inventory:item.created', { itemId: item.id, userId: user.id })

  await auditLog({
    userId: user.id,
    module: 'warehouse',
    entityType: 'InventoryItem',
    entityId: item.id,
    action: 'CREATE',
    newData: { sku: item.sku, name: item.name },
    description: `Item criado: ${item.sku} â€” ${item.name}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(item, { status: 201 })
}

