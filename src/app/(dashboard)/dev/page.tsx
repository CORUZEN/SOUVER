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

/* ─── Liquid Glass Card ─────────────────────────────────────────────── */
interface LiquidGlassCardProps {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  variant?: 'emerald' | 'slate' | 'amber'
  badge?: string
  isExternal?: boolean
}

function LiquidGlassCard({
  href,
  icon,
  title,
  description,
  cta,
  variant = 'emerald',
  badge,
  isExternal = false,
}: LiquidGlassCardProps) {
  const tone =
    variant === 'slate'
      ? {
          border: 'border-white/[0.08]',
          bg: 'bg-white/[0.03]',
          bgHover: 'hover:bg-white/[0.06]',
          iconBg: 'bg-white/[0.06]',
          iconText: 'text-slate-300',
          iconRing: 'ring-white/[0.08]',
          title: 'text-white',
          desc: 'text-slate-400',
          cta: 'text-emerald-400',
          ctaHover: 'group-hover:text-emerald-300',
          glow: 'bg-emerald-500/10',
          badgeBg: 'bg-emerald-500/15',
          badgeText: 'text-emerald-400',
        }
      : variant === 'amber'
        ? {
            border: 'border-amber-200/[0.15]',
            bg: 'bg-amber-50/[0.03]',
            bgHover: 'hover:bg-amber-50/[0.06]',
            iconBg: 'bg-amber-500/10',
            iconText: 'text-amber-300',
            iconRing: 'ring-amber-200/20',
            title: 'text-white',
            desc: 'text-slate-400',
            cta: 'text-amber-300',
            ctaHover: 'group-hover:text-amber-200',
            glow: 'bg-amber-500/10',
            badgeBg: 'bg-amber-500/15',
            badgeText: 'text-amber-300',
          }
        : {
            border: 'border-emerald-200/[0.12]',
            bg: 'bg-emerald-50/[0.03]',
            bgHover: 'hover:bg-emerald-50/[0.06]',
            iconBg: 'bg-emerald-500/10',
            iconText: 'text-emerald-300',
            iconRing: 'ring-emerald-200/20',
            title: 'text-white',
            desc: 'text-slate-400',
            cta: 'text-emerald-400',
            ctaHover: 'group-hover:text-emerald-300',
            glow: 'bg-emerald-500/10',
            badgeBg: 'bg-emerald-500/15',
            badgeText: 'text-emerald-400',
          }

  const Wrapper = isExternal ? 'a' : Link
  const wrapperProps = isExternal
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-500',
        'hover:-translate-y-1 hover:shadow-2xl',
        tone.border,
        tone.bg,
        tone.bgHover
      )}
    >
      {/* Top highlight (liquid glass reflection) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-8 bg-linear-to-b from-white/[0.04] to-transparent rounded-t-lg" />

      {/* Radial glow on hover */}
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 opacity-0 group-hover:opacity-100',
          tone.glow
        )}
      />

      {/* Inner rim light */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04]" />

      <div className="relative flex items-start justify-between">
        <div
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-xl backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
            tone.iconBg,
            tone.iconText,
            'ring-1',
            tone.iconRing
          )}
        >
          {icon}
        </div>
        {badge && (
          <span
            className={cn(
              'rounded-full border border-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm',
              tone.badgeBg,
              tone.badgeText
            )}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="relative mt-5 flex-1">
        <h2 className={cn('text-lg font-semibold tracking-tight', tone.title)}>{title}</h2>
        <p className={cn('mt-1.5 text-sm leading-relaxed', tone.desc)}>{description}</p>
      </div>

      <div className="relative mt-5 flex items-center gap-2 text-sm font-semibold">
        <span className={cn('transition-colors duration-300', tone.cta, tone.ctaHover)}>{cta}</span>
        <ArrowRight className={cn('h-4 w-4 transition-all duration-300 group-hover:translate-x-1', tone.cta, tone.ctaHover)} />
      </div>
    </Wrapper>
  )
}

