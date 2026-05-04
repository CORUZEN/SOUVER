'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSellersAllowlist } from '@/lib/client/hooks/use-metas'
import {
  AlertTriangle,
  Box,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

interface AllowedSeller {
  code?: string | null
  name: string
  active: boolean
}

interface OrderItem {
  productCode: string
  productName: string
  group: string
  unit: string
  quantity: number
  weightKg: number
}

type OrderType = 'VENDA' | 'BONIFICACAO' | 'TROCA' | 'OUTROS'

interface OpenOrder {
  orderNumber: string
  sellerCode: string
  sellerName: string
  partnerCode: string
  clientName: string
  city: string
  uf: string
  orderType: OrderType
  orderTypeRaw: string
  tipMov: string
  codTipOper: string
  dtNeg: string
  items: OrderItem[]
}

interface PrevisaoResponse {
  source: 'sankhya'
  date: string
  totalOrders: number
  totalClients: number
  orders: OpenOrder[]
  products: ProductSummary[]
  diagnostics?: {
    orderRows: number
    stockRows: number
    sellersUsed: number[]
    queryError?: string | null
    queryMode?: 'no_date' | 'pending' | 'status_p' | 'all' | 'failed' | string
    dateFrom?: string
    dateTo?: string
    sqlPreview?: string
  }
}

interface ProductSummary {
  productCode: string
  productName: string
  group: string
  unit: string
  totalQuantity: number
  totalWeightKg: number
  stockQty: number
}

/* ─────────────────────────────────────────────
   Constants & Helpers
───────────────────────────────────────────── */

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const [y, m, day] = iso.split('-')
  return `${day}/${m}/${y}`
}

