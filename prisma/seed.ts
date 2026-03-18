/**
 * SISTEMA OURO VERDE — Seed do Banco de Dados
 * Popula os dados iniciais obrigatórios para o sistema operar:
 * - Departamentos
 * - Perfis (Roles)
 * - Permissões
 * - Usuário Desenvolvedor (administrador geral do sistema)
 *
 * Execute com: npm run db:seed
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do Sistema Ouro Verde...\n')

  // ── Departamentos ──────────────────────────────────────────
  console.log('📁 Criando departamentos...')
  const departments = [
    { name: 'Diretoria', code: 'DIR', description: 'Diretoria e Gestão Executiva' },
    { name: 'Gerência', code: 'GER', description: 'Gerência Geral' },
    { name: 'Produção', code: 'PROD', description: 'Linha de Produção' },
    { name: 'Logística', code: 'LOG', description: 'Logística e Expedição' },
    { name: 'Depósito', code: 'DEP', description: 'Depósito e Armazenamento' },
    { name: 'Qualidade', code: 'QUAL', description: 'Controle de Qualidade' },
    { name: 'Recursos Humanos', code: 'RH', description: 'Gestão de Pessoas' },
    { name: 'Contabilidade', code: 'CONT', description: 'Financeiro e Contabilidade' },
    { name: 'Administração', code: 'ADM', description: 'Administração Geral' },
    { name: 'TI', code: 'TI', description: 'Tecnologia da Informação' },
  ]

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    })
  }
  console.log(`  ✔ ${departments.length} departamentos criados\n`)

  // ── Perfis (Roles) ─────────────────────────────────────────
  console.log('👥 Criando perfis de acesso...')
  const roles = [
    { name: 'Desenvolvedor', code: 'DEVELOPER', description: 'Administrador geral do sistema com acesso completo' },
    { name: 'Gestão / Diretoria', code: 'MANAGEMENT', description: 'Acesso gerencial completo' },
    { name: 'Gerente', code: 'MANAGER', description: 'Acesso de gerência por setor' },
    { name: 'Supervisor', code: 'SUPERVISOR', description: 'Supervisão operacional' },
    { name: 'Auxiliar', code: 'AUXILIARY', description: 'Acesso operacional básico' },
    { name: 'Produção', code: 'PRODUCTION', description: 'Operador de produção' },
    { name: 'Logística', code: 'LOGISTICS', description: 'Operador de logística' },
    { name: 'Qualidade', code: 'QUALITY', description: 'Inspetor de qualidade' },
    { name: 'RH', code: 'HR', description: 'Gestão de pessoas' },
    { name: 'Contabilidade', code: 'ACCOUNTING', description: 'Financeiro e contábil' },
    { name: 'Depósito / Armazenamento', code: 'WAREHOUSE', description: 'Operador de depósito' },
    { name: 'Visualizador / Auditoria', code: 'VIEWER', description: 'Somente leitura e auditoria' },
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    })
  }
  console.log(`  ✔ ${roles.length} perfis criados\n`)

  // ── Permissões ─────────────────────────────────────────────
  console.log('🔐 Criando permissões...')
  const modules = [
    'auth', 'users', 'departments', 'roles',
    'production', 'logistics', 'warehouse',
    'quality', 'hr', 'accounting',
    'reports', 'dashboard', 'chat',
    'audit', 'notifications', 'settings',
    'integrations',
  ]
  const actions = ['read', 'create', 'edit', 'delete', 'approve', 'export', 'admin']

  const permissions: { module: string; action: string; code: string; description: string }[] = []
  for (const module of modules) {
    for (const action of actions) {
      permissions.push({
        module,
        action,
        code: `${module}:${action}`,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} em ${module}`,
      })
    }
  }

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    })
  }
  console.log(`  ✔ ${permissions.length} permissões criadas\n`)

  // ── Associar todas as permissões ao Admin Master ───────────
  console.log('🔗 Associando permissões ao Desenvolvedor...')
  const adminRole = await prisma.role.findUnique({ where: { code: 'DEVELOPER' } })
  const allPermissions = await prisma.permission.findMany()

  if (adminRole) {
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      })
    }
    console.log(`  ✔ ${allPermissions.length} permissões associadas ao Desenvolvedor\n`)
  }

  // ── Usuário Administrador Padrão ───────────────────────────
  console.log('👤 Criando usuário administrador padrão...')
  const adminDept = await prisma.department.findUnique({ where: { code: 'TI' } })

  const existingAdmin = await prisma.user.findUnique({ where: { login: 'admin' } })
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@2026', 12)
    await prisma.user.create({
      data: {
        fullName: 'Desenvolvedor',
        email: 'admin@ouroverde.com.br',
        login: 'admin',
        passwordHash,
        departmentId: adminDept?.id,
        roleId: adminRole?.id,
        status: 'ACTIVE',
        isActive: true,
      },
    })
    console.log('  ✔ Usuário admin criado')
    console.log('  ✔ Login:  admin')
    console.log('  ✔ Senha:  Admin@2026')
    console.log('  ⚠  ALTERE A SENHA após o primeiro acesso!\n')
  } else {
    console.log('  ℹ Usuário admin já existe. Ignorado.\n')
  }

  console.log('✅ Seed concluído com sucesso!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Sistema Ouro Verde — pronto para operar')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
