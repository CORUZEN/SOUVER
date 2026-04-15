'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ShoppingCart,
  DollarSign,
  Weight,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface SellerRow {
  id: string
  name: string
  login: string
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  baseClientCount: number
  supervisorCode: string | null
  orders: Array<{ orderNumber: string; negotiatedAt: string; totalValue: number; grossWeight: number; clientCode: string }>
}

interface UserInfo {
  name: string
  role: string
  roleCode: string
  sellerCode?: string | null
}

type LoadState = 'idle' | 'loading' | 'success' | 'error'
type SellerStatus = 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'

const STATUS_CONFIG: Record<SellerStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  SUPEROU: { label: 'Superou', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', Icon: TrendingUp },
  NO_ALVO: { label: 'Meta Batida', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', Icon: CheckCircle2 },
  ATENCAO: { label: 'Em progresso', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', Icon: Clock },
  CRITICO: { label: 'Crítico', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', Icon: AlertCircle },
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(value: number, decimals = 0) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}
function fmtBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)
}
function fmtKg(value: number) {
  if (value >= 1000) return `${fmt(value / 1000, 1)} t`
  return `${fmt(value, 1)} kg`
}
function fmtPct(value: number, decimals = 1) {
  return `${fmt(value, decimals)}%`
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function inferStatus(pct: number): SellerStatus {
  if (pct >= 107) return 'SUPEROU'
  if (pct >= 100) return 'NO_ALVO'
  if (pct >= 65) return 'ATENCAO'
  return 'CRITICO'
}

function countDistinctClients(seller: SellerRow): number {
  const set = new Set<string>()
  for (const order of seller.orders) {
    if (order.clientCode) set.add(order.clientCode)
  }
  return set.size
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function SupervisorPwaDashboard() {
  const router = useRouter()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [user, setUser] = useState<UserInfo | null>(null)
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>({})
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState('')
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) { router.replace('/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        if (roleCode !== 'COMMERCIAL_SUPERVISOR') { router.replace('/app'); return }
        setUser({
          name: data.user.name,
          role: data.user.role,
          roleCode,
          sellerCode: data.user.sellerCode,
        })
      })
      .catch(() => router.replace('/login'))
  }, [router])

  // ── Online status ────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ── Load performance data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError('')
    try {
      const [perfRes, summaryRes] = await Promise.all([
        fetch(`/api/metas/sellers-performance?year=${year}&month=${month}&companyScope=all`, { cache: 'no-store' }),
        fetch(`/api/pwa/summary?year=${year}&month=${month}`, { cache: 'no-store' }),
      ])

      if (!perfRes.ok) {
        const d = await perfRes.json().catch(() => ({}))
        throw new Error(d.message ?? `Erro ${perfRes.status}`)
      }

      const [perfData, summaryData] = await Promise.all([
        perfRes.json(),
        summaryRes.ok ? summaryRes.json() : Promise.resolve(null),
      ])

      setSellers(perfData.sellers ?? [])

      // Build monthly targets map from summary
      const targets: Record<string, number> = {}
      if (summaryData?.sellers) {
        for (const s of summaryData.sellers) {
          if (s.code && s.monthlyTarget > 0) targets[s.code] = s.monthlyTarget
        }
      }
      setMonthlyTargets(targets)
      setLastUpdated(new Date())
      setLoadState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.')
      setLoadState('error')
    }
  }, [year, month])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  // ── Period navigation ─────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    const maxYear = now.getFullYear()
    const maxMonth = now.getMonth() + 1
    if (year > maxYear || (year === maxYear && month >= maxMonth)) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalRevenue = sellers.reduce((s, r) => s + r.totalValue, 0)
  const totalOrders = sellers.reduce((s, r) => s + r.totalOrders, 0)
  const totalWeight = sellers.reduce((s, r) => s + r.totalGrossWeight, 0)
  const totalTarget = sellers.reduce((s, r) => {
    const code = r.id.replace(/^sankhya-/, '')
    return s + (monthlyTargets[code] ?? 0)
  }, 0)
  const overallPct = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0

  const sellerCards = sellers.map((seller) => {
    const code = seller.id.replace(/^sankhya-/, '')
    const target = monthlyTargets[code] ?? 0
    const pct = target > 0 ? (seller.totalValue / target) * 100 : 0
    const status = inferStatus(pct)
    const clients = countDistinctClients(seller)
    return { seller, code, target, pct, status, clients }
  }).sort((a, b) => b.pct - a.pct)

  const metaHit = sellerCards.filter((s) => s.status === 'SUPEROU' || s.status === 'NO_ALVO').length

  /* ── Render ─────────────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-950 text-white">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 overflow-hidden rounded-lg">
              <Image src="/branding/ouroverde-badge.png" alt="Ouro Verde" fill sizes="32px" className="object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight text-white">{user.name.split(' ')[0]}</p>
              <p className="text-[10px] text-emerald-400 leading-tight">Supervisor Comercial</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1">
                <WifiOff className="h-3 w-3 text-red-400" />
                <span className="text-[10px] text-red-400">Offline</span>
              </div>
            )}
            {isOnline && loadState === 'success' && (
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1">
                <Wifi className="h-3 w-3 text-emerald-400" />
              </div>
            )}
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loadState === 'loading'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loadState === 'loading' ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-rose-400 active:scale-95"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Month selector ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-surface-800 bg-surface-900/60 px-4 py-2">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95"
        >
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-white">{monthLabel(year, month)}</p>
          {lastUpdated && (
            <p className="text-[10px] text-surface-500">
              Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-8 pt-4 space-y-4">

        {/* Error */}
        {loadState === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <XCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-300">Falha ao carregar dados</p>
            <p className="mt-1 text-xs text-red-400/80">{error}</p>
            <button
              type="button"
              onClick={() => loadData()}
              className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30 active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loadState === 'loading' && sellers.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-800" />
            ))}
          </div>
        )}

        {loadState !== 'error' && (sellers.length > 0 || loadState === 'success') && (
          <>
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Meta de Faturamento */}
              <div className="col-span-2 rounded-2xl border border-surface-700/50 bg-surface-900 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Meta de Faturamento</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className={`text-2xl font-bold ${overallPct >= 100 ? 'text-emerald-400' : overallPct >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {fmtPct(overallPct)}
                  </p>
                  <p className="text-xs text-surface-400">{metaHit}/{sellers.length} vendedores</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-700">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${overallPct >= 100 ? 'bg-emerald-500' : overallPct >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(overallPct, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-surface-500">
                  <span>Realizado: {fmtBrl(totalRevenue)}</span>
                  <span>Meta: {fmtBrl(totalTarget)}</span>
                </div>
              </div>

              {/* Pedidos */}
              <div className="rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <ShoppingCart className="h-3 w-3" />
                  Pedidos
                </div>
                <p className="mt-1 text-xl font-bold text-white">{fmt(totalOrders)}</p>
                <p className="text-[10px] text-surface-500">no mês</p>
              </div>

              {/* Peso */}
              <div className="rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <Weight className="h-3 w-3" />
                  Peso Total
                </div>
                <p className="mt-1 text-xl font-bold text-white">{fmtKg(totalWeight)}</p>
                <p className="text-[10px] text-surface-500">bruto</p>
              </div>

              {/* Valor */}
              <div className="col-span-2 rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  <DollarSign className="h-3 w-3" />
                  Valor Total dos Pedidos
                </div>
                <p className="mt-1 text-xl font-bold text-white">{fmtBrl(totalRevenue)}</p>
              </div>
            </div>

            {/* ── Seller cards ───────────────────────────────────────────── */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                <Users className="h-4 w-4 text-surface-500" />
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Vendedores</p>
                <span className="ml-auto text-[10px] text-surface-600">{sellers.length} monitorados</span>
              </div>

              {sellerCards.map(({ seller, target, pct, status, clients }, idx) => {
                const cfg = STATUS_CONFIG[status]
                const StatusIcon = cfg.Icon
                const isExpanded = expandedSeller === seller.id

                return (
                  <div
                    key={seller.id}
                    className={`overflow-hidden rounded-2xl border transition-all duration-200 ${cfg.border} ${cfg.bg}`}
                  >
                    {/* Seller header row */}
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left active:opacity-80"
                      onClick={() => setExpandedSeller(isExpanded ? null : seller.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-800 text-xs font-bold text-surface-300">
                          {idx + 1}
                        </div>

                        {/* Name + status */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{seller.name}</p>
                            <div className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-700">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* PCT + chevron */}
                        <div className="shrink-0 text-right">
                          <p className={`text-base font-bold ${cfg.color}`}>{fmtPct(pct)}</p>
                          {isExpanded ? (
                            <ChevronUp className="ml-auto h-3.5 w-3.5 text-surface-500" />
                          ) : (
                            <ChevronDown className="ml-auto h-3.5 w-3.5 text-surface-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded stats */}
                    {isExpanded && (
                      <div className="border-t border-surface-700/40 px-4 pb-4 pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          <MetricCell icon={<DollarSign className="h-3.5 w-3.5" />} label="Faturado" value={fmtBrl(seller.totalValue)} />
                          <MetricCell icon={<Target className="h-3.5 w-3.5" />} label="Meta" value={target > 0 ? fmtBrl(target) : '—'} />
                          <MetricCell icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Pedidos" value={fmt(seller.totalOrders)} />
                          <MetricCell icon={<Users className="h-3.5 w-3.5" />} label="Clientes" value={`${fmt(clients)}/${fmt(seller.baseClientCount)}`} />
                          <MetricCell icon={<Weight className="h-3.5 w-3.5" />} label="Peso Bruto" value={fmtKg(seller.totalGrossWeight)} />
                          <MetricCell
                            icon={seller.totalOrders > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                            label="Ticket Médio"
                            value={seller.totalOrders > 0 ? fmtBrl(seller.totalValue / seller.totalOrders) : '—'}
                          />
                        </div>

                        {/* Gap info */}
                        {target > 0 && pct < 100 && (
                          <div className="mt-2 rounded-lg bg-surface-800/60 px-3 py-2">
                            <p className="text-[10px] text-surface-400">
                              Faltam{' '}
                              <span className="font-semibold text-white">{fmtBrl(target - seller.totalValue)}</span>
                              {' '}para bater a meta
                            </p>
                          </div>
                        )}
                        {pct > 100 && (
                          <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                            <p className="text-[10px] text-emerald-300">
                              <span className="font-semibold">{fmtBrl(seller.totalValue - target)}</span>
                              {' '}acima da meta 🎯
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {sellers.length === 0 && loadState === 'success' && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users className="h-10 w-10 text-surface-700" />
                <p className="text-sm text-surface-500">Nenhum vendedor encontrado para este período.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
function MetricCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-800/60 px-2.5 py-2">
      <div className="flex items-center gap-1 text-surface-400">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
