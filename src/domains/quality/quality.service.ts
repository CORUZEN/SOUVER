import { prisma } from '@/lib/prisma'

// ─── Tipos de domínio ────────────────────────────────────────────
export type InspectionResultValue = 'PENDING' | 'APPROVED' | 'CONDITIONAL' | 'REJECTED'
export type NCSeverityValue       = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type NCStatusValue         = 'OPEN' | 'IN_ANALYSIS' | 'IN_TREATMENT' | 'RESOLVED' | 'CLOSED'

export interface QualityRecordFilter {
  batchId?:        string
  result?:         InspectionResultValue
  inspectedById?:  string
  dateFrom?:       string
  dateTo?:         string
  page?:           number
  pageSize?:       number
}

export interface NCFilter {
  search?:       string
  severity?:     NCSeverityValue
  status?:       NCStatusValue
  batchId?:      string
  departmentId?: string
  assignedToId?: string
  dateFrom?:     string
  dateTo?:       string
  page?:         number
  pageSize?:     number
}

export interface CreateQualityRecordInput {
  batchId?:        string
  inspectionType:  string
  result:          InspectionResultValue
  notes?:          string
  inspectedById:   string
  inspectedAt?:    string
}

export interface CreateNCInput {
  title:            string
  description:      string
  severity:         NCSeverityValue
  batchId?:         string
  departmentId?:    string
  qualityRecordId?: string
  openedById:       string
  assignedToId?:    string
}

// ─── QualityRecords ──────────────────────────────────────────────

