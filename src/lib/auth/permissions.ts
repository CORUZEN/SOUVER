import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { ROLE_CATALOG_CODES } from '@/lib/role-catalog'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from './session'

/** Retorna usuário autenticado a partir do request, ou null */
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('souver_token')?.value
  if (!token) return null
  return getCurrentUser(token)
}

export const METAS_PERMISSION_CODES = {
  CONFIG_VIEW: 'metas_config:read',
  CONFIG_EDIT: 'metas_config:edit',
  CONFIG_SAVE: 'metas_config:save',
  CONFIG_REMOVE: 'metas_config:delete',
  SELLERS_VIEW: 'metas_sellers:read',
  SELLERS_EDIT: 'metas_sellers:edit',
  SELLERS_SAVE: 'metas_sellers:save',
  SELLERS_REMOVE: 'metas_sellers:delete',
  PRODUCTS_VIEW: 'metas_products:read',
  PRODUCTS_EDIT: 'metas_products:edit',
  PRODUCTS_SAVE: 'metas_products:save',
  PRODUCTS_REMOVE: 'metas_products:delete',
} as const

const METAS_PERMISSION_DEFINITIONS = [
  {
    module: 'metas_config',
    action: 'read',
    code: METAS_PERMISSION_CODES.CONFIG_VIEW,
    description: 'Capacidade de acessar e visualizar a tela de configurações do painel de metas.',
  },
  {
    module: 'metas_config',
    action: 'edit',
    code: METAS_PERMISSION_CODES.CONFIG_EDIT,
    description: 'Capacidade de editar dados na tela de configurações do painel de metas.',
  },
  {
    module: 'metas_config',
    action: 'save',
    code: METAS_PERMISSION_CODES.CONFIG_SAVE,
    description: 'Capacidade de salvar alterações na tela de configurações do painel de metas.',
  },
  {
    module: 'metas_config',
    action: 'delete',
    code: METAS_PERMISSION_CODES.CONFIG_REMOVE,
    description: 'Capacidade de excluir/remover dados na tela de configurações do painel de metas.',
  },
  {
    module: 'metas_sellers',
    action: 'read',
    code: METAS_PERMISSION_CODES.SELLERS_VIEW,
    description: 'Capacidade de acessar e visualizar a tela de vendedores do painel de metas.',
  },
  {
    module: 'metas_sellers',
    action: 'edit',
    code: METAS_PERMISSION_CODES.SELLERS_EDIT,
    description: 'Capacidade de editar dados na tela de vendedores do painel de metas.',
  },
  {
    module: 'metas_sellers',
    action: 'save',
    code: METAS_PERMISSION_CODES.SELLERS_SAVE,
    description: 'Capacidade de salvar alterações na tela de vendedores do painel de metas.',
  },
  {
    module: 'metas_sellers',
    action: 'delete',
    code: METAS_PERMISSION_CODES.SELLERS_REMOVE,
    description: 'Capacidade de excluir/remover dados na tela de vendedores do painel de metas.',
  },
  {
    module: 'metas_products',
    action: 'read',
    code: METAS_PERMISSION_CODES.PRODUCTS_VIEW,
    description: 'Capacidade de acessar e visualizar a tela de produtos do painel de metas.',
  },
  {
    module: 'metas_products',
    action: 'edit',
    code: METAS_PERMISSION_CODES.PRODUCTS_EDIT,
    description: 'Capacidade de editar dados na tela de produtos do painel de metas.',
  },
  {
    module: 'metas_products',
    action: 'save',
    code: METAS_PERMISSION_CODES.PRODUCTS_SAVE,
    description: 'Capacidade de salvar alterações na tela de produtos do painel de metas.',
  },
  {
    module: 'metas_products',
    action: 'delete',
    code: METAS_PERMISSION_CODES.PRODUCTS_REMOVE,
    description: 'Capacidade de excluir/remover dados na tela de produtos do painel de metas.',
  },
] as const

const ALL_METAS_CODES = Object.values(METAS_PERMISSION_CODES) as string[]

const METAS_READ_CODES = new Set<string>([
  METAS_PERMISSION_CODES.CONFIG_VIEW,
  METAS_PERMISSION_CODES.SELLERS_VIEW,
  METAS_PERMISSION_CODES.PRODUCTS_VIEW,
])

