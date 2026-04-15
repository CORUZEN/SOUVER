'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Weight,
  Users,
  Target,
  TrendingUp,
  ChevronDown,
  ArrowLeft,
  LogOut,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types / helpers
───────────────────────────────────────────── */
interface Order {
  orderNumber: string
  negotiatedAt: string
  totalValue: number
  grossWeight: number
  clientCode: string
  clientName?: string
}

interface SellertRow {
  id: string
  name: string
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  baseClientCount: number
  orders: Order[]
}

interface UserInfo {
  name: string
  roleCode: string
  sellerCode?: string | null
}

type LoadState = 'idle' | 'loading' | 'success' | 'error'

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
function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function countDistinctClients(orders: Order[]) {
  return new Set(orders.map((o) => o.clientCode).filter(Boolean)).size
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function VendedorPwaDashboard() {
  const router = useRouter()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [user, setUser] = useState<UserInfo | null>(null)
  const [seller, setSeller] = useState<SellertRow | null>(null)
  const [target, setTarget] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showOrders, setShowOrders] = useState(false)

  // Auth
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) { router.replace('/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        if (roleCode !== 'SELLER') { router.replace('/app'); return }
        setUser({ name: data.user.name, roleCode, sellerCode: data.user.sellerCode })
      })
      .catch(() => router.replace('/login'))
  }, [router])

  // Online
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

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

      const myRow: SellertRow | undefined = (perfData.sellers ?? []).find(
        (s: SellertRow) => user?.sellerCode && s.id.replace(/^sankhya-/, '') === user.sellerCode
      ) ?? (perfData.sellers ?? [])[0]

      setSeller(myRow ?? null)

      if (myRow && summaryData?.sellers) {
        const code = myRow.id.replace(/^sankhya-/, '')
        const found = summaryData.sellers.find((s: { code: string; monthlyTarget: number }) => s.code === code)
        setTarget(found?.monthlyTarget ?? 0)
      }
      setLastUpdated(new Date())
      setLoadState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.')
      setLoadState('error')
    }
  }, [year, month, user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    const maxMonth = now.getMonth() + 1
    if (year === now.getFullYear() && month >= maxMonth) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // Derived
  const pct = seller && target > 0 ? (seller.totalValue / target) * 100 : 0
  const clients = seller ? countDistinctClients(seller.orders) : 0
  const gap = target > 0 && seller ? target - seller.totalValue : 0

  function StatusBadge() {
    if (pct >= 107) return <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-400"><TrendingUp className="h-3 w-3" />Superou a Meta</span>
    if (pct >= 100) return <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400"><CheckCircle2 className="h-3 w-3" />Meta Batida</span>
    if (pct >= 65) return <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400"><Clock className="h-3 w-3" />Em Andamento</span>
    return <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400"><AlertCircle className="h-3 w-3" />Abaixo da Meta</span>
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-950 text-white">

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 overflow-hidden rounded-lg">
              <Image src="/branding/ouroverde-badge.png" alt="Ouro Verde" fill sizes="32px" className="object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight text-white">{user.name.split(' ')[0]}</p>
              <p className="text-[10px] text-emerald-400 leading-tight">Meu Painel</p>
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

      {/* Month selector */}
      <div className="flex items-center justify-between border-b border-surface-800 bg-surface-900/60 px-4 py-2">
        <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95">
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-white">{monthLabel(year, month)}</p>
          {lastUpdated && <p className="text-[10px] text-surface-500">Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <button type="button" onClick={nextMonth} disabled={isCurrentMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-30">
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-8 pt-4 space-y-4">

        {loadState === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-sm font-medium text-red-300">Falha ao carregar dados</p>
            <p className="mt-1 text-xs text-red-400/80">{error}</p>
            <button type="button" onClick={() => loadData()} className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30">Tentar novamente</button>
          </div>
        )}

        {loadState === 'loading' && !seller && (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-800" />)}</div>
        )}

        {seller && (
          <>
            {/* Status chip + seller name */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">{seller.name}</p>
                <p className="text-[10px] text-surface-500">Código: {seller.id.replace(/^sankhya-/, '')}</p>
              </div>
              <StatusBadge />
            </div>

            {/* Big progress card */}
            <div className={`rounded-2xl border px-5 py-4 ${
              pct >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' :
              pct >= 65  ? 'border-amber-500/30 bg-amber-500/5' :
                           'border-rose-500/30 bg-rose-500/5'
            }`}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Meta do Mês</p>
                  <p className="text-xl font-bold text-white">{target > 0 ? fmtBrl(target) : '—'}</p>
                </div>
                <p className={`text-3xl font-black ${pct >= 100 ? 'text-emerald-400' : pct >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {fmt(pct, 1)}%
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-700">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-surface-500">
                <span>Realizado: {fmtBrl(seller.totalValue)}</span>
                {gap > 0
                  ? <span className="text-amber-400">Faltam {fmtBrl(gap)}</span>
                  : <span className="text-emerald-400">+{fmtBrl(-gap)} acima</span>
                }
              </div>
            </div>

            {/* Metric grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos" value={fmt(seller.totalOrders)} sub="no mês" />
              <StatCard icon={<Users className="h-4 w-4" />} label="Clientes" value={`${fmt(clients)}`} sub={`meta: ${fmt(seller.baseClientCount)}`} />
              <StatCard icon={<Weight className="h-4 w-4" />} label="Peso Bruto" value={fmtKg(seller.totalGrossWeight)} sub="total" />
              <StatCard
                icon={<Target className="h-4 w-4" />}
                label="Ticket Médio"
                value={seller.totalOrders > 0 ? fmtBrl(seller.totalValue / seller.totalOrders) : '—'}
                sub="por pedido"
              />
            </div>

            {/* Orders list (collapsible) */}
            {seller.orders.length > 0 && (
              <div className="rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() => setShowOrders((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-surface-400" />
                    <span className="text-sm font-semibold text-white">Pedidos do Mês</span>
                    <span className="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-surface-300">{seller.orders.length}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${showOrders ? 'rotate-180' : ''}`} />
                </button>

                {showOrders && (
                  <div className="divide-y divide-surface-800 border-t border-surface-800">
                    {seller.orders
                      .slice()
                      .sort((a, b) => new Date(b.negotiatedAt).getTime() - new Date(a.negotiatedAt).getTime())
                      .map((order) => (
                        <div key={order.orderNumber} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-white">Pedido #{order.orderNumber}</p>
                            <p className="text-[10px] text-surface-500">
                              {new Date(order.negotiatedAt).toLocaleDateString('pt-BR')}
                              {order.clientCode ? ` · CLI ${order.clientCode}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-emerald-400">{fmtBrl(order.totalValue)}</p>
                            <p className="text-[10px] text-surface-500">{fmtKg(order.grossWeight)}</p>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {loadState === 'success' && !seller && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <DollarSign className="h-10 w-10 text-surface-700" />
            <p className="text-sm text-surface-500">Nenhum dado encontrado para este período.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-surface-500">{sub}</p>}
    </div>
  )
}
