'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Shield,
  Users,
  KeyRound,
  Activity,
  Zap,
  Server,
  Database,
  Code2,
  Terminal,
  Globe,
  Layers,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface CurrentUser {
  id: string
  roleCode?: string | null
}

/* ─── Liquid Glass Stat Pill (para os 4 cards da hero) ──────────────── */
function LiquidGlassStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.06] p-4 backdrop-blur-2xl transition-all duration-500 hover:bg-white/[0.10] hover:shadow-xl hover:shadow-emerald-950/20">
      {/* Liquid glass reflections */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-white/[0.06] to-transparent" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04]" />

      {/* Hover glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition-opacity duration-700 opacity-0 group-hover:opacity-100" />

      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-emerald-300 ring-1 ring-white/[0.10] backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="text-lg font-bold text-white tabular-nums leading-tight">{value}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Dev Tool Card (estilo anterior, NÃO liquid glass) ─────────────── */
interface DevToolCardProps {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  variant?: 'default' | 'accent' | 'dark'
  badge?: string
}

function DevToolCard({ href, icon, title, description, cta, variant = 'default', badge }: DevToolCardProps) {
  const isDark = variant === 'dark'
  const isAccent = variant === 'accent'

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-lg',
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 text-white hover:border-slate-500 hover:bg-slate-800'
          : isAccent
            ? 'border-emerald-200/80 bg-emerald-50/60 hover:border-emerald-300 hover:bg-emerald-50'
            : 'border-surface-200/80 bg-white/80 hover:border-primary-300 hover:bg-white hover:shadow-md'
      )}
    >
      <div className="relative flex items-start justify-between">
        <div
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
            isDark
              ? 'bg-slate-700 text-slate-200'
              : isAccent
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-primary-100 text-primary-700'
          )}
        >
          {icon}
        </div>
        {badge && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="relative mt-4 flex-1">
        <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-surface-900')}>{title}</h2>
        <p className={cn('mt-1 text-sm', isDark ? 'text-slate-400' : 'text-surface-600')}>{description}</p>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            'transition-colors duration-300',
            isDark
              ? 'text-emerald-400 group-hover:text-emerald-300'
              : isAccent
                ? 'text-emerald-700 group-hover:text-emerald-800'
                : 'text-primary-700 group-hover:text-primary-800'
          )}
        >
          {cta}
        </span>
        <ArrowRight
          className={cn(
            'h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5',
            isDark
              ? 'text-emerald-400 group-hover:text-emerald-300'
              : isAccent
                ? 'text-emerald-700 group-hover:text-emerald-800'
                : 'text-primary-700 group-hover:text-primary-800'
          )}
        />
      </div>
    </Link>
  )
}

/* ─── Side Panel Card (Atalhos + Ambiente) ──────────────────────────── */
function SidePanelCard({ isDeveloper, basePath }: { isDeveloper: boolean; basePath: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      {/* Atalhos */}
      <div className="flex-1 p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-400">Atalhos Rápidos</h3>
        <div className="mt-3 space-y-2">
          <SideLink href={`${basePath}/gestao-usuarios`} icon={<Users className="h-3.5 w-3.5" />} label="Gerenciar usuários" />
          <SideLink href={`${basePath}/gestao-permissoes`} icon={<KeyRound className="h-3.5 w-3.5" />} label="Configurar permissões" />
          {isDeveloper && (
            <>
              <SideLink href={`${basePath}/diagnostico`} icon={<Database className="h-3.5 w-3.5" />} label="Executar diagnóstico" />
              <SideLink href="/metas/telemetria" icon={<Server className="h-3.5 w-3.5" />} label="Telemetria do sistema" />
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-surface-100" />

      {/* Ambiente */}
      <div className="p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-400">Ambiente</h3>
        <div className="mt-3 space-y-2.5">
          <SideEnvRow icon={<Globe className="h-3.5 w-3.5" />} label="Base" value="Produção" />
          <SideEnvRow icon={<Database className="h-3.5 w-3.5" />} label="Sankhya" value="Conectado" />
          <SideEnvRow icon={<Code2 className="h-3.5 w-3.5" />} label="API" value="Operacional" />
          <SideEnvRow icon={<Terminal className="h-3.5 w-3.5" />} label="Cache" value="Ativo" />
        </div>
      </div>
    </div>
  )
}

function SideLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-50"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-50 text-surface-400 ring-1 ring-surface-100 transition-colors group-hover:text-emerald-600 group-hover:ring-emerald-100">
        {icon}
      </div>
      <span className="flex-1 text-xs font-medium text-surface-600 group-hover:text-surface-900">{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 text-surface-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-500" />
    </Link>
  )
}

function SideEnvRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-50 text-surface-400 ring-1 ring-surface-100">
        {icon}
      </div>
      <span className="flex-1 text-xs font-medium text-surface-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-surface-700">{value}</span>
      </div>
    </div>
  )
}