const METAS_MUTATE_CODES = new Set<string>(
  ALL_METAS_CODES.filter((code) => !METAS_READ_CODES.has(code))
)

let metasPermissionBootstrapDone = false
let metasPermissionBootstrapPromise: Promise<void> | null = null

async function bootstrapMetasPermissionCatalog() {
  for (const permission of METAS_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
      create: {
        module: permission.module,
        action: permission.action,
        code: permission.code,
        description: permission.description,
      },
    })
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: ROLE_CATALOG_CODES } },
      select: { id: true, code: true },
    }),
    prisma.permission.findMany({
      where: { code: { in: ALL_METAS_CODES } },
      select: { id: true, code: true },
    }),
  ])

  const permissionIdByCode = new Map(permissions.map((permission: { code: string; id: string }) => [permission.code, permission.id]))
  const readPermissionIds = [...METAS_READ_CODES]
    .map((code) => permissionIdByCode.get(code))
    .filter((id): id is string => Boolean(id))
  const mutatePermissionIds = [...METAS_MUTATE_CODES]
    .map((code) => permissionIdByCode.get(code))
    .filter((id): id is string => Boolean(id))

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const role of roles) {
      // COMMERCIAL_SUPERVISOR permissions are fully admin-controlled via gestao-permissoes.
      // Bootstrap must not interfere or re-add permissions that the admin removed.
      if (role.code === 'COMMERCIAL_SUPERVISOR') continue

      const permissionIds =
        role.code === 'DIRECTORATE'
          ? readPermissionIds
          : [...readPermissionIds, ...mutatePermissionIds]

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        })
      }

      if (role.code === 'DIRECTORATE' && mutatePermissionIds.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            permissionId: { in: mutatePermissionIds },
          },
        })
      }
    }
  })
}

export async function ensureMetasPermissionCatalog(): Promise<void> {
  if (metasPermissionBootstrapDone) return
  if (!metasPermissionBootstrapPromise) {
    metasPermissionBootstrapPromise = bootstrapMetasPermissionCatalog()
      .then(() => {
        metasPermissionBootstrapDone = true
      })
      .finally(() => {
        metasPermissionBootstrapPromise = null
      })
  }
  await metasPermissionBootstrapPromise
}

/** Verifica se um perfil possui determinada permissão. DEVELOPER tem acesso total. */
export async function hasPermission(
  roleId: string | null | undefined,
  permissionCode: string
): Promise<boolean> {
  if (!roleId) return false
  if (permissionCode.startsWith('metas_')) {
    await ensureMetasPermissionCatalog()
  }
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { code: true } })
  if (!role) return false
  if (role.code === 'DEVELOPER') return true
  const perm = await prisma.rolePermission.findFirst({
    where: { roleId, permission: { code: permissionCode } },
  })
  return !!perm
}

const INTEGRATIONS_ALLOWED_ROLE_CODES = new Set(['DEVELOPER', 'IT_ANALYST'])

// ── Module access permissions ───────────────────────────────────────────
// Controls visibility and access to sidebar menu items per role.
export const MODULE_PERMISSION_CODES = {
  PAINEL_EXECUTIVO: 'module_painel-executivo:access',
  METAS: 'module_metas:access',
  PRODUCAO: 'module_producao:access',
  LOGISTICA: 'module_logistica:access',
  QUALIDADE: 'module_qualidade:access',
  RH: 'module_rh:access',
  RELATORIOS: 'module_relatorios:access',
  CONTABILIDADE: 'module_contabilidade:access',
  COMUNICACAO: 'module_comunicacao:access',
  CONFIGURACOES: 'module_configuracoes:access',
  INTEGRACOES: 'module_integracoes:access',
} as const