function fmtKg(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function fmtQty(n: number): string {
  return n % 1 === 0 ? n.toLocaleString('pt-BR') : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  VENDA: 'Venda',
  BONIFICACAO: 'Bonificação',
  TROCA: 'Troca',
  OUTROS: 'Outros',
}

const ORDER_TYPE_COLOR: Record<OrderType, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  VENDA: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-600',
  },
  BONIFICACAO: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    icon: 'text-sky-600',
  },
  TROCA: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    icon: 'text-amber-600',
  },
  OUTROS: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
    icon: 'text-slate-600',
  },
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function StatBadge({ label, value, sub, icon, colorKey }: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  colorKey: OrderType | 'default'
}) {
  const colors = colorKey === 'default'
    ? { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700', icon: 'text-slate-500' }
    : ORDER_TYPE_COLOR[colorKey]

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${colors.bg} ${colors.border}`}>
      <div className={`shrink-0 ${colors.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">{label}</p>
        <p className={`text-xl font-bold leading-tight ${colors.text}`}>{value}</p>
        {sub && <p className="text-[11px] opacity-60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  icon,
}: {
  label: string
  placeholder: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  icon: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return options.filter((o) => !selected.includes(o) && o.toLowerCase().includes(q))
  }, [options, selected, search])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function add(value: string) {
    onChange([...selected, value])
    setSearch('')
  }

  function remove(value: string) {
    onChange(selected.filter((s) => s !== value))
  }

  return (
    <div ref={ref} className="relative min-w-[16rem] flex-1">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <div
        className={`min-h-[2.625rem] flex flex-wrap gap-1.5 items-center border rounded-xl px-3 py-2 bg-white cursor-text transition-all
          ${open ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
        onClick={() => setOpen(true)}
      >
        <span className="text-slate-400 shrink-0">{icon}</span>
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full max-w-[10rem]">
            <span className="truncate">{s}</span>
            <button type="button" className="hover:text-red-500 transition-colors shrink-0" onClick={(e) => { e.stopPropagation(); remove(s) }}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[6rem] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
        <button type="button" className="ml-auto shrink-0 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); setSearch('') }}>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500 font-medium">{filtered.length} opção{filtered.length !== 1 ? 'ões' : ''}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { onChange([...options]); setOpen(false); setSearch('') }} className="text-xs text-blue-600 hover:underline font-medium">Todos</button>
              {selected.length > 0 && (
                <button type="button" onClick={() => { onChange([]); setOpen(false); setSearch('') }} className="text-xs text-red-500 hover:underline font-medium">Limpar</button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">{search ? 'Sem resultados' : 'Todos selecionados'}</div>
            ) : (
              filtered.map((o) => (
                <button key={o} type="button" onClick={() => add(o)} className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 truncate">
                  {o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function OrderTable({ orders, title, type }: { orders: OpenOrder[]; title: string; type: OrderType }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const colors = ORDER_TYPE_COLOR[type]

  function toggle(nunota: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nunota)) next.delete(nunota)
      else next.add(nunota)
      return next
    })
  }

  const totalWeight = useMemo(() => orders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.weightKg, 0), 0), [orders])
  const totalItems = useMemo(() => orders.reduce((acc, o) => acc + o.items.length, 0), [orders])

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white shadow-sm overflow-hidden`}>
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${colors.border} ${colors.bg}`}>
        <div className="flex items-center gap-2.5">
          <ClipboardList className={`w-5 h-5 ${colors.icon}`} />
          <h3 className={`text-sm font-bold ${colors.text}`}>{title}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${colors.badge}`}>
            {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span><strong>{fmtKg(totalWeight)}</strong> kg</span>
          <span><strong>{totalItems}</strong> item{totalItems !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          Nenhum pedido em aberto nesta categoria para os filtros aplicados.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.map((order) => {
            const isOpen = expanded.has(order.orderNumber)
            const orderWeight = order.items.reduce((s, i) => s + i.weightKg, 0)
            return (
              <div key={order.orderNumber} className="transition-colors hover:bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => toggle(order.orderNumber)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} ${colors.border} border`}>
                      <Package className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        Pedido {order.orderNumber}
                        <span className="ml-2 text-[11px] font-medium text-slate-400">{order.sellerName}</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {order.clientName}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {order.city}{order.uf ? ` - ${order.uf}` : ''}
                        <span className="mx-1.5 text-slate-300">·</span>
                        Neg. {formatDate(order.dtNeg)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs font-bold text-slate-700">{fmtKg(orderWeight)} kg</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4">
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Grupo</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Peso (kg)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {order.items.map((item, idx) => (
                            <tr key={`${item.productCode}-${idx}`} className="hover:bg-slate-50/60">
                              <td className="px-3 py-2 font-medium text-slate-700">
                                <span className="text-[10px] text-slate-400 block">{item.productCode}</span>
                                {item.productName}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{item.group}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtQty(item.quantity)} <span className="text-[10px] text-slate-400">{item.unit}</span></td>
                              <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtKg(item.weightKg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */

export default function PrevisaoDeEstoque() {
  const today = todayIso()

  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [selectedSellers, setSelectedSellers] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  const [data, setData] = useState<PrevisaoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const { data: allowlistData } = useSellersAllowlist()
  const sellers: AllowedSeller[] = useMemo(() => {
    const list = allowlistData?.sellers ?? []
    return Array.isArray(list)
      ? list.map((s) => ({ code: s.code ?? null, name: s.name, active: s.active ?? true }))
      : []
  }, [allowlistData])

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const sellerCodeList = sellers
        .filter((s) => selectedSellers.length === 0 || selectedSellers.includes(s.name))
        .map((s) => s.code)
        .filter(Boolean)
        .join(',')

      const params = new URLSearchParams({ date: from, dateFrom: from, dateTo: to })
      if (sellerCodeList) params.set('sellers', sellerCodeList)

      const res = await fetch(`/api/faturamento?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json as PrevisaoResponse)
      setLastFetched(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [sellers, selectedSellers])

  const cityOptions = useMemo(() => {
    if (!data) return []
    const set = new Set(data.orders.map((o) => o.uf ? `${o.city} - ${o.uf}` : o.city))
    return [...set].sort()
  }, [data])

  const filteredOrders = useMemo(() => {
    if (!data) return []
    let orders = data.orders
    if (selectedSellers.length > 0) {
      orders = orders.filter((o) => selectedSellers.includes(o.sellerName))
    }
    if (selectedCities.length > 0) {
      orders = orders.filter((o) => selectedCities.includes(o.uf ? `${o.city} - ${o.uf}` : o.city))
    }
    return orders
  }, [data, selectedSellers, selectedCities])

  const groupedOrders = useMemo(() => {
    const groups = { VENDA: [] as OpenOrder[], BONIFICACAO: [] as OpenOrder[], TROCA: [] as OpenOrder[], OUTROS: [] as OpenOrder[] }
    for (const order of filteredOrders) {
      if (groups[order.orderType]) groups[order.orderType].push(order)
      else groups.OUTROS.push(order)
    }
    return groups
  }, [filteredOrders])

  const totals = useMemo(() => {
    const weight = filteredOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.weightKg, 0), 0)
    return {
      orders: filteredOrders.length,
      clients: new Set(filteredOrders.map((o) => o.partnerCode)).size,
      weight,
    }
  }, [filteredOrders])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 [&_button:not(:disabled)]:cursor-pointer">

      {/* ── Header ── */}
      <div className="relative rounded-2xl border-0 bg-linear-to-br from-[#0f2e1f] via-[#1a3a2f] to-[#0f2e1f] shadow-xl overflow-hidden px-6 py-5">
        <div className="absolute inset-x-3 top-0 h-0.5 bg-linear-to-r from-emerald-500 via-emerald-300 to-emerald-500" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200/70">Logística</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Previsão de Estoque</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Pedidos em aberto — {formatDate(dateFrom)} a {formatDate(dateTo)}
              </span>
              {lastFetched && (
                <span className="text-xs text-emerald-200/50">atualizado às {lastFetched}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData(dateFrom, dateTo)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/80 border border-emerald-400/40 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4">
          <MultiSelect
            label="Vendedores"
            placeholder="Selecione um ou mais vendedores…"
            options={sellers.filter((s) => s.active !== false).map((s) => s.name).sort()}
            selected={selectedSellers}
            onChange={setSelectedSellers}
            icon={<Users className="w-4 h-4" />}
          />
          <MultiSelect
            label="Cidades"
            placeholder={data ? 'Filtrar por cidade…' : 'Consulte primeiro para carregar cidades'}
            options={cityOptions}
            selected={selectedCities}
            onChange={setSelectedCities}
            icon={<MapPin className="w-4 h-4" />}
          />
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Período de</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm text-slate-700 bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">até</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:border-slate-300 transition-colors">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm text-slate-700 bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchData(dateFrom, dateTo)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1a3a2f] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#0f2e1f] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consultar
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Erro ao carregar dados</p>
            <p className="text-sm mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBadge label="Total de pedidos" value={totals.orders.toLocaleString('pt-BR')} sub={`${totals.clients} cliente${totals.clients !== 1 ? 's' : ''}`} icon={<ClipboardList className="w-5 h-5" />} colorKey="default" />
          <StatBadge label="Vendas" value={groupedOrders.VENDA.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.VENDA.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<ShoppingCart className="w-5 h-5" />} colorKey="VENDA" />
          <StatBadge label="Bonificações" value={groupedOrders.BONIFICACAO.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.BONIFICACAO.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<Box className="w-5 h-5" />} colorKey="BONIFICACAO" />
          <StatBadge label="Trocas" value={groupedOrders.TROCA.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.TROCA.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<Truck className="w-5 h-5" />} colorKey="TROCA" />
        </div>
      )}

      {/* ── Orders by type ── */}
      {data && (
        <div className="space-y-4">
          <OrderTable orders={groupedOrders.VENDA} title="Pedidos de Venda" type="VENDA" />
          <OrderTable orders={groupedOrders.BONIFICACAO} title="Pedidos de Bonificação" type="BONIFICACAO" />
          <OrderTable orders={groupedOrders.TROCA} title="Pedidos de Troca" type="TROCA" />
          <OrderTable orders={groupedOrders.OUTROS} title="Outros Pedidos" type="OUTROS" />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && data && data.orders.length === 0 && (
        <div className="py-16 flex flex-col items-center text-center text-slate-400 gap-3">
          <Package className="w-12 h-12 opacity-20" />
          <div>
            <p className="font-semibold text-slate-600">Nenhum pedido em aberto</p>
            <p className="text-sm mt-1">Não há pedidos pendentes no período e filtros selecionados.</p>
          </div>
        </div>
      )}
    </div>
  )
}
