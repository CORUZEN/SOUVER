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

const ALLOWED_PROVIDERS = new Set(['sankhya', 'erp', 'api_custom', 'webhook', 'sftp', 'slack', 'email'])
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

// GET /api/integrations - lista todas as integracoes com contagem de logs
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const integrations = await prisma.integration.findMany({
    include: {
      _count: { select: { logs: true } },
      logs: {
        orderBy: { executedAt: 'desc' },
        take: 1,
        select: { status: true, message: true, executedAt: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const enriched = integrations.map((integration) => {
    const config = parseStoredConfig(integration.configEncrypted)
    const hasCredentials = Boolean((config.username && config.password) || config.token || config.clientId)

    return {
      ...integration,
      configSummary: {
        authMode: config.authMode ?? 'BASIC',
        companyCode: config.companyCode ?? null,
        hasCredentials,
      },
    }
  })

  return NextResponse.json({ integrations: enriched })
}

// POST /api/integrations - cria nova integracao
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const name = asTrimmedString(body?.name)
  const provider = asTrimmedString(body?.provider)?.toLowerCase()
  const description = asTrimmedString(body?.description)
  const baseUrl = normalizeBaseUrl(body?.baseUrl)
  const config = sanitizeConfig(body?.config)

  const requestedStatus = body?.status
  const status: IntegrationStatus =
    typeof requestedStatus === 'string' && ALLOWED_STATUS.has(requestedStatus as IntegrationStatus)
      ? (requestedStatus as IntegrationStatus)
      : 'INACTIVE'

  if (!name || !provider) {
    return NextResponse.json({ error: 'Nome e provedor sao obrigatorios.' }, { status: 400 })
  }

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Provedor de integracao invalido.' }, { status: 400 })
  }

  if (baseUrl && !isValidHttpUrl(baseUrl)) {
    return NextResponse.json({ error: 'A URL da API deve iniciar com http:// ou https://.' }, { status: 400 })
  }

  if (provider === 'sankhya') {
    const validationError = validateSankhyaConfiguration(baseUrl, config, status)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const integration = await prisma.integration.create({
    data: {
      name,
      provider,
      description,
      baseUrl,
      configEncrypted: JSON.stringify(config),
      status,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      module: 'integrations',
      action: 'INTEGRATION_CREATED',
      entityType: 'Integration',
      entityId: integration.id,
      newData: { name: integration.name, provider: integration.provider, status: integration.status },
    },
  })

  return NextResponse.json({ integration }, { status: 201 })
}
