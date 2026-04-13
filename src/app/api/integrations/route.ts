import { NextRequest, NextResponse } from 'next/server'
import { canAccessIntegrations, getAuthUser } from '@/lib/auth/permissions'
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
} from '@/lib/integrations/config'

const ALLOWED_PROVIDERS = new Set(['sankhya', 'erp', 'api_custom', 'webhook', 'sftp', 'slack', 'email'])
const ALLOWED_STATUS = new Set<IntegrationStatus>(['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING'])

// GET /api/integrations - lista todas as integracoes com contagem de logs
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (!(await canAccessIntegrations(user))) {
    return NextResponse.json({ error: 'Sem permissao para acessar Integracoes.' }, { status: 403 })
  }

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

  const enriched = integrations.map((integration: any) => {
    const config = parseStoredConfig(integration.configEncrypted)

    return {
      ...integration,
      configSummary: summarizeConfig(config),
    }
  })

  return NextResponse.json({ integrations: enriched })
}

// POST /api/integrations - cria nova integracao
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (!(await canAccessIntegrations(user))) {
    return NextResponse.json({ error: 'Sem permissao para acessar Integracoes.' }, { status: 403 })
  }

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
      configEncrypted: serializeConfig(config),
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

