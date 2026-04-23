'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { clearPwaClientState } from '@/lib/pwa/clear-client-state'
import PwaLoadingScreen from '@/components/pwa/PwaLoadingScreen'
import { PwaLogoutConfirmDialog, PwaSigningOutOverlay } from '@/components/pwa/PwaLogoutExperience'
import {
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Weight,
  Users,
  Target,
  TrendingUp,
  ChevronDown,
  LogOut,
  CloudOff,
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

function formatHeaderIdentity(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].toUpperCase()
  return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase()
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
  const [bootProgress, setBootProgress] = useState(0)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)
  const hasLoadedInitialDataRef = useRef(false)
  const authCheckStartedRef = useRef(false)
  const activeLoadIdRef = useRef(0)
  const inFlightKeyRef = useRef<string | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Auth
  useEffect(() => {
    if (authCheckStartedRef.current) return
    authCheckStartedRef.current = true
    setBootProgress(5)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) { router.replace('/login'); return }
        const roleCode = data.user.roleCode?.toUpperCase() ?? ''
        if (roleCode !== 'SELLER') { router.replace('/app'); return }
        // Keep continuity between "Validando acesso" and "Carregando metas".
        setBootProgress(15)
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
    const loadKey = `${year}-${month}-${user?.sellerCode ?? ''}`
    if (inFlightKeyRef.current === loadKey) return
    inFlightKeyRef.current = loadKey
    const loadId = ++activeLoadIdRef.current

    setLoadState('loading')
    setError('')
    if (!hasLoadedInitialDataRef.current) setBootProgress((prev) => Math.max(prev, 15))
    // Clear visible data immediately when period changes to avoid stale numbers during loading.
    setSeller(null)
    setTarget(0)
    setLastUpdated(null)
    try {
      let completed = 0
      const total = 2
      let displayedProgress = hasLoadedInitialDataRef.current ? 0 : 15
      const pushProgress = (rawValue: number) => {
        if (loadId !== activeLoadIdRef.current) return
        const clamped = Math.min(Math.max(rawValue, 0), 95)
        const next = Math.max(displayedProgress, clamped)
        if (next !== displayedProgress) {
          displayedProgress = next
          setBootProgress(next)
        }
      }
      const markDone = () => {
        completed += 1
        pushProgress(Math.round((completed / total) * 100))
      }

      const [perfRes, summaryRes] = await Promise.all([
        fetch(`/api/metas/sellers-performance?year=${year}&month=${month}&companyScope=all`, { cache: 'no-store' }).finally(markDone),
        fetch(`/api/pwa/summary?year=${year}&month=${month}`, { cache: 'no-store' }).finally(markDone),
      ])
      if (!perfRes.ok) {
        const d = await perfRes.json().catch(() => ({}))
        throw new Error(d.message ?? `Erro ${perfRes.status}`)
      }
      const [perfData, summaryData] = await Promise.all([
        perfRes.json(),
        summaryRes.ok ? summaryRes.json() : Promise.resolve(null),
      ])
      if (loadId !== activeLoadIdRef.current) return

      const myRow: SellertRow | undefined = (perfData.sellers ?? []).find(
        (s: SellertRow) => user?.sellerCode && s.id.replace(/^sankhya-/, '') === user.sellerCode
      ) ?? (perfData.sellers ?? [])[0]

      setSeller(myRow ?? null)

      if (myRow && summaryData?.sellers) {
        const code = myRow.id.replace(/^sankhya-/, '')
        const found = summaryData.sellers.find((s: { code: string; monthlyTarget: number }) => s.code === code)
        setTarget(found?.monthlyTarget ?? 0)
      }
      setBootProgress(100)
      setLastUpdated(new Date())
      hasLoadedInitialDataRef.current = true
      setHasLoadedInitialData(true)
      setLoadState('success')
    } catch (err) {
      if (loadId !== activeLoadIdRef.current) return
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.')
      hasLoadedInitialDataRef.current = true
      setHasLoadedInitialData(true)
      setLoadState('error')
    } finally {
      if (inFlightKeyRef.current === loadKey) inFlightKeyRef.current = null
    }
  }, [year, month, user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  async function signOut() {
    if (isSigningOut) return
    try {
      setShowSignOutConfirm(false)
      setIsSigningOut(true)
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {})
    } finally {
      await clearPwaClientState()
      window.location.replace('/login')
    }
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
    return <PwaLoadingScreen label="Validando acesso" progress={bootProgress} />
  }

  if (!hasLoadedInitialData && (loadState === 'idle' || loadState === 'loading')) {
    return <PwaLoadingScreen label="Carregando metas" progress={bootProgress} />
  }

  return (
    <div className="pwa-shell flex h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain bg-surface-950 text-white [touch-action:pan-y] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">

      {/* Top bar */}
      <header className="pwa-topbar sticky top-0 z-50 border-b border-surface-800 bg-surface-950/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <Image src="/branding/ouroverde.webp" alt="Ouro Verde" fill sizes="48px" className="object-contain" priority />
            </div>
            <div className="h-9 w-px bg-surface-700/60" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold leading-tight text-white">{formatHeaderIdentity(user.name)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-300 leading-tight">MEU PAINEL</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="pwa-offline-indicator flex h-9 w-9 items-center justify-center rounded-lg" title="Sem conexão com a internet" aria-label="Sem conexão com a internet">
                <CloudOff className="h-4.5 w-4.5" />
              </div>
            )}
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loadState === 'loading'}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loadState === 'loading' ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              disabled={isSigningOut}
              className="pwa-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-rose-400 active:scale-95"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Month selector */}
      <div className="pwa-monthbar flex items-center justify-between border-b border-surface-800 bg-surface-900/60 px-4 py-2">
        <button type="button" onClick={prevMonth} className="pwa-icon-btn flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95">
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-white">{monthLabel(year, month)}</p>
          {lastUpdated && <p className="text-[10px] text-surface-500">Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <button type="button" onClick={nextMonth} disabled={isCurrentMonth} className="pwa-icon-btn flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-white active:scale-95 disabled:opacity-30">
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 pb-8 pt-4 space-y-4">

        {loadState === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-sm font-medium text-red-300">Falha ao carregar dados</p>
            <p className="mt-1 text-xs text-red-400/80">{error}</p>
            <button type="button" onClick={() => loadData()} className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30">Tentar novamente</button>
          </div>
        )}

        {hasLoadedInitialData && loadState === 'loading' && !seller && (
          <div className="flex min-h-80 items-center justify-center">
            <div className="inline-flex items-center gap-2 px-2 py-1">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-300/90" />
              <span className="text-sm font-semibold tracking-[0.01em] text-surface-200/95">Carregando...</span>
            </div>
          </div>
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
            <div className={`pwa-card pwa-card-hero rounded-2xl border px-5 py-4 ${
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
              <div className="pwa-card rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden">
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

      <PwaLogoutConfirmDialog
        open={showSignOutConfirm}
        busy={isSigningOut}
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={signOut}
      />
      <PwaSigningOutOverlay visible={isSigningOut} />
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="pwa-card rounded-2xl border border-surface-700/50 bg-surface-900 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-surface-500">{sub}</p>}
    </div>
  )
}
