/**
 * Registro central de handlers de eventos de domínio.
 *
 * Importar este módulo uma vez (ex: no layout raiz) para que os handlers
 * fiquem registrados durante o ciclo de vida da aplicação.
 */

import { eventBus } from './events'
import { jobQueue, JOB_TYPES } from './jobs'

// ─── Produção ──────────────────────────────────────────────────

eventBus.on<{ batchId: string; userId: string }>('production:batch.finished', (payload) => {
  // Gera automaticamente um relatório de produção ao finalizar lote
  jobQueue.enqueue(JOB_TYPES.GENERATE_PDF, {
    reportType: 'batch_summary',
    batchId: payload.batchId,
    requestedBy: payload.userId,
  })
  console.log(`[Events] Batch ${payload.batchId} finished → queued PDF report`)
})

eventBus.on<{ batchId: string; userId: string }>('production:batch.cancelled', (payload) => {
  console.log(`[Events] Batch ${payload.batchId} cancelled by ${payload.userId}`)
})

// ─── Logística ──────────────────────────────────────────────────

eventBus.on<{ itemId: string; currentQty: number; minQty: number }>(
  'inventory:item.low_stock',
  (payload) => {
    // Enfileira notificação em massa para o setor de logística
    jobQueue.enqueue(JOB_TYPES.BULK_NOTIFICATION, {
      role: 'LOGISTICS',
      type: 'LOW_STOCK',
      title: `Estoque baixo — Item ${payload.itemId}`,
      message: `Quantidade atual: ${payload.currentQty}. Mínimo: ${payload.minQty}.`,
      module: 'inventory',
    })
    console.log(`[Events] Low stock alert for item ${payload.itemId}`)
  }
)

// ─── Qualidade ──────────────────────────────────────────────────

eventBus.on<{ ncId: string; severity: string; userId: string }>(
  'quality:nc.opened',
  (payload) => {
    if (payload.severity === 'CRITICAL') {
      // NC crítica → gerar PDF imediato do relatório
      jobQueue.enqueue(JOB_TYPES.GENERATE_PDF, {
        reportType: 'nc_critical',
        ncId: payload.ncId,
        requestedBy: payload.userId,
      })
      console.log(`[Events] Critical NC ${payload.ncId} → queued PDF report`)
    }
  }
)

// ─── Sistema ────────────────────────────────────────────────────

eventBus.on<{ totalDeleted: number }>('system:cleanup.completed', (payload) => {
  console.log(`[Events] Cleanup completed — ${payload.totalDeleted} records removed`)
})

eventBus.on<{ reportType: string }>('system:report.generated', (payload) => {
  console.log(`[Events] Report generated: ${payload.reportType}`)
})

// ─── Job Handlers ───────────────────────────────────────────────

jobQueue.register(JOB_TYPES.GENERATE_PDF, async (payload: unknown) => {
  const data = payload as { reportType: string; batchId?: string; ncId?: string; requestedBy?: string }
  // Simulação de geração pesada — em produção chamaria jsPDF/puppeteer
  console.log(`[Job] Generating PDF: ${data.reportType} for batch=${data.batchId ?? 'N/A'}, nc=${data.ncId ?? 'N/A'}`)
  // await generatePdfReport(data) — integrar com lib/reports quando disponível
})

jobQueue.register(JOB_TYPES.EXPORT_REPORT, async (payload: unknown) => {
  const data = payload as { format: string; module: string; filters?: Record<string, unknown>; requestedBy?: string }
  console.log(`[Job] Exporting ${data.format} report for module ${data.module}`)
  // await exportModuleData(data) — integrar com processamento de xlsx/csv
})

jobQueue.register(JOB_TYPES.BULK_NOTIFICATION, async (payload: unknown) => {
  const data = payload as { role: string; type: string; title: string; message: string; module: string }
  console.log(`[Job] Sending bulk notification to role ${data.role}: ${data.title}`)
  // createNotificationsForRole já existe — poderia ser chamado aqui se importado
})

jobQueue.register(JOB_TYPES.INTEGRATION_SYNC, async (payload: unknown) => {
  const data = payload as { integrationId: string; provider: string }
  console.log(`[Job] Syncing integration ${data.integrationId} (${data.provider})`)
})

jobQueue.register(JOB_TYPES.AUDIT_ARCHIVE, async (payload: unknown) => {
  const data = payload as { olderThanDays: number }
  console.log(`[Job] Archiving audit logs older than ${data.olderThanDays} days`)
})

console.log('[EventHandlers] Domain event handlers registered')
console.log('[EventHandlers] Job handlers registered:', Object.values(JOB_TYPES).join(', '))
