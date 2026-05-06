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
  PAINEL_EXECUTIVO_VIEW: 'module_painel-executivo:view',
  PAINEL_EXECUTIVO_INTERACT: 'module_painel-executivo:interact',
  METAS_VIEW: 'module_metas:view',
  METAS_INTERACT: 'module_metas:interact',
  PRODUCAO_VIEW: 'module_producao:view',
  PRODUCAO_INTERACT: 'module_producao:interact',
  LOGISTICA_VIEW: 'module_logistica:view',
  LOGISTICA_INTERACT: 'module_logistica:interact',
  QUALIDADE_VIEW: 'module_qualidade:view',
  QUALIDADE_INTERACT: 'module_qualidade:interact',
  RH_VIEW: 'module_rh:view',
  RH_INTERACT: 'module_rh:interact',
  RELATORIOS_VIEW: 'module_relatorios:view',
  RELATORIOS_INTERACT: 'module_relatorios:interact',
  CONTABILIDADE_VIEW: 'module_contabilidade:view',
  CONTABILIDADE_INTERACT: 'module_contabilidade:interact',
  COMUNICACAO_VIEW: 'module_comunicacao:view',
  COMUNICACAO_INTERACT: 'module_comunicacao:interact',
  CONFIGURACOES_VIEW: 'module_configuracoes:view',
  CONFIGURACOES_INTERACT: 'module_configuracoes:interact',
  INTEGRACOES_VIEW: 'module_integracoes:view',
  INTEGRACOES_INTERACT: 'module_integracoes:interact',
} as const

const MODULE_PERMISSION_DEFINITIONS = [
  { module: 'module_painel-executivo', action: 'view', code: MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO_VIEW, description: 'Visualizar o módulo Painel Executivo no menu lateral.' },
  { module: 'module_painel-executivo', action: 'interact', code: MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO_INTERACT, description: 'Acessar e interagir com o módulo Painel Executivo.' },
  { module: 'module_metas', action: 'view', code: MODULE_PERMISSION_CODES.METAS_VIEW, description: 'Visualizar o módulo Metas no menu lateral.' },
  { module: 'module_metas', action: 'interact', code: MODULE_PERMISSION_CODES.METAS_INTERACT, description: 'Acessar e interagir com o módulo Metas.' },
  { module: 'module_producao', action: 'view', code: MODULE_PERMISSION_CODES.PRODUCAO_VIEW, description: 'Visualizar o módulo Produção no menu lateral.' },
  { module: 'module_producao', action: 'interact', code: MODULE_PERMISSION_CODES.PRODUCAO_INTERACT, description: 'Acessar e interagir com o módulo Produção.' },
  { module: 'module_logistica', action: 'view', code: MODULE_PERMISSION_CODES.LOGISTICA_VIEW, description: 'Visualizar o módulo Logística no menu lateral.' },
  { module: 'module_logistica', action: 'interact', code: MODULE_PERMISSION_CODES.LOGISTICA_INTERACT, description: 'Acessar e interagir com o módulo Logística.' },
  { module: 'module_qualidade', action: 'view', code: MODULE_PERMISSION_CODES.QUALIDADE_VIEW, description: 'Visualizar o módulo Qualidade no menu lateral.' },
  { module: 'module_qualidade', action: 'interact', code: MODULE_PERMISSION_CODES.QUALIDADE_INTERACT, description: 'Acessar e interagir com o módulo Qualidade.' },
  { module: 'module_rh', action: 'view', code: MODULE_PERMISSION_CODES.RH_VIEW, description: 'Visualizar o módulo RH no menu lateral.' },
  { module: 'module_rh', action: 'interact', code: MODULE_PERMISSION_CODES.RH_INTERACT, description: 'Acessar e interagir com o módulo RH.' },
  { module: 'module_relatorios', action: 'view', code: MODULE_PERMISSION_CODES.RELATORIOS_VIEW, description: 'Visualizar o módulo Relatórios no menu lateral.' },
  { module: 'module_relatorios', action: 'interact', code: MODULE_PERMISSION_CODES.RELATORIOS_INTERACT, description: 'Acessar e interagir com o módulo Relatórios.' },
  { module: 'module_contabilidade', action: 'view', code: MODULE_PERMISSION_CODES.CONTABILIDADE_VIEW, description: 'Visualizar o módulo Contabilidade no menu lateral.' },
  { module: 'module_contabilidade', action: 'interact', code: MODULE_PERMISSION_CODES.CONTABILIDADE_INTERACT, description: 'Acessar e interagir com o módulo Contabilidade.' },
  { module: 'module_comunicacao', action: 'view', code: MODULE_PERMISSION_CODES.COMUNICACAO_VIEW, description: 'Visualizar o módulo Comunicação no menu lateral.' },
  { module: 'module_comunicacao', action: 'interact', code: MODULE_PERMISSION_CODES.COMUNICACAO_INTERACT, description: 'Acessar e interagir com o módulo Comunicação.' },
  { module: 'module_configuracoes', action: 'view', code: MODULE_PERMISSION_CODES.CONFIGURACOES_VIEW, description: 'Visualizar o módulo Configurações no menu lateral.' },
  { module: 'module_configuracoes', action: 'interact', code: MODULE_PERMISSION_CODES.CONFIGURACOES_INTERACT, description: 'Acessar e interagir com o módulo Configurações.' },
  { module: 'module_integracoes', action: 'view', code: MODULE_PERMISSION_CODES.INTEGRACOES_VIEW, description: 'Visualizar o módulo Integrações no menu lateral.' },
  { module: 'module_integracoes', action: 'interact', code: MODULE_PERMISSION_CODES.INTEGRACOES_INTERACT, description: 'Acessar e interagir com o módulo Integrações.' },
] as const

