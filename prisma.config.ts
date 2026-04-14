import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'prisma/config'

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf8')
  const parsed: Record<string, string> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}

function resolveFromProcessOrEnvFile(key: string) {
  const envFromProcess = process.env[key]
  if (envFromProcess && envFromProcess.trim().length > 0) return envFromProcess

  const cwd = process.cwd()
  const envLocal = parseEnvFile(join(cwd, '.env.local'))
  const env = parseEnvFile(join(cwd, '.env'))
  const fromFile = envLocal[key] || env[key]
  if (fromFile && fromFile.trim().length > 0) return fromFile
  return ''
}

function resolveDatabaseUrl() {
  const fromDefault = resolveFromProcessOrEnvFile('DATABASE_URL')
  if (fromDefault) return fromDefault

  const fromFallback = resolveFromProcessOrEnvFile('POSTGRES_PRISMA_URL')
  if (fromFallback) return fromFallback

  throw new Error(
    'DATABASE_URL não encontrado. Configure em .env.local, .env ou variável de ambiente.'
  )
}

function resolveDirectDatabaseUrl() {
  const direct = resolveFromProcessOrEnvFile('DIRECT_DATABASE_URL')
  if (direct) return direct
  const directAlias = resolveFromProcessOrEnvFile('DIRECT_URL')
  if (directAlias) return directAlias
  return ''
}

function shouldUseDirectUrlForCurrentCommand() {
  const args = process.argv.join(' ').toLowerCase()
  return args.includes('migrate')
}

const databaseUrl = resolveDatabaseUrl()
const directDatabaseUrl = resolveDirectDatabaseUrl()
const finalDatasourceUrl =
  shouldUseDirectUrlForCurrentCommand() && directDatabaseUrl
    ? directDatabaseUrl
    : databaseUrl

export default defineConfig({
  datasource: {
    url: finalDatasourceUrl,
  },
})