const MODULE_PERMISSION_DEFINITIONS = [
  { module: 'module_painel-executivo', action: 'access', code: MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO, description: 'Acesso ao módulo Painel Executivo no menu lateral.' },
  { module: 'module_metas', action: 'access', code: MODULE_PERMISSION_CODES.METAS, description: 'Acesso ao módulo Metas no menu lateral.' },
  { module: 'module_producao', action: 'access', code: MODULE_PERMISSION_CODES.PRODUCAO, description: 'Acesso ao módulo Produção no menu lateral.' },
  { module: 'module_logistica', action: 'access', code: MODULE_PERMISSION_CODES.LOGISTICA, description: 'Acesso ao módulo Logística no menu lateral.' },
  { module: 'module_qualidade', action: 'access', code: MODULE_PERMISSION_CODES.QUALIDADE, description: 'Acesso ao módulo Qualidade no menu lateral.' },
  { module: 'module_rh', action: 'access', code: MODULE_PERMISSION_CODES.RH, description: 'Acesso ao módulo RH no menu lateral.' },
  { module: 'module_relatorios', action: 'access', code: MODULE_PERMISSION_CODES.RELATORIOS, description: 'Acesso ao módulo Relatórios no menu lateral.' },
  { module: 'module_contabilidade', action: 'access', code: MODULE_PERMISSION_CODES.CONTABILIDADE, description: 'Acesso ao módulo Contabilidade no menu lateral.' },
  { module: 'module_comunicacao', action: 'access', code: MODULE_PERMISSION_CODES.COMUNICACAO, description: 'Acesso ao módulo Comunicação no menu lateral.' },
  { module: 'module_configuracoes', action: 'access', code: MODULE_PERMISSION_CODES.CONFIGURACOES, description: 'Acesso ao módulo Configurações no menu lateral.' },
  { module: 'module_integracoes', action: 'access', code: MODULE_PERMISSION_CODES.INTEGRACOES, description: 'Acesso ao módulo Integrações no menu lateral.' },
] as const

const ALL_MODULE_CODES = Object.values(MODULE_PERMISSION_CODES) as string[]

const MODULE_KEY_TO_PERMISSION: Record<string, string> = {
  'painel-executivo': MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO,
  metas: MODULE_PERMISSION_CODES.METAS,
  producao: MODULE_PERMISSION_CODES.PRODUCAO,
  logistica: MODULE_PERMISSION_CODES.LOGISTICA,
  qualidade: MODULE_PERMISSION_CODES.QUALIDADE,
  rh: MODULE_PERMISSION_CODES.RH,
  relatorios: MODULE_PERMISSION_CODES.RELATORIOS,
  contabilidade: MODULE_PERMISSION_CODES.CONTABILIDADE,
  comunicacao: MODULE_PERMISSION_CODES.COMUNICACAO,
  configuracoes: MODULE_PERMISSION_CODES.CONFIGURACOES,
  integracoes: MODULE_PERMISSION_CODES.INTEGRACOES,
}

export type ModulePermissions = Record<string, boolean>

let modulePermissionBootstrapDone = false
let modulePermissionBootstrapPromise: Promise<void> | null = null

async function bootstrapModulePermissionCatalog() {
  for (const def of MODULE_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { module: def.module, action: def.action, description: def.description },
      create: { module: def.module, action: def.action, code: def.code, description: def.description },
    })
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: ROLE_CATALOG_CODES } },
      select: { id: true, code: true },
    }),
    prisma.permission.findMany({
      where: { code: { in: ALL_MODULE_CODES } },
      select: { id: true, code: true },
    }),
  ])

  const permissionIdByCode = new Map(permissions.map((p: { code: string; id: string }) => [p.code, p.id]))
  const allPermissionIds = ALL_MODULE_CODES
    .map((code) => permissionIdByCode.get(code))
    .filter((id): id is string => Boolean(id))

  // Grant all module access to every role except COMMERCIAL_SUPERVISOR (admin-controlled)
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const role of roles) {
      if (role.code === 'COMMERCIAL_SUPERVISOR') continue
      if (allPermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        })
      }
    }
  })
}

export async function ensureModulePermissionCatalog(): Promise<void> {
  if (modulePermissionBootstrapDone) return
  if (!modulePermissionBootstrapPromise) {
    modulePermissionBootstrapPromise = bootstrapModulePermissionCatalog()
      .then(() => { modulePermissionBootstrapDone = true })
      .finally(() => { modulePermissionBootstrapPromise = null })
  }
  await modulePermissionBootstrapPromise
}

