import { prisma } from '@/lib/prisma'

interface AuditLogInput {
  userId?: string
  module: string
  entityType?: string
  entityId?: string
  action: string
  oldData?: unknown
  newData?: unknown
  description?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Registra uma entrada na trilha de auditoria.
 * Nunca lança exceção — erros de log não devem interromper o fluxo do sistema.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        action: input.action,
        oldData: input.oldData ? (input.oldData as object) : undefined,
        newData: input.newData ? (input.newData as object) : undefined,
        description: input.description ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    console.error('[AUDIT_LOG] Falha ao registrar entrada de auditoria:', error)
  }
}
