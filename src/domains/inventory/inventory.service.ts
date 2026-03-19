import { prisma } from '@/lib/prisma'

export type MovementTypeValue = 'ENTRY' | 'EXIT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'WASTE'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemFilter {
  search?: string
  category?: string
  isActive?: boolean
  lowStock?: boolean
  location?: string
  compact?: boolean
  page?: number
  pageSize?: number
}

export interface CreateItemInput {
  sku: string
  name: string
  description?: string
  category?: string
  unit?: string
  minQty?: number
  maxQty?: number
  location?: string
  createdByUserId: string
}

export interface MovementInput {
  itemId: string
  type: MovementTypeValue
  quantity: number
  reason?: string
  batchRef?: string
  supplier?: string
  documentRef?: string
  movedAt?: Date
  createdByUserId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Itens de estoque
// ─────────────────────────────────────────────────────────────────────────────

export async function listItems(filter: ItemFilter) {
  const safePage = Number.isFinite(filter.page) ? Math.max(1, Number(filter.page)) : 1
  const safePageSize = Number.isFinite(filter.pageSize)
    ? Math.min(100, Math.max(1, Number(filter.pageSize)))
    : 20
  const skip = (safePage - 1) * safePageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (filter.search) {
    where.OR = [
      { sku: { contains: filter.search, mode: 'insensitive' } },
      { name: { contains: filter.search, mode: 'insensitive' } },
      { category: { contains: filter.search, mode: 'insensitive' } },
    ]
  }
  if (filter.category) where.category = { contains: filter.category, mode: 'insensitive' }
  if (filter.location) where.location = { contains: filter.location, mode: 'insensitive' }
  if (filter.isActive !== undefined) where.isActive = filter.isActive
  if (filter.lowStock) {
    where.minQty = { not: null }
    // Compara colunas no banco para evitar filtro em memória e manter paginação correta.
    where.currentQty = { lte: prisma.inventoryItem.fields.minQty }
  }

  const items = filter.compact
    ? await prisma.inventoryItem.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          category: true,
          unit: true,
          currentQty: true,
          minQty: true,
          maxQty: true,
          location: true,
          isActive: true,
          createdAt: true,
        },
      })
    : await prisma.inventoryItem.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { name: 'asc' },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { movements: true } },
        },
      })

  const total = await prisma.inventoryItem.count({ where })
  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  }
}

export async function getItemById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      movements: {
        orderBy: { movedAt: 'desc' },
        take: 20,
        include: { createdBy: { select: { id: true, fullName: true } } },
      },
    },
  })
}

export async function createItem(input: CreateItemInput) {
  return prisma.inventoryItem.create({
    data: {
      sku: input.sku,
      name: input.name,
      description: input.description,
      category: input.category,
      unit: input.unit ?? 'kg',
      minQty: input.minQty ?? undefined,
      maxQty: input.maxQty ?? undefined,
      location: input.location,
      createdByUserId: input.createdByUserId,
    },
    include: { createdBy: { select: { id: true, fullName: true } } },
  })
}

export async function updateItem(id: string, data: Partial<Omit<CreateItemInput, 'createdByUserId' | 'sku'>>) {
  return prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.unit && { unit: data.unit }),
      ...(data.minQty !== undefined && {
        minQty: data.minQty != null ? data.minQty : null,
      }),
      ...(data.maxQty !== undefined && {
        maxQty: data.maxQty != null ? data.maxQty : null,
      }),
      ...(data.location !== undefined && { location: data.location }),
    },
    include: { createdBy: { select: { id: true, fullName: true } } },
  })
}

export async function toggleItemActive(id: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { isActive: true } })
  if (!item) throw new Error('Item não encontrado')
  return prisma.inventoryItem.update({
    where: { id },
    data: { isActive: !item.isActive },
    select: { id: true, isActive: true },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimentações de estoque
// ─────────────────────────────────────────────────────────────────────────────

export async function listMovements(filter: {
  itemId?: string
  type?: MovementTypeValue
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}) {
  const safePage = Number.isFinite(filter.page) ? Math.max(1, Number(filter.page)) : 1
  const safePageSize = Number.isFinite(filter.pageSize)
    ? Math.min(100, Math.max(1, Number(filter.pageSize)))
    : 20
  const skip = (safePage - 1) * safePageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (filter.itemId) where.itemId = filter.itemId
  if (filter.type) where.type = filter.type
  if (filter.dateFrom || filter.dateTo) {
    where.movedAt = {}
    if (filter.dateFrom) where.movedAt.gte = new Date(filter.dateFrom)
    if (filter.dateTo) {
      const to = new Date(filter.dateTo)
      to.setHours(23, 59, 59, 999)
      where.movedAt.lte = to
    }
  }

  const [total, items] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take: safePageSize,
      orderBy: { movedAt: 'desc' },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
  ])

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  }
}

/** Cria movimentação e ajusta o currentQty do item de forma transacional */
export async function registerMovement(input: MovementInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.$transaction(async (tx: any) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: input.itemId },
      select: { currentQty: true, unit: true },
    })
    if (!item) throw new Error('Item de estoque não encontrado')

    const qtyBefore = Number(item.currentQty)
    const delta =
      input.type === 'ENTRY' || input.type === 'RETURN'
        ? input.quantity
        : -input.quantity
    const qtyAfter = qtyBefore + delta

    const movement = await tx.inventoryMovement.create({
      data: {
        itemId: input.itemId,
        type: input.type,
        quantity: input.quantity,
        unit: item.unit,
        qtyBefore: qtyBefore,
        qtyAfter: qtyAfter,
        reason: input.reason,
        batchRef: input.batchRef,
        supplier: input.supplier,
        documentRef: input.documentRef,
        movedAt: input.movedAt ?? new Date(),
        createdByUserId: input.createdByUserId,
      },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    })

    await tx.inventoryItem.update({
      where: { id: input.itemId },
      data: { currentQty: qtyAfter },
    })

    return movement
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

export async function getInventoryKPIs(dateRange?: { from: Date; to: Date }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const movedDateFilter = dateRange
    ? { gte: dateRange.from, lte: dateRange.to }
    : { gte: today }

  const [totalItems, totalMovements] = await Promise.all([
    prisma.inventoryItem.count({ where: { isActive: true } }),
    prisma.inventoryMovement.count({ where: { movedAt: movedDateFilter } }),
  ])

  const lowCount = await prisma.inventoryItem.count({
    where: {
      isActive: true,
      minQty: { not: null },
      currentQty: { lte: prisma.inventoryItem.fields.minQty },
    },
  })

  return {
    totalItems,
    activeItems: totalItems,
    lowStockItems: lowCount,
    lowStockCount: lowCount,
    movementsToday: totalMovements,  // compat com dashboard
    totalMovements,
  }
}