export async function getModulePermissions(user: AuthzUserLike | null | undefined): Promise<ModulePermissions> {
  const allTrue: ModulePermissions = Object.fromEntries(Object.keys(MODULE_KEY_TO_PERMISSION).map((k) => [k, true]))
  const allFalse: ModulePermissions = Object.fromEntries(Object.keys(MODULE_KEY_TO_PERMISSION).map((k) => [k, false]))

  if (!user?.roleId) return allFalse
  const roleCode = user.role?.code?.toUpperCase() ?? null
  if (roleCode === 'DEVELOPER') return allTrue

  await ensureModulePermissionCatalog()

  const role = await prisma.role.findUnique({
    where: { id: user.roleId },
    select: {
      code: true,
      rolePermissions: { select: { permission: { select: { code: true } } } },
    },
  })
  if (!role) return allFalse
  if (role.code === 'DEVELOPER') return allTrue

  const codes = new Set(role.rolePermissions.map((rp: { permission: { code: string } }) => rp.permission.code))
  return Object.fromEntries(
    Object.entries(MODULE_KEY_TO_PERMISSION).map(([key, code]) => [key, codes.has(code)])
  )
}

export interface AuthzUserLike {
  roleId?: string | null
  role?: {
    code?: string | null
  } | null
}

export interface MetasSectionPermission {
  view: boolean
  edit: boolean
  save: boolean
  remove: boolean
}

export interface MetasPermissionMatrix {
  config: MetasSectionPermission
  sellers: MetasSectionPermission
  products: MetasSectionPermission
}

function emptyMetasPermissions(): MetasPermissionMatrix {
  return {
    config: { view: false, edit: false, save: false, remove: false },
    sellers: { view: false, edit: false, save: false, remove: false },
    products: { view: false, edit: false, save: false, remove: false },
  }
}

function fullMetasPermissions(): MetasPermissionMatrix {
  return {
    config: { view: true, edit: true, save: true, remove: true },
    sellers: { view: true, edit: true, save: true, remove: true },
    products: { view: true, edit: true, save: true, remove: true },
  }
}

function buildMetasPermissions(codes: Set<string>): MetasPermissionMatrix {
  return {
    config: {
      view: codes.has(METAS_PERMISSION_CODES.CONFIG_VIEW),
      edit: codes.has(METAS_PERMISSION_CODES.CONFIG_EDIT),
      save: codes.has(METAS_PERMISSION_CODES.CONFIG_SAVE),
      remove: codes.has(METAS_PERMISSION_CODES.CONFIG_REMOVE),
    },
    sellers: {
      view: codes.has(METAS_PERMISSION_CODES.SELLERS_VIEW),
      edit: codes.has(METAS_PERMISSION_CODES.SELLERS_EDIT),
      save: codes.has(METAS_PERMISSION_CODES.SELLERS_SAVE),
      remove: codes.has(METAS_PERMISSION_CODES.SELLERS_REMOVE),
    },
    products: {
      view: codes.has(METAS_PERMISSION_CODES.PRODUCTS_VIEW),
      edit: codes.has(METAS_PERMISSION_CODES.PRODUCTS_EDIT),
      save: codes.has(METAS_PERMISSION_CODES.PRODUCTS_SAVE),
      remove: codes.has(METAS_PERMISSION_CODES.PRODUCTS_REMOVE),
    },
  }
}

export async function getMetasPermissions(user: AuthzUserLike | null | undefined): Promise<MetasPermissionMatrix> {
  if (!user?.roleId) return emptyMetasPermissions()
  const roleCode = user.role?.code?.toUpperCase() ?? null
  if (roleCode === 'DEVELOPER') return fullMetasPermissions()

  await ensureMetasPermissionCatalog()

  const role = await prisma.role.findUnique({
    where: { id: user.roleId },
    select: {
      code: true,
      rolePermissions: { select: { permission: { select: { code: true } } } },
    },
  })
  if (!role) return emptyMetasPermissions()
  if (role.code === 'DEVELOPER') return fullMetasPermissions()

  const permissionCodes = new Set<string>(
    role.rolePermissions.map((item: { permission: { code: string } }) => item.permission.code)
  )
  return buildMetasPermissions(permissionCodes)
}

/** Regra central para acesso ao painel de integrações. */
export async function canAccessIntegrations(user: AuthzUserLike | null | undefined): Promise<boolean> {
  if (!user) return false

  const roleCode = user.role?.code?.toUpperCase() ?? null
  if (!roleCode) return false

  // Diretoria não deve acessar o painel de integrações.
  if (roleCode === 'DIRECTORATE') return false

  if (INTEGRATIONS_ALLOWED_ROLE_CODES.has(roleCode)) return true

  return hasPermission(user.roleId, 'integrations:read')
}