/* ─── Liquid Glass Stat Pill ────────────────────────────────────────── */
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
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:shadow-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-3 top-0 h-6 bg-linear-to-b from-white/[0.03] to-transparent rounded-t-lg" />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.03]" />

      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-emerald-300 ring-1 ring-white/[0.08] backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
          <p className="text-base font-bold text-white tabular-nums">{value}</p>
        </div>
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
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-4 backdrop-blur-xl">
          <Spinner />
          <span className="text-sm font-medium text-slate-400">Validando credenciais de acesso...</span>
        </div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-2xl backdrop-blur-xl">
          <div className="h-1 bg-red-500" />
          <div className="p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-400/20 backdrop-blur-md">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Acesso restrito</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
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
      {/* Hero — Liquid Glass Panel */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-linear-to-br from-[#05120c] via-[#0a1f16] to-[#0d2e20] px-6 py-10 shadow-2xl sm:px-10 sm:py-14">
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-[#c6a277]/8 blur-3xl" />
          <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-400/5 blur-3xl" />
        </div>

        {/* Liquid glass overlay on hero */}
        <div className="pointer-events-none absolute inset-0 bg-white/[0.01] backdrop-blur-[1px]" />

        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 backdrop-blur-md">
                <Zap className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-200">
                  {isDeveloper ? 'Área Dev' : 'Administração'}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {isDeveloper ? 'Central do Desenvolvedor' : 'Gestão de Usuários e Permissões'}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                {isDeveloper
                  ? 'Governança técnica, diagnóstico operacional e administração centralizada do ecossistema empresarial.'
                  : 'Administração corporativa de contas, grupos e permissões do sistema empresarial.'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
              <Shield className="h-4 w-4 text-emerald-300" />
              <span className="text-xs font-semibold text-emerald-100">
                {isDeveloper ? 'Perfil Desenvolvedor' : 'Perfil Analista de TI'}
              </span>
            </div>
          </div>

          {/* Stats row — Liquid Glass */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LiquidGlassStat icon={<Users className="h-4 w-4" />} label="Usuários" value={stats.users} />
            <LiquidGlassStat icon={<KeyRound className="h-4 w-4" />} label="Grupos" value={stats.groups} />
            <LiquidGlassStat icon={<Layers className="h-4 w-4" />} label="Cargos" value={stats.roles} />
            <LiquidGlassStat icon={<Globe className="h-4 w-4" />} label="Módulos" value={stats.modules} />
          </div>
        </div>
      </section>

      {/* Tools Grid — 5 Liquid Glass Cards */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Ferramentas de Governança
          </span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <LiquidGlassCard
            href={`${basePath}/gestao-usuarios`}
            icon={<Users className="h-5 w-5" />}
            title="Gestão de Usuários"
            description="Cadastro, edição, status, vínculos com vendedores/supervisores e ciclo de vida completo das contas corporativas."
            cta="Acessar seção"
            variant="emerald"
          />

          <LiquidGlassCard
            href={`${basePath}/gestao-permissoes`}
            icon={<KeyRound className="h-5 w-5" />}
            title="Gestão de Permissões"
            description="Controle granular de grupos, privilégios por módulo e atribuição dinâmica de acessos por usuário."
            cta="Acessar seção"
            variant="emerald"
          />

          {isDeveloper && (
            <LiquidGlassCard
              href={`${basePath}/diagnostico`}
              icon={<Activity className="h-5 w-5" />}
              title="Central de Diagnóstico"
              description="Testes de conectividade, autenticação Sankhya, inspeção de campos e execução de SQL livre."
              cta="Abrir diagnóstico"
              variant="slate"
              badge="Dev Only"
            />
          )}

          <LiquidGlassCard
            href="/metas/telemetria"
            icon={<BarChart3 className="h-5 w-5" />}
            title="Telemetria do Sistema"
            description="Monitoramento em tempo real de requisições, latência, cache hit rate e métricas de concorrência."
            cta="Visualizar métricas"
            variant="emerald"
          />

          <LiquidGlassCard
            href="/auditoria"
            icon={<ClipboardList className="h-5 w-5" />}
            title="Auditoria Corporativa"
            description="Rastreamento de ações críticas, exportação de logs e análise de comportamento do sistema."
            cta="Consultar logs"
            variant="amber"
          />
        </div>
      </section>

      {/* System Status / Quick Links — Liquid Glass */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl lg:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.03]" />

          <h3 className="relative text-sm font-bold uppercase tracking-wider text-slate-400">Atalhos Rápidos</h3>
          <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LiquidQuickLink href={`${basePath}/gestao-usuarios`} icon={<Users className="h-4 w-4" />} label="Gerenciar usuários" />
            <LiquidQuickLink href={`${basePath}/gestao-permissoes`} icon={<KeyRound className="h-4 w-4" />} label="Configurar permissões" />
            {isDeveloper && (
              <>
                <LiquidQuickLink href={`${basePath}/diagnostico`} icon={<Database className="h-4 w-4" />} label="Executar diagnóstico" />
                <LiquidQuickLink href="/metas/telemetria" icon={<Server className="h-4 w-4" />} label="Telemetria do sistema" />
              </>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.03]" />

          <h3 className="relative text-sm font-bold uppercase tracking-wider text-slate-400">Ambiente</h3>
          <div className="relative mt-4 space-y-3">
            <EnvRow icon={<Globe className="h-4 w-4" />} label="Base" value="Produção" status="online" />
            <EnvRow icon={<Database className="h-4 w-4" />} label="Sankhya" value="Conectado" status="online" />
            <EnvRow icon={<Code2 className="h-4 w-4" />} label="API" value="Operacional" status="online" />
            <EnvRow icon={<Terminal className="h-4 w-4" />} label="Cache" value="Ativo" status="online" />
          </div>
        </div>
      </section>

      {/* Footer note — Liquid Glass */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-emerald-500/[0.03] px-4 py-3 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/20 to-transparent" />
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-300/80">
          <Shield className="h-3.5 w-3.5" />
          {isDeveloper
            ? 'Área restrita ao perfil Desenvolvedor. Todas as ações são registradas em auditoria.'
            : 'Acesso liberado para Analista de TI com permissões de leitura e edição limitadas.'}
        </div>
      </section>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function LiquidQuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 backdrop-blur-md transition-all duration-300 hover:border-emerald-200/15 hover:bg-emerald-500/[0.04]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] transition-all duration-300 group-hover:text-emerald-300 group-hover:ring-emerald-200/20">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium text-slate-300 transition-colors group-hover:text-white">{label}</span>
      <ArrowUpRight className="h-4 w-4 text-slate-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-400" />
    </Link>
  )
}

function EnvRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode
  label: string
  value: string
  status: 'online' | 'offline' | 'warning'
}) {
  const statusColor =
    status === 'online' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.05]">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-40', statusColor)} />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', statusColor)} />
        </span>
        <span className="text-xs font-semibold text-slate-300">{value}</span>
      </div>
    </div>
  )
}
