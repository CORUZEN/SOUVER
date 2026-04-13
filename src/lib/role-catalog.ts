import type { PrismaClient } from '@prisma/client'

export interface RoleCatalogItem {
  name: string
  code: string
  description: string
}

export const ROLE_CATALOG: RoleCatalogItem[] = [
  { name: 'Analista de TI', code: 'IT_ANALYST', description: 'Analista de Tecnologia da Informação' },
  { name: 'Diretoria', code: 'DIRECTORATE', description: 'Gestão executiva e visão estratégica corporativa' },
  { name: 'Gerente Comercial', code: 'COMMERCIAL_MANAGER', description: 'Gestão de vendas e estratégia comercial' },
  { name: 'Gerente de Logística', code: 'LOGISTICS_MANAGER', description: 'Gestão das operações de logística e distribuição' },
  { name: 'Desenvolvedor', code: 'DEVELOPER', description: 'Administrador geral do sistema com acesso completo' },
  { name: 'Qualidade', code: 'QUALITY', description: 'Gestão e inspeção de qualidade' },
  { name: 'Auditoria', code: 'AUDIT', description: 'Auditoria, conformidade e rastreabilidade de processos' },
  { name: 'Recursos Humanos', code: 'HR', description: 'Gestão de pessoas e rotinas de RH' },
  { name: 'Contabilidade', code: 'ACCOUNTING', description: 'Financeiro e contábil' },
  { name: 'Produção', code: 'PRODUCTION', description: 'Operação e controle de produção' },
  { name: 'Assistente de Logística', code: 'LOGISTICS_ASSISTANT', description: 'Suporte operacional à logística' },
]

export const ROLE_CATALOG_CODES = ROLE_CATALOG.map((role) => role.code)

export function sortRolesByCatalogOrder<T extends { code: string }>(roles: T[]): T[] {
  const codeOrder = new Map(ROLE_CATALOG_CODES.map((code, index) => [code, index]))
  return [...roles].sort((a, b) => (codeOrder.get(a.code) ?? 999) - (codeOrder.get(b.code) ?? 999))
}

export async function ensureRoleCatalog(prisma: PrismaClient): Promise<void> {
  for (const role of ROLE_CATALOG) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    })
  }
}