export default function DevPage() {
  const pathname = usePathname()
  const [authLoaded, setAuthLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [stats, setStats] = useState({
    users: '—',
    groups: '—',
    roles: '12',
    modules: '3',
  })

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser({ id: d.user.id, roleCode: d.user.roleCode ?? null })
      })
      .finally(() => setAuthLoaded(true))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    Promise.allSettled([
      fetch('/api/users?limit=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/permissions/groups?limit=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([usersRes, groupsRes]) => {
      const usersTotal = usersRes.status === 'fulfilled' && usersRes.value?.pagination?.total
      const groupsTotal = groupsRes.status === 'fulfilled' && groupsRes.value?.pagination?.total
      setStats((prev) => ({
        ...prev,
        users: usersTotal ? String(usersTotal) : '—',
        groups: groupsTotal ? String(groupsTotal) : '—',
      }))
    })
  }, [currentUser])

  const canAccess = currentUser?.roleCode === 'DEVELOPER' || currentUser?.roleCode === 'IT_ANALYST'
  const isDeveloper = currentUser?.roleCode === 'DEVELOPER'
  const basePath = pathname?.startsWith('/controle') ? '/controle' : '/dev'

  if (!authLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-6 py-4 shadow-sm">
          <Spinner />
          <span className="text-sm font-medium text-surface-600">Validando credenciais de acesso...</span>
        </div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white shadow-lg">
          <div className="h-1.5 bg-red-500" />
          <div className="p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-900">Acesso restrito</h1>
                <p className="mt-2 text-sm leading-relaxed text-surface-500">
                  Esta área é exclusiva para administradores de sistema. Se você precisa de acesso, entre em contato com o time de Tecnologia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-linear-to-br from-[#07160f] via-[#0f2a1d] to-[#14966f] px-6 py-10 shadow-xl sm:px-10 sm:py-14">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-[#c6a277]/10 blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                <Zap className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-200">
                  {isDeveloper ? 'Área Dev' : 'Administração'}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {isDeveloper ? 'Central do Desenvolvedor' : 'Gestão de Usuários e Permissões'}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-100/80 sm:text-base">
                {isDeveloper
                  ? 'Governança técnica, diagnóstico operacional e administração centralizada do ecossistema empresarial.'
                  : 'Administração corporativa de contas, grupos e permissões do sistema empresarial.'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-emerald-300" />
              <span className="text-xs font-semibold text-emerald-100">
                {isDeveloper ? 'Perfil Desenvolvedor' : 'Perfil Analista de TI'}
              </span>
            </div>
          </div>

          {/* Quick stats — Liquid Glass */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LiquidGlassStat icon={<Users className="h-4 w-4" />} label="Usuários" value={stats.users} />
            <LiquidGlassStat icon={<KeyRound className="h-4 w-4" />} label="Grupos" value={stats.groups} />
            <LiquidGlassStat icon={<Layers className="h-4 w-4" />} label="Cargos" value={stats.roles} />
            <LiquidGlassStat icon={<Globe className="h-4 w-4" />} label="Módulos" value={stats.modules} />
          </div>
        </div>
      </section>

      {/* Tools Grid — 5 cards + Side Panel ao lado da Auditoria */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-200" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-400">
            Ferramentas de Governança
          </span>
          <div className="h-px flex-1 bg-surface-200" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {/* Row 1 */}
          <DevToolCard
            href={`${basePath}/gestao-usuarios`}
            icon={<Users className="h-5 w-5" />}
            title="Gestão de Usuários"
            description="Cadastro, edição, status, vínculos com vendedores/supervisores e ciclo de vida completo das contas corporativas."
            cta="Acessar seção"
            variant="default"
          />

          <DevToolCard
            href={`${basePath}/gestao-permissoes`}
            icon={<KeyRound className="h-5 w-5" />}
            title="Gestão de Permissões"
            description="Controle granular de grupos, privilégios por módulo e atribuição dinâmica de acessos por usuário."
            cta="Acessar seção"
            variant="accent"
          />

          {isDeveloper && (
            <DevToolCard
              href={`${basePath}/diagnostico`}
              icon={<Activity className="h-5 w-5" />}
              title="Central de Diagnóstico"
              description="Testes de conectividade, autenticação Sankhya, inspeção de campos e execução de SQL livre."
              cta="Abrir diagnóstico"
              variant="dark"
              badge="Dev Only"
            />
          )}

          {/* Row 2 */}
          <DevToolCard
            href="/metas/telemetria"
            icon={<BarChart3 className="h-5 w-5" />}
            title="Telemetria do Sistema"
            description="Monitoramento em tempo real de requisições, latência, cache hit rate e métricas de concorrência."
            cta="Visualizar métricas"
            variant="default"
          />

          <DevToolCard
            href="/auditoria"
            icon={<ClipboardList className="h-5 w-5" />}
            title="Auditoria Corporativa"
            description="Rastreamento de ações críticas, exportação de logs e análise de comportamento do sistema."
            cta="Consultar logs"
            variant="accent"
          />

          {/* Side Panel — Atalhos + Ambiente */}
          <SidePanelCard isDeveloper={isDeveloper} basePath={basePath} />
        </div>
      </section>

      {/* Footer note */}
      <section className="flex items-center justify-center rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600">
        <p className="inline-flex items-center gap-2 font-medium text-surface-700">
          <Shield className="h-4 w-4" />
          {isDeveloper ? 'Uso restrito ao perfil Desenvolvedor.' : 'Acesso liberado para Analista de TI.'}
        </p>
      </section>
    </div>
  )
}
