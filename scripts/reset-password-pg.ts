import { Client } from 'pg'
import bcrypt from 'bcrypt'

function parseEnvFile(filePath: string): Record<string, string> {
  const fs = require('fs')
  if (!fs.existsSync(filePath)) return {}
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    parsed[match[1]] = value
  }
  return parsed
}

function getEnv(key: string): string {
  const fromProcess = process.env[key]
  if (fromProcess) return fromProcess
  const envLocal = parseEnvFile('.env.local')
  const env = parseEnvFile('.env')
  return envLocal[key] || env[key] || ''
}

function parseConnectionString(raw: string) {
  const url = new URL(raw)
  url.searchParams.delete('channel_binding')
  const sslmode = url.searchParams.get('sslmode')
  url.searchParams.delete('sslmode')
  return {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.replace(/^\//, ''),
    user: url.username,
    password: url.password,
    ssl: sslmode === 'require' ? { rejectUnauthorized: false } : false,
  }
}

async function main() {
  const loginOrEmail = process.argv[2]
  const newPassword = process.argv[3]

  if (!loginOrEmail || !newPassword) {
    console.error('Uso: npx tsx scripts/reset-password-pg.ts <login-ou-email> <nova-senha>')
    process.exit(1)
  }

  const dbUrl = getEnv('DATABASE_URL')
  if (!dbUrl) {
    console.error('DATABASE_URL não encontrado')
    process.exit(1)
  }

  const config = parseConnectionString(dbUrl)
  const client = new Client(config)
  await client.connect()

  const userRes = await client.query(
    `SELECT id, login, email, full_name FROM users WHERE login = $1 OR email = $1 LIMIT 1`,
    [loginOrEmail]
  )

  if (userRes.rowCount === 0) {
    console.error(`Usuário não encontrado: ${loginOrEmail}`)
    await client.end()
    process.exit(1)
  }

  const user = userRes.rows[0]
  const passwordHash = await bcrypt.hash(newPassword, 12)

  await client.query(
    `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
    [passwordHash, user.id]
  )

  await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.id])

  // Desbloqueia removendo falhas recentes (últimos 30 min)
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)
  await client.query(
    `DELETE FROM audit_logs WHERE user_id = $1 AND action = 'LOGIN_FAILED' AND created_at >= $2`,
    [user.id, cutoff]
  )

  await client.end()

  console.log(`✅ Senha alterada com sucesso para: ${user.login} (${user.email})`)
  console.log('🔒 Todas as sessões foram encerradas e tentativas falhas removidas.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
