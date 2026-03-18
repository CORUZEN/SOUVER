import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/permissions'
import { getItemById, updateItem, toggleItemActive } from '@/domains/inventory/inventory.service'
import { auditLog } from '@/domains/audit/audit.service'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  minQty: z.number().nonnegative().nullable().optional(),
  maxQty: z.number().positive().nullable().optional(),
  location: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const item = await getItemById(id)
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  return NextResponse.json(item)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const item = await updateItem(id, {
    ...parsed.data,
    minQty: parsed.data.minQty ?? undefined,
    maxQty: parsed.data.maxQty ?? undefined,
  })

  await auditLog({
    userId: user.id,
    module: 'warehouse',
    entityType: 'InventoryItem',
    entityId: id,
    action: 'UPDATE',
    newData: parsed.data,
    description: `Item atualizado: ${item.sku} — ${item.name}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(item)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const result = await toggleItemActive(id)

  await auditLog({
    userId: user.id,
    module: 'warehouse',
    entityType: 'InventoryItem',
    entityId: id,
    action: result.isActive ? 'ACTIVATE' : 'DEACTIVATE',
    description: `Item ${result.isActive ? 'ativado' : 'desativado'}`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(result)
}
