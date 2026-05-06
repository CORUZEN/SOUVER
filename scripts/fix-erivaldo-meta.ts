/**
 * Script de correção: zera as metas (financeira e peso) do vendedor Erivaldo Ferreira
 * no banco LOCAL do SOUVER (Prisma). NÃO afeta o Sankhya.
 *
 * ⚠️  ATENÇÃO (06/05/2026): zerar weightTargets aqui afeta o PWA, pois antes da
 * correção o PWA não fazia fallback para Sankhya nos weight targets. Agora o PWA
 * já consome sankhya-targets para peso também, mas este script ainda pode causar
 * divergência temporária até o cache expirar (até 5 min).
 * Se o objetivo for apenas zerar a meta FINANCEIRA, comente a seção de weightTargets.
 *
 * Executar: npx tsx scripts/fix-erivaldo-meta.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../src/lib/prisma'

const SELLER_ID = 'sankhya-35'
const SELLER_NAME = 'ERIVALDO FERREIRA'
const SCOPE_KEY = '1'

async function main() {
  console.log('🔧 Correção de metas — Erivaldo Ferreira')
  console.log('   Vendedor:', SELLER_ID)
  console.log('   Banco:    LOCAL (Prisma / MetasConfig)')
  console.log('   Sankhya:  NÃO SERÁ ALTERADO\n')

  const configRow = await prisma.metasConfig.findUnique({ where: { scopeKey: SCOPE_KEY } })
  if (!configRow) {
    console.error('❌ Configuração não encontrada (scopeKey:', SCOPE_KEY + ')')
    process.exit(1)
  }

  const metaConfigs = (configRow.metaConfigs as Record<string, unknown> | null) ?? {}
  const periods = Object.keys(metaConfigs).filter((k) => {
    const val = metaConfigs[k] as Record<string, unknown> | null
    return val && Array.isArray((val as { ruleBlocks?: unknown[] }).ruleBlocks)
  })

  if (periods.length === 0) {
    console.error('❌ Nenhum período com ruleBlocks encontrado')
    process.exit(1)
  }

  let changed = false
  const updatedMetaConfigs = { ...metaConfigs }

  for (const period of periods) {
    const cfg = updatedMetaConfigs[period] as {
      ruleBlocks?: Array<{
        id?: string
        name?: string
        title?: string
        monthlyTarget?: number
        manualFinancialByPeriod?: Record<string, number>
        sellerIds?: string[]
        weightTargets?: Array<{
          id?: string
          brand?: string
          targetKg?: number
          manualKgByPeriod?: Record<string, number>
        }>
      }>
    }

    if (!cfg.ruleBlocks) continue

    for (let i = 0; i < cfg.ruleBlocks.length; i++) {
      const block = cfg.ruleBlocks[i]
      const hasSeller = block.sellerIds?.some((id) => {
        const normalized = String(id).replace(/^sankhya-/i, '').trim()
        return normalized === '35' || id === SELLER_ID
      })

      if (!hasSeller) continue

      console.log(`📅 Período: ${period}`)
      console.log(`   Bloco:   ${block.title || block.name || 'Sem nome'} (índice ${i})`)
      console.log(`   Antes:`)
      console.log(`     • Meta financeira: R$ ${(block.monthlyTarget ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      console.log(`     • Meta peso total: ${(block.weightTargets ?? []).reduce((s, w) => s + (w.targetKg ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg`)
      console.log(`     • Vendedores:      ${(block.sellerIds ?? []).join(', ')}`)

      // Zerar meta financeira
      const oldMonthlyTarget = block.monthlyTarget
      block.monthlyTarget = 0

      // Remover manualFinancialByPeriod
      const hadManualFinancial = block.manualFinancialByPeriod && Object.keys(block.manualFinancialByPeriod).length > 0
      if (hadManualFinancial) {
        console.log(`     • manualFinancialByPeriod: ${JSON.stringify(block.manualFinancialByPeriod)} (será removido)`)
        block.manualFinancialByPeriod = {}
      }

      // Zerar metas de peso
      const hadWeightTargets = (block.weightTargets ?? []).length > 0
      if (hadWeightTargets) {
        block.weightTargets = (block.weightTargets ?? []).map((wt) => ({
          ...wt,
          targetKg: 0,
          manualKgByPeriod: {},
        }))
      }

      console.log(`   Depois:`)
      console.log(`     • Meta financeira: R$ 0,00`)
      console.log(`     • Meta peso total: 0,00 kg`)
      if (hadWeightTargets) {
        console.log(`     • Grupos de peso:  ${block.weightTargets.length} (todos zerados)`)
      }
      console.log('')
      changed = true
    }
  }

  if (!changed) {
    console.log('⚠️  Nenhum bloco encontrado contendo o vendedor', SELLER_ID)
    console.log('   Verifique se o código do vendedor está correto.')
    await prisma.$disconnect()
    process.exit(0)
  }

  // Salvar no banco
  console.log('💾 Salvando alterações no banco local...')
  await prisma.metasConfig.update({
    where: { scopeKey: SCOPE_KEY },
    data: {
      metaConfigs: updatedMetaConfigs,
      updatedByLogin: 'script-fix-erivaldo',
    },
  })

  console.log('✅ Alterações salvas com sucesso!')
  console.log('')
  console.log('📌 Próximos passos:')
  console.log('   1. Acesse a tela Metas → Grupos de parâmetros por vendedor')
  console.log('   2. Selecione "ERIVALDO FERREIRA" e confirme que as metas estão 0')
  console.log('   3. Recarregue o PWA (pull-to-refresh) para ver a mudança')
  console.log('   4. O cache do PWA dura até 3 minutos')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ Erro:', e)
  process.exit(1)
})
