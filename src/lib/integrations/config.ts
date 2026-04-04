import crypto from 'crypto'

export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'
export type SankhyaAuthMode = 'BASIC' | 'OAUTH2'

export interface SankhyaConfig {
  companyCode?: string | null
  username?: string | null
  password?: string | null
  appKey?: string | null
  token?: string | null
  clientId?: string | null
  clientSecret?: string | null
  authMode?: SankhyaAuthMode | null
}

const ENCRYPTED_PREFIX = 'enc:v1'

function getEncryptionKey(): Buffer | null {
  const secret = process.env.INTEGRATION_CONFIG_SECRET
  if (!secret || secret.trim().length === 0) return null
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptConfig(raw: string): string {
  const key = getEncryptionKey()
  if (!key) return raw

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENCRYPTED_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptConfig(raw: string): string | null {
  if (!raw.startsWith(`${ENCRYPTED_PREFIX}:`)) return raw
  const key = getEncryptionKey()
  if (!key) return null

  const parts = raw.split(':')
  if (parts.length !== 5) return null

  const [, , ivRaw, tagRaw, payloadRaw] = parts
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'))
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadRaw, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeBaseUrl(value: unknown): string | null {
  const parsed = asTrimmedString(value)
  if (!parsed) return null
  const withoutTrailingSlash = parsed.replace(/\/+$/, '')
  return withoutTrailingSlash.replace(/\/mge$/i, '')
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseStoredConfig(raw: string | null | undefined): SankhyaConfig {
  if (!raw) return {}

  const decrypted = decryptConfig(raw)
  if (!decrypted) return {}

  try {
    const parsed = JSON.parse(decrypted)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as SankhyaConfig
  } catch {
    return {}
  }
}

export function serializeConfig(config: SankhyaConfig): string {
  return encryptConfig(JSON.stringify(config))
}

export function sanitizeConfig(input: unknown): SankhyaConfig {
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
    appKey: asTrimmedString(source.appKey),
    token,
    clientId,
    clientSecret,
    authMode,
  }
}

function hasLegacyCredentials(config: SankhyaConfig) {
  return Boolean(config.username && config.password && config.appKey && config.token)
}

function hasOAuthCredentials(config: SankhyaConfig) {
  return Boolean(config.token && config.clientId && config.clientSecret)
}

export function validateSankhyaConfiguration(
  baseUrl: string | null,
  config: SankhyaConfig,
  status: IntegrationStatus
): string | null {
  if (!baseUrl) return 'A URL da API e obrigatoria para a integracao Sankhya.'
  if (!isValidHttpUrl(baseUrl)) return 'A URL da API deve iniciar com http:// ou https://.'
  if (/\/mge\/?$/i.test(baseUrl)) return 'Informe a URL do servidor SankhyaW sem /mge/ no final.'

  if (status !== 'ACTIVE') return null

  const mode = config.authMode ?? 'OAUTH2'
  if (mode === 'OAUTH2' && !hasOAuthCredentials(config)) {
    return 'Para ativar em OAuth2, informe token, client_id e client_secret.'
  }

  if (mode === 'BASIC' && !hasLegacyCredentials(config)) {
    return 'Para ativar em modo legado, informe usuario, senha, appKey e token.'
  }

  return null
}

export function summarizeConfig(config: SankhyaConfig) {
  return {
    authMode: config.authMode ?? 'BASIC',
    companyCode: config.companyCode ?? null,
    hasCredentials: Boolean(
      (config.username && config.password) ||
      (config.token && config.clientId && config.clientSecret) ||
      (config.username && config.password && config.appKey && config.token)
    ),
    hasPassword: Boolean(config.password),
    hasToken: Boolean(config.token),
    hasClientSecret: Boolean(config.clientSecret),
    hasAppKey: Boolean(config.appKey),
  }
}
