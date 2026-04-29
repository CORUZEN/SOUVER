import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type ProductionStatusValue    = 'OPEN' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
export type ProductionShiftValue     = 'MORNING' | 'AFTERNOON' | 'NIGHT'
export type ProductionEventTypeValue = 'START' | 'PROGRESS' | 'PAUSE' | 'RESUME' | 'WASTE' | 'FINISH' | 'NOTE'

export interface BatchFilter {
  search?: string
  status?: ProductionStatusValue
  departmentId?: string
  shift?: ProductionShiftValue
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface CreateBatchInput {
  batchCode: string
  productName: string
  productType?: string
  productionLine?: string
  shift: ProductionShiftValue
  plannedQty?: number
  unit?: string
  notes?: string
  departmentId?: string
  createdByUserId: string
}

export interface CreateEventInput {
  batchId: string
  type: ProductionEventTypeValue
  description: string
  quantity?: number
  unit?: string
  occurredAt?: Date
  createdById: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Lotes de produção
// ─────────────────────────────────────────────────────────────────────────────

const batchInclude = {
  department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, fullName: true } },
  events: {
    orderBy: { occurredAt: 'desc' as const },
    take: 5,
    include: { createdBy: { select: { id: true, fullName: true } } },
  },
}

export async function listBatches(filter: BatchFilter) {
  const { page = 1, pageSize = 20 } = filter
  const skip = (page - 1) * pageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (filter.search) {
    where.OR = [
      { batchCode: { contains: filter.search, mode: 'insensitive' } },
      { productName: { contains: filter.search, mode: 'insensitive' } },
    ]
  }
  if (filter.status) where.status = filter.status
  if (filter.departmentId) where.departmentId = filter.departmentId
  if (filter.shift) where.shift = filter.shift

  if (filter.dateFrom || filter.dateTo) {
    where.createdAt = {}
    if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom)
    if (filter.dateTo) {
      const to = new Date(filter.dateTo)
      to.setHours(23, 59, 59, 999)
      where.createdAt.lte = to
    }
  }

  const [total, items] = await Promise.all([
    prisma.productionBatch.count({ where }),
    prisma.productionBatch.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { events: true } },
      },
    }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getBatchById(id: string) {
  return prisma.productionBatch.findUnique({
    where: { id },
    include: {
      ...batchInclude,
      events: {
        orderBy: { occurredAt: 'desc' },
        include: { createdBy: { select: { id: true, fullName: true } } },
      },
    },
  })
}

export async function createBatch(input: CreateBatchInput) {
  return prisma.productionBatch.create({
    data: {
      batchCode: input.batchCode,
      productName: input.productName,
      productType: input.productType,
      productionLine: input.productionLine,
      shift: input.shift,
      plannedQty: input.plannedQty,
      unit: input.unit ?? 'kg',
      notes: input.notes,
      departmentId: input.departmentId || undefined,
      createdByUserId: input.createdByUserId,
    },
    include: batchInclude,
  })
}

export async function updateBatch(
  id: string,
  data: Partial<Omit<CreateBatchInput, 'createdByUserId'>>
) {
  return prisma.productionBatch.update({
    where: { id },
    data: {
      ...(data.productName && { productName: data.productName }),
      ...(data.productType !== undefined && { productType: data.productType }),
      ...(data.productionLine !== undefined && { productionLine: data.productionLine }),
      ...(data.shift && { shift: data.shift }),
      ...(data.plannedQty !== undefined && { plannedQty: data.plannedQty }),
      ...(data.unit && { unit: data.unit }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId || undefined }),
    },
    include: batchInclude,
  })
}

/** Transição de status do lote com timestamps automáticos */
export async function changeBatchStatus(id: string, status: ProductionStatusValue) {
  const now = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = { status }

  if (status === 'IN_PROGRESS') data.startedAt = now
  if (status === 'FINISHED' || status === 'CANCELLED') data.finishedAt = now

  return prisma.productionBatch.update({ where: { id }, data, include: batchInclude })
}

export async function updateProducedQty(id: string, qty: number) {
  return prisma.productionBatch.update({
    where: { id },
    data: { producedQty: qty },
    select: { id: true, producedQty: true, plannedQty: true, unit: true },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Eventos de produção
// ─────────────────────────────────────────────────────────────────────────────

export async function listBatchEvents(batchId: string) {
  return prisma.productionEvent.findMany({
    where: { batchId },
    orderBy: { occurredAt: 'desc' },
    take: 100,
    include: { createdBy: { select: { id: true, fullName: true } } },
  })
}

export async function createEvent(input: CreateEventInput) {
  const event = await prisma.productionEvent.create({
    data: {
      batchId: input.batchId,
      type: input.type,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      occurredAt: input.occurredAt ?? new Date(),
      createdById: input.createdById,
    },
    include: { createdBy: { select: { id: true, fullName: true } } },
  })

  // Atualizar status do lote conforme o tipo de evento
  const statusMap: Partial<Record<ProductionEventTypeValue, ProductionStatusValue>> = {
    START: 'IN_PROGRESS',
    PAUSE: 'PAUSED',
    RESUME: 'IN_PROGRESS',
    FINISH: 'FINISHED',
  }
  const newStatus = statusMap[input.type]
  if (newStatus) {
    await changeBatchStatus(input.batchId, newStatus)
  }

  // Acumular qty produzida nos eventos de PROGRESS
  if (input.type === 'PROGRESS' && input.quantity) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: input.batchId },
      select: { producedQty: true },
    })
    const current = Number(batch?.producedQty ?? 0)
    await prisma.productionBatch.update({
      where: { id: input.batchId },
      data: { producedQty: current + input.quantity },
    })
  }

  return event
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

export interface KpiDateRange { from: Date; to: Date }

export async function getProductionKPIs(dateRange?: KpiDateRange) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Filtros sensíveis ao período
  const rangeFilter = dateRange
    ? { gte: dateRange.from, lte: dateRange.to }
    : undefined

  const createdWhere = rangeFilter ? { createdAt: rangeFilter } : {}
  const finishedWhere = rangeFilter
    ? { finishedAt: rangeFilter }
    : { finishedAt: { gte: today } }

  const [
    totalBatches,
    openCount,
    inProgressCount,
    finished,
    cancelled,
    prodAgg,
  ] = await Promise.all([
    prisma.productionBatch.count({ where: createdWhere }),
    prisma.productionBatch.count({ where: { status: 'OPEN', ...createdWhere } }),
    prisma.productionBatch.count({ where: { status: 'IN_PROGRESS', ...createdWhere } }),
    prisma.productionBatch.count({ where: { status: 'FINISHED', ...finishedWhere } }),
    prisma.productionBatch.count({ where: { status: 'CANCELLED', ...createdWhere } }),
    prisma.productionBatch.aggregate({
      _sum: { producedQty: true },
      where: finishedWhere,
    }),
  ])

  return {
    totalBatches,
    openCount,
    inProgressCount,
    inProgress: inProgressCount,
    finishedToday: finished,   // compat com dashboard
    finished,
    cancelled,
    totalProducedQty: prodAgg._sum.producedQty ? Number(prodAgg._sum.producedQty) : null,
  }
}