const ALL_MODULE_CODES = Object.values(MODULE_PERMISSION_CODES) as string[]

const MODULE_KEY_TO_PERMISSION: Record<string, { view: string; interact: string }> = {
  'painel-executivo': { view: MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO_VIEW, interact: MODULE_PERMISSION_CODES.PAINEL_EXECUTIVO_INTERACT },
  metas: { view: MODULE_PERMISSION_CODES.METAS_VIEW, interact: MODULE_PERMISSION_CODES.METAS_INTERACT },
  producao: { view: MODULE_PERMISSION_CODES.PRODUCAO_VIEW, interact: MODULE_PERMISSION_CODES.PRODUCAO_INTERACT },
  logistica: { view: MODULE_PERMISSION_CODES.LOGISTICA_VIEW, interact: MODULE_PERMISSION_CODES.LOGISTICA_INTERACT },
  qualidade: { view: MODULE_PERMISSION_CODES.QUALIDADE_VIEW, interact: MODULE_PERMISSION_CODES.QUALIDADE_INTERACT },
  rh: { view: MODULE_PERMISSION_CODES.RH_VIEW, interact: MODULE_PERMISSION_CODES.RH_INTERACT },
  relatorios: { view: MODULE_PERMISSION_CODES.RELATORIOS_VIEW, interact: MODULE_PERMISSION_CODES.RELATORIOS_INTERACT },
  contabilidade: { view: MODULE_PERMISSION_CODES.CONTABILIDADE_VIEW, interact: MODULE_PERMISSION_CODES.CONTABILIDADE_INTERACT },
  comunicacao: { view: MODULE_PERMISSION_CODES.COMUNICACAO_VIEW, interact: MODULE_PERMISSION_CODES.COMUNICACAO_INTERACT },
  configuracoes: { view: MODULE_PERMISSION_CODES.CONFIGURACOES_VIEW, interact: MODULE_PERMISSION_CODES.CONFIGURACOES_INTERACT },
  integracoes: { view: MODULE_PERMISSION_CODES.INTEGRACOES_VIEW, interact: MODULE_PERMISSION_CODES.INTEGRACOES_INTERACT },
}

export interface ModuleAccessLevel {
  view: boolean
  interact: boolean
}

export type ModulePermissions = Record<string, ModuleAccessLevel>

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
  const moduleKeys = Object.keys(MODULE_KEY_TO_PERMISSION)
  const allTrue: ModulePermissions = Object.fromEntries(moduleKeys.map((k) => [k, { view: true, interact: true }]))
  const allFalse: ModulePermissions = Object.fromEntries(moduleKeys.map((k) => [k, { view: false, interact: false }]))

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
    Object.entries(MODULE_KEY_TO_PERMISSION).map(([key, perms]) => [
      key,
      { view: codes.has(perms.view), interact: codes.has(perms.interact) },
    ])
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

const USER_MANAGER_ROLE_CODES = new Set(['DEVELOPER', 'IT_ANALYST'])

export function isUserManager(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false
  return USER_MANAGER_ROLE_CODES.has(roleCode.toUpperCase())
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
