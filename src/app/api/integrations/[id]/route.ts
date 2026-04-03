import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'

interface SankhyaConfig {
  companyCode?: string | null
  username?: string | null
  password?: string | null
  token?: string | null
  clientId?: string | null
  clientSecret?: string | null
  authMode?: 'BASIC' | 'OAUTH2' | null
}

const ALLOWED_STATUS = new Set<IntegrationStatus>(['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING'])

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeBaseUrl(value: unknown): string | null {
  const parsed = asTrimmedString(value)
  if (!parsed) return null
  return parsed.replace(/\/+$/, '')
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function parseStoredConfig(raw: string | null | undefined): SankhyaConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as SankhyaConfig
  } catch {
    return {}
  }
}

function sanitizeConfig(input: unknown): SankhyaConfig {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const token = asTrimmedString(source.token)
  const clientId = asTrimmedString(source.clientId)
  const clientSecret = asTrimmedString(source.clientSecret)

  const authMode: SankhyaConfig['authMode'] =
    source.authMode === 'BASIC' || source.authMode === 'OAUTH2'
      ? source.authMode
      : (token || clientId || clientSecret ? 'OAUTH2' : 'BASIC')

  return {
    companyCode: asTrimmedString(source.companyCode),
    username: asTrimmedString(source.username),
    password: asTrimmedString(source.password),
    token,
    clientId,
    clientSecret,
    authMode,
  }
}

function validateSankhyaConfiguration(baseUrl: string | null, config: SankhyaConfig, status: IntegrationStatus): string | null {
  if (!baseUrl) return 'A URL da API e obrigatoria para a integracao Sankhya.'
  if (!isValidHttpUrl(baseUrl)) return 'A URL da API deve iniciar com http:// ou https://.'

  if (status === 'ACTIVE' && (!config.username || !config.password)) {
    return 'Para ativar a integracao Sankhya, informe usuario e senha da API.'
  }

  return null
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

  return NextResponse.json({
    integration: {
      ...integration,
      config,
      configSummary: {
        authMode: config.authMode ?? 'BASIC',
        companyCode: config.companyCode ?? null,
        hasCredentials: Boolean((config.username && config.password) || config.token || config.clientId),
      },
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
  const incomingConfig = body?.config !== undefined ? sanitizeConfig(body.config) : undefined
  const mergedConfig: SankhyaConfig = incomingConfig ? { ...existingConfig, ...incomingConfig } : existingConfig

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
      ...(incomingConfig !== undefined && { configEncrypted: JSON.stringify(mergedConfig) }),
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
