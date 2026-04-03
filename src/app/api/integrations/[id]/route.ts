import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import {
  asTrimmedString,
  normalizeBaseUrl,
  isValidHttpUrl,
  parseStoredConfig,
  sanitizeConfig,
  serializeConfig,
  summarizeConfig,
  validateSankhyaConfiguration,
  type IntegrationStatus,
  type SankhyaConfig,
} from '@/lib/integrations/config'

const ALLOWED_STATUS = new Set<IntegrationStatus>(['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING'])

function hasField(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function mergeConfig(existing: SankhyaConfig, incomingRaw: unknown): SankhyaConfig {
  if (!incomingRaw || typeof incomingRaw !== 'object' || Array.isArray(incomingRaw)) return existing

  const incoming = incomingRaw as Record<string, unknown>
  const sanitized = sanitizeConfig(incoming)
  const next: SankhyaConfig = { ...existing }

  if (hasField(incoming, 'companyCode')) next.companyCode = sanitized.companyCode
  if (hasField(incoming, 'username')) next.username = sanitized.username
  if (hasField(incoming, 'clientId')) next.clientId = sanitized.clientId
  if (hasField(incoming, 'authMode')) next.authMode = sanitized.authMode

  if (hasField(incoming, 'password')) {
    if (incoming.password === null) next.password = null
    else if (typeof incoming.password === 'string' && incoming.password.trim().length > 0) next.password = sanitized.password
  }

  if (hasField(incoming, 'appKey')) {
    if (incoming.appKey === null) next.appKey = null
    else if (typeof incoming.appKey === 'string' && incoming.appKey.trim().length > 0) next.appKey = sanitized.appKey
  }

  if (hasField(incoming, 'token')) {
    if (incoming.token === null) next.token = null
    else if (typeof incoming.token === 'string' && incoming.token.trim().length > 0) next.token = sanitized.token
  }

  if (hasField(incoming, 'clientSecret')) {
    if (incoming.clientSecret === null) next.clientSecret = null
    else if (typeof incoming.clientSecret === 'string' && incoming.clientSecret.trim().length > 0) next.clientSecret = sanitized.clientSecret
  }

  return next
}

// GET /api/integrations/[id] - detalhe + logs paginados
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await params
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = 20

  const [integration, logs, total] = await Promise.all([
    prisma.integration.findUnique({
      where: { id },
      include: { _count: { select: { logs: true } } },
    }),
    prisma.integrationLog.findMany({
      where: { integrationId: id },
      orderBy: { executedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.integrationLog.count({ where: { integrationId: id } }),
  ])

  if (!integration) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })

  const config = parseStoredConfig(integration.configEncrypted)
  const safeConfig: SankhyaConfig = {
    ...config,
    password: null,
    token: null,
    clientSecret: null,
    appKey: null,
  }

  return NextResponse.json({
    integration: {
      ...integration,
      config: safeConfig,
      configSummary: summarizeConfig(config),
    },
    logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}

// PATCH /api/integrations/[id] - atualiza integracao
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const existing = await prisma.integration.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })

  const name = body?.name !== undefined ? asTrimmedString(body.name) : undefined
  const description = body?.description !== undefined ? asTrimmedString(body.description) : undefined
  const baseUrl = body?.baseUrl !== undefined ? normalizeBaseUrl(body.baseUrl) : undefined

  const incomingStatus = body?.status
  if (incomingStatus !== undefined && (!incomingStatus || !ALLOWED_STATUS.has(incomingStatus as IntegrationStatus))) {
    return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
  }

  const nextStatus = (incomingStatus as IntegrationStatus | undefined) ?? existing.status
  const nextBaseUrl = baseUrl !== undefined ? baseUrl : existing.baseUrl
  const existingConfig = parseStoredConfig(existing.configEncrypted)
  const incomingConfig = body?.config !== undefined ? body.config : undefined
  const mergedConfig: SankhyaConfig = incomingConfig !== undefined ? mergeConfig(existingConfig, incomingConfig) : existingConfig

  if (nextBaseUrl && !isValidHttpUrl(nextBaseUrl)) {
    return NextResponse.json({ error: 'A URL da API deve iniciar com http:// ou https://.' }, { status: 400 })
  }

  if (existing.provider === 'sankhya') {
    const validationError = validateSankhyaConfiguration(nextBaseUrl, mergedConfig, nextStatus)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const updated = await prisma.integration.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name ?? existing.name }),
      ...(description !== undefined && { description }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(incomingStatus !== undefined && { status: incomingStatus as IntegrationStatus }),
      ...(incomingConfig !== undefined && { configEncrypted: serializeConfig(mergedConfig) }),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      module: 'integrations',
      action: 'INTEGRATION_UPDATED',
      entityType: 'Integration',
      entityId: id,
      newData: { name: updated.name, status: updated.status, provider: updated.provider },
    },
  })

  return NextResponse.json({ integration: { ...updated, config: mergedConfig } })
}

// DELETE /api/integrations/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.integration.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Integracao nao encontrada.' }, { status: 404 })

  await prisma.integration.delete({ where: { id } })

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      module: 'integrations',
      action: 'INTEGRATION_DELETED',
      entityType: 'Integration',
      entityId: id,
      oldData: { name: existing.name, provider: existing.provider },
    },
  })

  return NextResponse.json({ message: 'Integracao removida.' })
}
