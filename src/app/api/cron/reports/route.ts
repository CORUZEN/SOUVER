import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'

/**
 * GET /api/cron/reports
 *
 * Endpoint invocado pelo Vercel Cron diariamente às 07h.
 * Gera um resumo operacional do dia anterior e envia notificações para
 * usuários com perfis ADMIN, GERENTE e MANAGER.
 *
 * Segurança: verificação do cabeçalho Authorization do Vercel Cron.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron assina a requisição com o secret em Authorization Bearer
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  const now      = new Date()
  const today    = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  try {
    // ── Resumo do dia anterior ──────────────────────────────────────────────
    const [batchesYesterday, movementsYesterday, ncsYesterday, approvedRecords] = await Promise.all([
      prisma.productionBatch.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.inventoryMovement.count({
        where: { movedAt: { gte: yesterday, lt: today } },
      }),
      prisma.nonConformance.count({
        where: { openedAt: { gte: yesterday, lt: today } },
      }),
      prisma.qualityRecord.count({
        where: { result: 'APPROVED', inspectedAt: { gte: yesterday, lt: today } },
      }),
    ])

    const lowStockItems = await prisma.inventoryItem.count({
      where: {
        isActive: true,
        minQty: { not: null },
      },
    })

    // Itens com estoque < mínimo (filtrado em memória para Prisma Decimal)
    const lowStockCandidates = await prisma.inventoryItem.findMany({
      where: { isActive: true, minQty: { not: null } },
      select: { currentQty: true, minQty: true, name: true },
    })
    const actualLowStock = lowStockCandidates.filter(
      (i: { currentQty: unknown; minQty: unknown }) => Number(i.currentQty) <= Number(i.minQty)
    )

    const dateLabel = yesterday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const message = [
      `📊 Resumo ${dateLabel}:`,
      `• ${batchesYesterday} lote(s) criado(s)`,
      `• ${movementsYesterday} movimentação(ões) de estoque`,
      `• ${ncsYesterday} NC(s) abertas`,
      `• ${approvedRecords} inspeção(ões) aprovada(s)`,
      actualLowStock.length > 0
        ? `⚠️ ${actualLowStock.length} item(ns) com estoque abaixo do mínimo`
        : '✅ Todos os itens acima do estoque mínimo',
    ].join('\n')

    // ── Enviar notificação para ADMIN / GERENTE / MANAGER ─────────────────
    const adminUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role:   { code: { in: ['ADMIN', 'GERENTE', 'MANAGER', 'SUPERVISOR'] } },
      },
      select: { id: true },
    })

    if (adminUsers.length > 0) {
      await prisma.notification.createMany({
        data: adminUsers.map((u: { id: string }) => ({
          userId:  u.id,
          type:    'DAILY_REPORT',
          title:   `Resumo diário — ${dateLabel}`,
          message,
          module:  'reports',
          link:    '/relatorios',
          isRead:  false,
        })),
      })
    }

    // ── Auditoria ──────────────────────────────────────────────────────────
    await auditLog({
      module:      'reports',
      action:      'SCHEDULED_REPORT',
      description: `Relatório diário gerado automaticamente para ${dateLabel}. ${adminUsers.length} notificação(ões) enviada(s).`,
    })

    return NextResponse.json({
      ok:            true,
      date:          dateLabel,
      notified:      adminUsers.length,
      summary: {
        batches:       batchesYesterday,
        movements:     movementsYesterday,
        ncs:           ncsYesterday,
        approvedQA:    approvedRecords,
        lowStockItems: actualLowStock.length,
        totalMonitored: lowStockItems,
      },
    })
  } catch (err) {
    console.error('[cron/reports]', err)
    return NextResponse.json({ error: 'Falha ao gerar relatório agendado' }, { status: 500 })
  }
}
