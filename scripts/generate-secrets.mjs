/**
 * Script para gerar secrets seguros para o SOUVER.
 *
 * Execute com:
 *   node scripts/generate-secrets.mjs
 *
 * Copie os valores gerados para o painel da Vercel
 * ou para o arquivo .env.local (nunca comite no Git).
 */

import crypto from 'crypto'

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url')
}

const jwtSecret = generateSecret(64)
const jwtSecretLegacy = generateSecret(64)
const nextAuthSecret = generateSecret(32)
const cronSecret = generateSecret(32)

console.log('\n╔════════════════════════════════════════════════════════════════╗')
console.log('║         SOUVER — Gerador de Secrets de Segurança             ║')
console.log('╠════════════════════════════════════════════════════════════════╣')
console.log('║  ⚠️  NUNCA comite estes valores no Git!                      ║')
console.log('║  Copie para .env.local (dev) ou painel Vercel (produção).   ║')
console.log('╚════════════════════════════════════════════════════════════════╝\n')

console.log('JWT_SECRET=' + jwtSecret)
console.log('')
console.log('JWT_SECRET_LEGACY=' + jwtSecretLegacy)
console.log('  # ← use apenas durante transição de chave (opcional)')
console.log('')
console.log('NEXTAUTH_SECRET=' + nextAuthSecret)
console.log('  # ← legado, pode ser removido se não usar NextAuth')
console.log('')
console.log('CRON_SECRET=' + cronSecret)
console.log('')

console.log('────────────────────────────────────────────────────────────────')
console.log('📋 Instruções de troca segura de JWT_SECRET:')
console.log('────────────────────────────────────────────────────────────────')
console.log('1. Copie JWT_SECRET (nova chave) para as variáveis de ambiente')
console.log('2. Copie JWT_SECRET_LEGACY (chave ANTIGA) para o mesmo lugar')
console.log('3. Faça deploy')
console.log('4. O sistema aceita tokens assinados com AMBAS as chaves')
console.log('5. Aguarde 30 dias (tempo máximo do refresh token)')
console.log('6. Remova JWT_SECRET_LEGACY das variáveis de ambiente')
console.log('7. Faça novo deploy')
console.log('────────────────────────────────────────────────────────────────\n')
