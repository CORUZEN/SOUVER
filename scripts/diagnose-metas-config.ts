/**
 * Script de diagnóstico para investigar configuração de metas.
 * Executar: npx tsx scripts/diagnose-metas-config.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../src/lib/prisma'

async function main() {
  const configRow = await prisma.metasConfig.findUnique({ where: { scopeKey: '1' } })
  if (!configRow) {
    console.log('❌ Nenhuma configuração de metas encontrada (scopeKey: 1)')
    process.exit(1)
  }

  const metaConfigs = (configRow.metaConfigs as Record<string, unknown> | null) ?? {}

  // Descobrir todos os períodos configurados
  const periods = Object.keys(metaConfigs).filter((k) => {
    const val = metaConfigs[k] as Record<string, unknown> | null
    return val && Array.isArray(val.ruleBlocks)
  })

  if (periods.length === 0) {
    console.log('❌ Nenhum período com ruleBlocks encontrado')
    process.exit(1)
  }

  console.log(`📅 Períodos encontrados: ${periods.join(', ')}\n`)

  for (const period of periods.sort()) {
    const cfg = metaConfigs[period] as {
      ruleBlocks?: Array<{
        id?: string
        name?: string
        title?: string
        monthlyTarget?: number
        sellerIds?: string[]
        weightTargets?: Array<{ brand?: string; targetKg?: number }>
        manualFinancialByPeriod?: Record<string, number>
      }>
    }

    const ruleBlocks = cfg.ruleBlocks ?? []
    console.log(`═══ PERÍODO: ${period} (${ruleBlocks.length} bloco(s)) ═══`)

    // Map de vendedor → blocos
    const sellerToBlocks = new Map<string, { blockIndex: number; blockName: string; target: number; weightTotal: number }[]>()

    for (let i = 0; i < ruleBlocks.length; i++) {
      const block = ruleBlocks[i]
      const name = block.title || block.name || `Bloco ${i + 1}`
      const target = Number(block.monthlyTarget ?? 0)
      const weightTotal = (block.weightTargets ?? []).reduce((sum, wt) => sum + Number(wt.targetKg ?? 0), 0)
      const sellerIds = block.sellerIds ?? []
      const isGeneric = sellerIds.length === 0

      console.log(`\n  [${i}] ${name}${isGeneric ? ' (GENÉRICO)' : ''}`)
      console.log(`      Meta financeira: ${target > 0 ? `R$ ${target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '0'}`)
      console.log(`      Meta peso total: ${weightTotal > 0 ? `${weightTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg` : '0 kg'}`)
      console.log(`      Vendedores: ${sellerIds.length > 0 ? sellerIds.join(', ') : '(nenhum — genérico)'}`)

      const manualMap = block.manualFinancialByPeriod ?? {}
      const manualKeys = Object.keys(manualMap).filter((k) => Number(manualMap[k]) > 0)
      if (manualKeys.length > 0) {
        console.log(`      Valores manuais por período:`)
        for (const mk of manualKeys) {
          console.log(`        ${mk}: R$ ${Number(manualMap[mk]).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        }
      }

      for (const sid of sellerIds) {
        const list = sellerToBlocks.get(sid) ?? []
        list.push({ blockIndex: i, blockName: name, target, weightTotal })
        sellerToBlocks.set(sid, list)
      }
    }

    // Verificar duplicados
    console.log(`\n  ── Verificação de duplicatas ──`)
    let hasDuplicates = false
    for (const [sellerId, blocks] of sellerToBlocks) {
      if (blocks.length > 1) {
        hasDuplicates = true
        console.log(`    ⚠️  VENDEDOR DUPLICADO: ${sellerId}`)
        for (const b of blocks) {
          console.log(`       → [${b.blockIndex}] ${b.blockName} | Meta: R$ ${b.target.toLocaleString('pt-BR')} | Peso: ${b.weightTotal.toLocaleString('pt-BR')} kg`)
        }
      }
    }
    if (!hasDuplicates) {
      console.log(`    ✅ Nenhum vendedor em múltiplos blocos`)
    }

    console.log('\n')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