export async function listQualityRecords(filter: QualityRecordFilter) {
  const { page = 1, pageSize = 20, batchId, result, inspectedById, dateFrom, dateTo } = filter
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (batchId)       where.batchId      = batchId
  if (result)        where.result       = result
  if (inspectedById) where.inspectedById = inspectedById
  if (dateFrom || dateTo) {
    where.inspectedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    }
  }

  const [items, total] = await Promise.all([
    prisma.qualityRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { inspectedAt: 'desc' },
      include: {
        batch:       { select: { id: true, batchCode: true, productName: true } },
        inspectedBy: { select: { id: true, fullName: true } },
        _count:      { select: { nonConformances: true } },
      },
    }),
    prisma.qualityRecord.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getQualityRecordById(id: string) {
  return prisma.qualityRecord.findUnique({
    where: { id },
    include: {
      batch:          { select: { id: true, batchCode: true, productName: true, status: true } },
      inspectedBy:    { select: { id: true, fullName: true } },
      nonConformances: {
        orderBy: { createdAt: 'desc' },
        include: {
          openedBy:   { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      },
    },
  })
}

export async function createQualityRecord(input: CreateQualityRecordInput) {
  return prisma.qualityRecord.create({
    data: {
      batchId:        input.batchId ?? null,
      inspectionType: input.inspectionType,
      result:         input.result as never,
      notes:          input.notes ?? null,
      inspectedById:  input.inspectedById,
      inspectedAt:    input.inspectedAt ? new Date(input.inspectedAt) : new Date(),
    },
  })
}

export async function updateQualityRecord(id: string, data: Partial<Omit<CreateQualityRecordInput, 'inspectedById'>>) {
  return prisma.qualityRecord.update({
    where: { id },
    data: {
      ...(data.inspectionType !== undefined && { inspectionType: data.inspectionType }),
      ...(data.result         !== undefined && { result: data.result as never }),
      ...(data.notes          !== undefined && { notes: data.notes }),
      ...(data.batchId        !== undefined && { batchId: data.batchId }),
      ...(data.inspectedAt    !== undefined && { inspectedAt: new Date(data.inspectedAt) }),
    },
  })
}

// ─── NonConformances ─────────────────────────────────────────────

export async function listNonConformances(filter: NCFilter) {
  const {
    page = 1, pageSize = 20,
    search, severity, status, batchId, departmentId, assignedToId, dateFrom, dateTo,
  } = filter
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { title:       { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (severity)     where.severity     = severity
  if (status)       where.status       = status
  if (batchId)      where.batchId      = batchId
  if (departmentId) where.departmentId = departmentId
  if (assignedToId) where.assignedToId = assignedToId
  if (dateFrom || dateTo) {
    where.openedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    }
  }

  const [items, total] = await Promise.all([
    prisma.nonConformance.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        batch:      { select: { id: true, batchCode: true, productName: true } },
        department: { select: { id: true, name: true } },
        openedBy:   { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    }),
    prisma.nonConformance.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getNCById(id: string) {
  return prisma.nonConformance.findUnique({
    where: { id },
    include: {
      batch:         { select: { id: true, batchCode: true, productName: true, status: true } },
      department:    { select: { id: true, name: true } },
      qualityRecord: { select: { id: true, inspectionType: true, result: true } },
      openedBy:      { select: { id: true, fullName: true } },
      assignedTo:    { select: { id: true, fullName: true } },
    },
  })
}

export async function createNC(input: CreateNCInput) {
  return prisma.nonConformance.create({
    data: {
      title:            input.title,
      description:      input.description,
      severity:         input.severity as never,
      batchId:          input.batchId          ?? null,
      departmentId:     input.departmentId     ?? null,
      qualityRecordId:  input.qualityRecordId  ?? null,
      openedById:       input.openedById,
      assignedToId:     input.assignedToId     ?? null,
    },
  })
}

export async function updateNC(id: string, data: {
  title?:       string
  description?: string
  severity?:    NCSeverityValue
  assignedToId?: string | null
  resolution?:  string
}) {
  return prisma.nonConformance.update({
    where: { id },
    data: {
      ...(data.title        !== undefined && { title: data.title }),
      ...(data.description  !== undefined && { description: data.description }),
      ...(data.severity     !== undefined && { severity: data.severity as never }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.resolution   !== undefined && { resolution: data.resolution }),
    },
  })
}

export async function changeNCStatus(id: string, newStatus: NCStatusValue) {
  const now = new Date()
  const extra: Record<string, unknown> = {}
  if (newStatus === 'RESOLVED') extra.resolvedAt = now
  if (newStatus === 'CLOSED')   extra.closedAt   = now

  return prisma.nonConformance.update({
    where: { id },
    data: { status: newStatus as never, ...extra },
  })
}

// ─── KPIs de Qualidade ───────────────────────────────────────────

export async function getQualityKPIs(dateRange?: { from: Date; to: Date }) {
  const rangeFilter = dateRange
    ? { gte: dateRange.from, lte: dateRange.to }
    : undefined

  const recordsWhere = rangeFilter ? { inspectedAt: rangeFilter } : {}
  const resolvedWhere = rangeFilter
    ? { resolvedAt: rangeFilter }
    : { resolvedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }

  const [
    totalRecords,
    pendingRecords,
    approvedRecords,
    rejectedRecords,
    openNCs,
    criticalNCs,
    resolvedThisMonth,
  ] = await Promise.all([
    prisma.qualityRecord.count({ where: recordsWhere }),
    prisma.qualityRecord.count({ where: { result: 'PENDING',  ...recordsWhere } }),
    prisma.qualityRecord.count({ where: { result: 'APPROVED', ...recordsWhere } }),
    prisma.qualityRecord.count({ where: { result: 'REJECTED', ...recordsWhere } }),
    prisma.nonConformance.count({ where: { status: { in: ['OPEN', 'IN_ANALYSIS', 'IN_TREATMENT'] as never[] } } }),
    prisma.nonConformance.count({ where: { severity: 'CRITICAL', status: { not: 'CLOSED' as never } } }),
    prisma.nonConformance.count({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] as never[] },
        ...resolvedWhere,
      },
    }),
  ])

  return {
    totalRecords,
    pendingRecords,
    approvedRecords,
    rejectedRecords,
    openNCs,
    criticalNCs,
    resolvedThisMonth,
  }
}

export async function getQualityKpisSummary() {
  const [totalRecords, openNCs, criticalNCs] = await Promise.all([
    prisma.qualityRecord.count(),
    prisma.nonConformance.count({
      where: { status: { in: ['OPEN', 'IN_ANALYSIS', 'IN_TREATMENT'] as never[] } },
    }),
    prisma.nonConformance.count({
      where: { severity: 'CRITICAL', status: { not: 'CLOSED' as never } },
    }),
  ])

  return { totalRecords, openNCs, criticalNCs }
}
