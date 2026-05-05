'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSellersAllowlist } from '@/lib/client/hooks/use-metas'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CircleAlert,
  Filter,
  Loader2,
  MapPin,
  Package,
  Search,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react'

/* --------------------------------------------
   Types
-------------------------------------------- */

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
  volume: number
  weightKg: number
}

type OrderType = 'VENDA' | 'BONIFICACAO' | 'TROCA' | 'NAO_CONFIRMADO' | 'OUTROS'

/* Mapeamento de eventos de liberação para badges */
function resolveLiberacaoBadges(eventosLiberacao: string): { label: string; cor: string }[] {
  if (!eventosLiberacao) return []
  const eventos = eventosLiberacao.split(',').map(e => e.trim()).filter(Boolean)
  const badges: { label: string; cor: string }[] = []
  const setoresUsados = new Set<string>()
  for (const ev of eventos) {
    if (ev === '8' && !setoresUsados.has('Financeiro')) {
      setoresUsados.add('Financeiro')
      badges.push({ label: 'Liberação: Financeiro', cor: 'bg-blue-50 text-blue-700 border-blue-200' })
    } else if (ev === '66' && !setoresUsados.has('T.I')) {
      setoresUsados.add('T.I')
      badges.push({ label: 'Liberação: T.I', cor: 'bg-purple-50 text-purple-700 border-purple-200' })
    } else if (['23', '24', '25', '44'].includes(ev) && !setoresUsados.has('Supervisor')) {
      setoresUsados.add('Supervisor')
      badges.push({ label: 'Liberação: Supervisor', cor: 'bg-amber-50 text-amber-700 border-amber-200' })
    } else if (!['8', '66', '23', '24', '25', '44'].includes(ev)) {
      badges.push({ label: `Evento: ${ev}`, cor: 'bg-slate-100 text-slate-600 border-slate-300' })
    }
  }
  return badges
}

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
  aprovado: string
  pendente: string
  statusNota: string
  eventosLiberacao: string
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

interface CityAggregate {
  key: string
  city: string
  uf: string
  orderCount: number
  weightKg: number
}

/* --------------------------------------------
   Constants & Helpers
-------------------------------------------- */

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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  VENDA: 'Venda',
  BONIFICACAO: 'Bonificação',
  TROCA: 'Troca',
  NAO_CONFIRMADO: 'Não Confirmados',
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
  NAO_CONFIRMADO: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-600',
  },
  OUTROS: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
    icon: 'text-slate-600',
  },
}

function resolveBusinessOrderType(order: OpenOrder): Exclude<OrderType, 'NAO_CONFIRMADO'> | 'OUTROS' {
  if (order.orderType === 'VENDA' || order.orderType === 'BONIFICACAO' || order.orderType === 'TROCA') return order.orderType

  const raw = `${order.orderTypeRaw ?? ''} ${order.tipMov ?? ''} ${order.codTipOper ?? ''}`.toUpperCase()
  if (raw.includes('BONIF')) return 'BONIFICACAO'
  if (raw.includes('TROCA')) return 'TROCA'
  if (raw.includes('VENDA') || raw.includes('1001')) return 'VENDA'
  return 'OUTROS'
}

const CITY_TONE_FALLBACK = [
  {
    card: 'border-[#d8e8df] bg-linear-to-b from-[#f7fbf9] to-[#eef7f2]',
    icon: 'bg-[#14966f]/12 text-[#14966f]',
    badge: 'bg-[#14966f]/10 text-[#0f7f5b]',
    accent: 'from-[#14966f]/70 via-[#31b8a2]/35 to-transparent',
  },
  {
    card: 'border-[#dde3ef] bg-linear-to-b from-[#f8faff] to-[#eff3fc]',
    icon: 'bg-[#3563a9]/12 text-[#3563a9]',
    badge: 'bg-[#3563a9]/10 text-[#294d84]',
    accent: 'from-[#3563a9]/70 via-[#7f9dd1]/35 to-transparent',
  },
  {
    card: 'border-[#efe3d8] bg-linear-to-b from-[#fffaf6] to-[#fbf1e8]',
    icon: 'bg-[#b9762f]/12 text-[#9d5f1d]',
    badge: 'bg-[#b9762f]/12 text-[#8a4e12]',
    accent: 'from-[#c68a3f]/70 via-[#d6aa72]/35 to-transparent',
  },
  {
    card: 'border-[#eadcf0] bg-linear-to-b from-[#fcf8ff] to-[#f4edf9]',
    icon: 'bg-[#7c4aa2]/12 text-[#6d3f90]',
    badge: 'bg-[#7c4aa2]/12 text-[#5f347f]',
    accent: 'from-[#7c4aa2]/70 via-[#ab86c8]/35 to-transparent',
  },
] as const

const STATE_TONES: Record<string, (typeof CITY_TONE_FALLBACK)[number]> = {
  PE: CITY_TONE_FALLBACK[0],
  AL: CITY_TONE_FALLBACK[1],
  BA: CITY_TONE_FALLBACK[2],
  MG: CITY_TONE_FALLBACK[3],
}

function getUfTone(uf?: string | null) {
  const normalized = String(uf ?? '').trim().toUpperCase()
  if (STATE_TONES[normalized]) return STATE_TONES[normalized]
  let sum = 0
  for (let i = 0; i < normalized.length; i += 1) sum += normalized.charCodeAt(i)
  return CITY_TONE_FALLBACK[sum % CITY_TONE_FALLBACK.length]
}

/* --------------------------------------------
   Sub-components
-------------------------------------------- */

function StatBadge({ label, value, sub, icon, colorKey, onClick }: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  colorKey: OrderType | 'default'
  onClick?: () => void
}) {
  const colors = colorKey === 'default'
    ? { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700', icon: 'text-slate-500' }
    : ORDER_TYPE_COLOR[colorKey]

  const clickable = !!onClick

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left w-full transition-all ${colors.bg} ${colors.border} ${clickable ? 'hover:shadow-md hover:scale-[1.02] active:scale-[0.99]' : ''}`}
    >
      <div className={`shrink-0 ${colors.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">{label}</p>
        <p className={`text-xl font-bold leading-tight ${colors.text}`}>{value}</p>
        {sub && <p className="text-[11px] opacity-60 mt-0.5 truncate">{sub}</p>}
      </div>
    </button>
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
        className={`flex flex-wrap gap-1.5 items-center border rounded-xl px-3 py-2 bg-white cursor-text transition-all max-h-16 overflow-y-auto scrollbar-hide
          ${open ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
        onClick={() => setOpen(true)}
        style={{ scrollbarWidth: 'none' }}
      >
        <span className="text-slate-400 shrink-0 self-start mt-0.5">{icon}</span>
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full max-w-40 shrink-0">
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
          className="flex-1 min-w-24 text-sm outline-none focus:ring-0 focus-visible:ring-0 bg-transparent placeholder:text-slate-400"
        />
        <button type="button" className="ml-auto shrink-0 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); setSearch('') }}>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500 font-medium">{filtered.length} {filtered.length === 1 ? 'opção' : 'opções'}</span>
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

function OrderModal({
  orders,
  title,
  type,
  onClose,
}: {
  orders: OpenOrder[]
  title: string
  type: OrderType
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterLiberacao, setFilterLiberacao] = useState<string[]>([])
  const [filterTipo, setFilterTipo] = useState<string[]>([])
  const [filterVendedor, setFilterVendedor] = useState<string[]>([])
  const [filterCidade, setFilterCidade] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const colors = ORDER_TYPE_COLOR[type]

  function toggle(nunota: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nunota)) next.delete(nunota)
      else next.add(nunota)
      return next
    })
  }

  // Opções únicas derivadas dos pedidos deste modal
  const vendedorOptions = useMemo(() => [...new Set(orders.map(o => o.sellerName))].sort(), [orders])
  const cidadeOptions = useMemo(() => [...new Set(orders.map(o => o.city))].sort(), [orders])
  const tipoOptions: { key: OrderType; label: string }[] = [
    { key: 'VENDA', label: 'Venda' },
    { key: 'BONIFICACAO', label: 'Bonificação' },
    { key: 'TROCA', label: 'Troca' },
    { key: 'OUTROS', label: 'Outros' },
  ]
  const liberacaoOptions = [
    { key: 'Financeiro', label: 'Financeiro' },
    { key: 'T.I', label: 'T.I' },
    { key: 'Supervisor', label: 'Supervisor' },
  ]

  function toggleArrayValue<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
  }

  const activeFilterCount = filterLiberacao.length + filterTipo.length + filterVendedor.length + filterCidade.length + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0)

  const filteredOrders = useMemo(() => {
    let result = orders

    // Busca por texto
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (o) =>
          o.orderNumber.includes(q) ||
          o.clientName.toLowerCase().includes(q) ||
          o.sellerName.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q)
      )
    }

    // Filtro tipo de liberação
    if (filterLiberacao.length > 0) {
      result = result.filter(o => {
        const setores = resolveLiberacaoBadges(o.eventosLiberacao).map(b => b.label.replace('Liberação: ', ''))
        return filterLiberacao.some(f => setores.includes(f))
      })
    }

    // Filtro tipo de pedido
    if (filterTipo.length > 0) {
      result = result.filter(o => filterTipo.includes(o.orderType))
    }

    // Filtro vendedor
    if (filterVendedor.length > 0) {
      result = result.filter(o => filterVendedor.includes(o.sellerName))
    }

    // Filtro cidade
    if (filterCidade.length > 0) {
      result = result.filter(o => filterCidade.includes(o.city))
    }

    // Filtro data
    if (filterDateFrom) {
      result = result.filter(o => o.dtNeg >= filterDateFrom)
    }
    if (filterDateTo) {
      result = result.filter(o => o.dtNeg <= filterDateTo)
    }

    return result
  }, [orders, search, filterLiberacao, filterTipo, filterVendedor, filterCidade, filterDateFrom, filterDateTo])

  const totalWeight = useMemo(
    () => filteredOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.weightKg, 0), 0),
    [filteredOrders]
  )
  const totalItems = useMemo(
    () => filteredOrders.reduce((acc, o) => acc + o.items.length, 0),
    [filteredOrders]
  )

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.border} ${colors.bg}`}>
          <div className="flex items-center gap-2.5">
            <ClipboardList className={`w-5 h-5 ${colors.icon}`} />
            <h3 className={`text-sm font-bold ${colors.text}`}>{title}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${colors.badge}`}>
              {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500">
              <strong>{fmtKg(totalWeight)}</strong> kg · <strong>{totalItems}</strong> item{totalItems !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="px-5 py-3 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número, cliente, vendedor ou cidade..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors shrink-0',
                activeFilterCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              {/* Tipo de Liberação */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tipo de Liberação</p>
                <div className="flex flex-wrap gap-2">
                  {liberacaoOptions.map(({ key, label }) => (
                    <label key={key} className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors select-none',
                      filterLiberacao.includes(key)
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={filterLiberacao.includes(key)}
                        onChange={() => setFilterLiberacao(prev => toggleArrayValue(prev, key))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Tipo de Pedido */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tipo de Pedido</p>
                <div className="flex flex-wrap gap-2">
                  {tipoOptions.map(({ key, label }) => (
                    <label key={key} className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors select-none',
                      filterTipo.includes(key)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={filterTipo.includes(key)}
                        onChange={() => setFilterTipo(prev => toggleArrayValue(prev, key))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Vendedor */}
              {vendedorOptions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Vendedor</p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-thin">
                    {vendedorOptions.map(name => (
                      <label key={name} className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors select-none',
                        filterVendedor.includes(name)
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      )}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={filterVendedor.includes(name)}
                          onChange={() => setFilterVendedor(prev => toggleArrayValue(prev, name))}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Cidade */}
              {cidadeOptions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Cidade</p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-thin">
                    {cidadeOptions.map(name => (
                      <label key={name} className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors select-none',
                        filterCidade.includes(name)
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      )}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={filterCidade.includes(name)}
                          onChange={() => setFilterCidade(prev => toggleArrayValue(prev, name))}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Data */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Período de Negociação</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                    />
                  </div>
                  <span className="text-xs text-slate-400">até</span>
                  <div className="relative flex-1">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterLiberacao([])
                    setFilterTipo([])
                    setFilterVendedor([])
                    setFilterCidade([])
                    setFilterDateFrom('')
                    setFilterDateTo('')
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors underline"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {filteredOrders.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">
              {search ? 'Nenhum pedido encontrado para esta busca.' : 'Nenhum pedido em aberto nesta categoria para os filtros aplicados.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const isOpen = expanded.has(order.orderNumber)
                const orderWeight = order.items.reduce((s, i) => s + i.weightKg, 0)
                const confirmada = order.statusNota === 'L' ? 'Sim' : 'Não'
                const pendente = order.pendente === 'S' ? 'Sim' : 'Não'
                const businessType = resolveBusinessOrderType(order)
                const businessLabel = businessType === 'OUTROS' ? 'Outros' : ORDER_TYPE_LABEL[businessType]
                const businessColors = businessType === 'OUTROS' ? ORDER_TYPE_COLOR.OUTROS : ORDER_TYPE_COLOR[businessType]
                return (
                  <div key={order.orderNumber} className="transition-colors hover:bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => toggle(order.orderNumber)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} ${colors.border} border`}>
                          <Package className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(order.orderNumber) }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  copyToClipboard(order.orderNumber)
                                }
                              }}
                              className="cursor-pointer rounded px-1 -mx-1 hover:bg-slate-100 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              title="Clique para copiar número do pedido"
                            >
                              Pedido {order.orderNumber}
                            </span>
                            <span className="ml-2 text-[11px] font-medium text-slate-400">{order.sellerName}</span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {order.clientName}
                            <span className="mx-1.5 text-slate-300">·</span>
                            {order.city}{order.uf ? ` - ${order.uf}` : ''}
                            <span className="mx-1.5 text-slate-300">·</span>
                            Neg. {formatDate(order.dtNeg)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${order.statusNota === 'L' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              Confirmada: {confirmada}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${order.pendente === 'S' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                              Pendente: {pendente}
                            </span>
                            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', businessColors.badge, businessColors.border)}>
                              Tipo: {businessLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        {resolveLiberacaoBadges(order.eventosLiberacao).map(({ label, cor }) => (
                          <span key={label} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cor}`}>
                            {label}
                          </span>
                        ))}
                        <span className="text-xs font-semibold text-slate-600 hidden sm:inline">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            <strong>{filteredOrders.length}</strong> pedido{filteredOrders.length !== 1 ? 's' : ''} · <strong>{fmtKg(totalWeight)}</strong> kg
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------
   Main component
-------------------------------------------- */

function UnselectedCitiesModal({
  cities,
  cityOrdersByKey,
  onClose,
}: {
  cities: { key: string; orderCount: number; weightKg: number }[]
  cityOrdersByKey: Map<string, OpenOrder[]>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [expandedCity, setExpandedCity] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cities
    return cities.filter((c) => c.key.toLowerCase().includes(q))
  }, [cities, search])

  const totalOrders = useMemo(() => cities.reduce((s, c) => s + c.orderCount, 0), [cities])
  const totalWeight = useMemo(() => cities.reduce((s, c) => s + c.weightKg, 0), [cities])

  function toggleOrder(nunota: string) {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(nunota)) next.delete(nunota)
      else next.add(nunota)
      return next
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">Cidades não selecionadas</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
              {filtered.length} cidade{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-amber-700/80">
              <strong>{totalOrders}</strong> pedido{totalOrders !== 1 ? 's' : ''} · <strong>{fmtKg(totalWeight)}</strong> kg
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cidade..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">
              {search ? 'Nenhuma cidade encontrada para esta busca.' : 'Nenhuma cidade não selecionada.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((city) => {
                const isOpen = expandedCity === city.key
                const orders = cityOrdersByKey.get(city.key) ?? []
                return (
                  <div key={city.key} className="transition-colors hover:bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setExpandedCity(isOpen ? null : city.key)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 border border-amber-200">
                          <MapPin className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{city.key}</p>
                          <p className="text-xs text-slate-500">
                            {city.orderCount} pedido{city.orderCount !== 1 ? 's' : ''} · {fmtKg(city.weightKg)} kg
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4">
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                          {orders.map((order) => {
                            const orderOpen = expandedOrders.has(order.orderNumber)
                            const orderWeight = order.items.reduce((s, i) => s + i.weightKg, 0)
                            return (
                              <div key={order.orderNumber} className="bg-white">
                                <button
                                  type="button"
                                  onClick={() => toggleOrder(order.orderNumber)}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); copyToClipboard(order.orderNumber) }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            copyToClipboard(order.orderNumber)
                                          }
                                        }}
                                        className="cursor-pointer rounded px-1 -mx-1 hover:bg-slate-100 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                        title="Clique para copiar número do pedido"
                                      >
                                        Pedido {order.orderNumber}
                                      </span>
                                      <span className="ml-2 text-[11px] font-medium text-slate-400">{order.sellerName}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">{order.clientName} · Neg. {formatDate(order.dtNeg)}</p>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700">{fmtKg(orderWeight)} kg</span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${orderOpen ? 'rotate-180' : ''}`} />
                                  </div>
                                </button>
                                {orderOpen && (
                                  <div className="px-4 pb-3">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-semibold text-slate-500">Produto</th>
                                          <th className="text-right px-3 py-2 font-semibold text-slate-500">Qtd</th>
                                          <th className="text-right px-3 py-2 font-semibold text-slate-500">Peso (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {order.items.map((item, idx) => (
                                          <tr key={`${item.productCode}-${idx}`} className="hover:bg-slate-50/60">
                                            <td className="px-3 py-2 font-medium text-slate-700">
                                              <span className="text-[10px] text-slate-400 block">{item.productCode}</span>
                                              {item.productName}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtQty(item.quantity)} <span className="text-[10px] text-slate-400">{item.unit}</span></td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtKg(item.weightKg)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            <strong>{totalOrders}</strong> pedido{totalOrders !== 1 ? 's' : ''} · <strong>{fmtKg(totalWeight)}</strong> kg
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function CityOrdersModal({
  aggregate,
  orders,
  onClose,
}: {
  aggregate: CityAggregate
  orders: OpenOrder[]
  onClose: () => void
}) {
  const cityLabel = aggregate.uf ? `${aggregate.city} - ${aggregate.uf}` : aggregate.city
  return (
    <OrderModal
      orders={orders}
      title={`Pedidos da Cidade: ${cityLabel}`}
      type="VENDA"
      onClose={onClose}
    />
  )
}

export default function PrevisaoDeEstoque() {
  const today = todayIso()

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedSellers, setSelectedSellers] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  const [data, setData] = useState<PrevisaoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)
  const [modalType, setModalType] = useState<OrderType | null>(null)
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null)
  const [showUnselectedCitiesModal, setShowUnselectedCitiesModal] = useState(false)
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const periodRef = useRef<HTMLDivElement>(null)

  type SellerCityPreset = { id: string; sellerName: string; cityKey: string }
  const [sellerPresets, setSellerPresets] = useState<SellerCityPreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)

  type SortKey = 'productCode' | 'productName' | 'quantity' | 'weightKg' | 'stock' | 'status'
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })

  function handleSort(key: SortKey) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 opacity-60" />
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-emerald-600" />
      : <ArrowDown className="ml-1 h-3 w-3 text-emerald-600" />
  }

  const { data: allowlistData } = useSellersAllowlist()
  const sellers: AllowedSeller[] = useMemo(() => {
    const list = allowlistData?.sellers ?? []
    return Array.isArray(list)
      ? list.map((s) => ({ code: s.code ?? null, name: s.name, active: s.active ?? true }))
      : []
  }, [allowlistData])

  /* -- Fecha dropdown de período ao clicar fora -- */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setShowPeriodDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* -- Carrega presets de vendedor-cidade -- */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/faturamento/seller-city-presets', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json.presets) {
          setSellerPresets(json.presets as SellerCityPreset[])
        }
      } catch {
        // silencioso
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function savePresetForSeller(sellerName: string, cityKeys: string[]) {
    setPresetsLoading(true)
    try {
      const res = await fetch('/api/faturamento/seller-city-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerName, cityKeys }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      const json = await res.json()
      setSellerPresets((prev) => prev.filter((p) => p.sellerName !== sellerName).concat(json.presets ?? []))
    } finally {
      setPresetsLoading(false)
    }
  }

  async function removePresetForSeller(sellerName: string) {
    setPresetsLoading(true)
    try {
      const res = await fetch(`/api/faturamento/seller-city-presets?sellerName=${encodeURIComponent(sellerName)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover')
      setSellerPresets((prev) => prev.filter((p) => p.sellerName !== sellerName))
    } finally {
      setPresetsLoading(false)
    }
  }

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const sellerCodeList = sellers
        .filter((s) => selectedSellers.length === 0 || selectedSellers.includes(s.name))
        .map((s) => s.code)
        .filter(Boolean)
        .join(',')

      const effectiveFrom = from || '2020-01-01'
      const effectiveTo = to || today
      const params = new URLSearchParams({ date: effectiveFrom, dateFrom: effectiveFrom, dateTo: effectiveTo })
      if (sellerCodeList) params.set('sellers', sellerCodeList)

      const res = await fetch(`/api/faturamento?${params}`, { cache: 'no-store' })
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
    let orders = data.orders
    if (selectedSellers.length > 0) {
      orders = orders.filter((o) => selectedSellers.includes(o.sellerName))
    }
    const set = new Set(orders.map((o) => o.uf ? `${o.city} - ${o.uf}` : o.city))
    return [...set].sort()
  }, [data, selectedSellers])

  /* -- Limpa cidades selecionadas que não existem mais nas opções -- */
  useEffect(() => {
    if (!data) return
    const available = new Set(cityOptions)
    setSelectedCities((prev) => {
      const filtered = prev.filter((c) => available.has(c))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [cityOptions, data])

  /* -- Aplica presets automaticamente quando muda vendedor (após consulta) -- */
  useEffect(() => {
    if (!data || selectedSellers.length !== 1) return
    const sellerName = selectedSellers[0]
    const presetCities = sellerPresets
      .filter((p) => p.sellerName === sellerName)
      .map((p) => p.cityKey)
    if (presetCities.length > 0) {
      // Só aplica se houver cidades disponíveis no resultado atual que correspondam
      const available = new Set(cityOptions)
      const toSelect = presetCities.filter((c) => available.has(c))
      if (toSelect.length > 0) {
        setSelectedCities(toSelect)
      }
    }
  }, [selectedSellers, data, sellerPresets, cityOptions])

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
    const groups = { VENDA: [] as OpenOrder[], BONIFICACAO: [] as OpenOrder[], TROCA: [] as OpenOrder[], NAO_CONFIRMADO: [] as OpenOrder[], OUTROS: [] as OpenOrder[] }
    for (const order of filteredOrders) {
      // Pedidos pendentes mas não confirmados (não liberados) vão para atenção especial
      if (order.pendente === 'S' && order.statusNota !== 'L') {
        groups.NAO_CONFIRMADO.push(order)
        continue
      }
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

  const stockMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!data) return map
    for (const p of data.products) {
      map.set(p.productCode, p.stockQty)
    }
    return map
  }, [data])

  const productAggregates = useMemo(() => {
    const map = new Map<string, { productCode: string; productName: string; unit: string; quantity: number; weightKg: number }>()
    for (const order of filteredOrders) {
      for (const item of order.items) {
        const existing = map.get(item.productCode)
        if (existing) {
          existing.quantity += item.quantity
          existing.weightKg += item.weightKg
        } else {
          map.set(item.productCode, {
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit,
            quantity: item.quantity,
            weightKg: item.weightKg,
          })
        }
      }
    }
    return Array.from(map.values())
  }, [filteredOrders])

  const sortedProductAggregates = useMemo(() => {
    const arr = [...productAggregates]
    if (!sortConfig.key) return arr.sort((a, b) => a.productName.localeCompare(b.productName))

    arr.sort((a, b) => {
      let cmp = 0
      switch (sortConfig.key) {
        case 'productCode':
          cmp = a.productCode.localeCompare(b.productCode)
          break
        case 'productName':
          cmp = a.productName.localeCompare(b.productName)
          break
        case 'quantity':
          cmp = a.quantity - b.quantity
          break
        case 'weightKg':
          cmp = a.weightKg - b.weightKg
          break
        case 'stock': {
          const stockA = stockMap.get(a.productCode) ?? 0
          const stockB = stockMap.get(b.productCode) ?? 0
          cmp = stockA - stockB
          break
        }
        case 'status': {
          const stockA = stockMap.get(a.productCode) ?? 0
          const stockB = stockMap.get(b.productCode) ?? 0
          const diffA = stockA - a.quantity
          const diffB = stockB - b.quantity
          cmp = diffA - diffB
          break
        }
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
    return arr
  }, [productAggregates, sortConfig, stockMap])

  const cityAggregates = useMemo<CityAggregate[]>(() => {
    const map = new Map<string, CityAggregate>()
    for (const order of filteredOrders) {
      const key = order.uf ? `${order.city} - ${order.uf}` : order.city
      const existing = map.get(key)
      const orderWeight = order.items.reduce((s, i) => s + i.weightKg, 0)
      if (existing) {
        existing.orderCount += 1
        existing.weightKg += orderWeight
      } else {
        map.set(key, { key, city: order.city, uf: order.uf, orderCount: 1, weightKg: orderWeight })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.weightKg - a.weightKg)
  }, [filteredOrders])

  const cityOrdersByKey = useMemo(() => {
    const map = new Map<string, OpenOrder[]>()
    for (const order of filteredOrders) {
      const key = order.uf ? `${order.city} - ${order.uf}` : order.city
      const list = map.get(key)
      if (list) list.push(order)
      else map.set(key, [order])
    }
    return map
  }, [filteredOrders])

  const selectedCityAggregate = useMemo(
    () => cityAggregates.find((c) => c.key === selectedCityKey) ?? null,
    [cityAggregates, selectedCityKey]
  )

  const unselectedCitiesAlert = useMemo(() => {
    if (!data || selectedCities.length === 0) return null
    const unselected = cityOptions
      .filter((c) => !selectedCities.includes(c))
      .map((key) => {
        const orders = cityOrdersByKey.get(key) ?? []
        return { key, orderCount: orders.length, weightKg: orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.weightKg, 0), 0) }
      })
      .filter((c) => c.orderCount > 0)
      .sort((a, b) => b.weightKg - a.weightKg)
    if (unselected.length === 0) return null
    const totalOrders = unselected.reduce((s, c) => s + c.orderCount, 0)
    const totalWeight = unselected.reduce((s, c) => s + c.weightKg, 0)
    return { unselected, totalOrders, totalWeight }
  }, [data, selectedCities, cityOptions, cityOrdersByKey])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 [&_button:not(:disabled)]:cursor-pointer">

      {/* -- Header -- */}
      <div className="relative rounded-2xl border-0 bg-linear-to-br from-[#0f2e1f] via-[#1a3a2f] to-[#0f2e1f] shadow-xl px-6 py-5">
        <div className="absolute inset-x-3 top-0 h-0.5 bg-linear-to-r from-emerald-500 via-emerald-300 to-emerald-500" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200/70">Logística</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Previsão de Pedidos</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {dateFrom && dateTo
                  ? `Pedidos em aberto — ${formatDate(dateFrom)} a ${formatDate(dateTo)}`
                  : dateTo
                    ? `Pedidos em aberto — até ${formatDate(dateTo)}`
                    : 'Pedidos em aberto — período não definido'}
              </span>
              {lastFetched && (
                <span className="text-xs text-emerald-200/50">atualizado às {lastFetched}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Consultar geral */}
            <button
              type="button"
              onClick={() => fetchData(dateFrom, dateTo)}
              disabled={loading}
              className={cn(
                'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 text-xs font-bold backdrop-blur-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100',
                loading
                  ? 'border-emerald-300/60 bg-linear-to-r from-emerald-400/25 via-emerald-300/15 to-emerald-500/10 text-white shadow-xl shadow-emerald-900/30 ring-1 ring-emerald-300/40'
                  : 'border-white/30 bg-linear-to-r from-white/20 via-white/15 to-emerald-400/10 text-white shadow-lg shadow-black/10 hover:scale-[1.02] hover:border-white/50 hover:from-white/30 hover:via-white/20 hover:to-emerald-400/20 hover:shadow-xl hover:shadow-emerald-900/20'
              )}
            >
              <span className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {loading ? <Loader2 className="relative z-10 h-4 w-4 animate-spin" /> : <Search className="relative z-10 h-4 w-4" />}
              <span className="relative z-10">{loading ? 'Carregando...' : 'Consultar'}</span>
            </button>

            {/* Period config dropdown */}
            <div ref={periodRef} className="relative">
              <button
                type="button"
                onClick={() => setShowPeriodDropdown((p) => !p)}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-sm transition-all',
                  showPeriodDropdown
                    ? 'border-emerald-300/60 bg-linear-to-r from-emerald-400/25 via-emerald-300/15 to-emerald-500/10 text-white shadow-xl shadow-emerald-900/30 ring-1 ring-emerald-300/40'
                    : 'border-white/20 bg-white/5 text-white/90 hover:border-white/40 hover:bg-white/15 hover:text-white'
                )}
                title="Configurar período"
              >
                <Settings2 className="h-[18px] w-[18px]" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Período da consulta</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">De</label>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 transition-colors">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full text-sm text-slate-700 bg-transparent outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Até</label>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 transition-colors">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full text-sm text-slate-700 bg-transparent outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowPeriodDropdown(false); fetchData(dateFrom, dateTo) }}
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a3a2f] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#0f2e1f] disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Consultar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- Filters -- */}
      {data && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-wrap items-start gap-4">
            <MultiSelect
              label="Vendedores"
              placeholder="Selecione um ou mais vendedores..."
              options={sellers.filter((s) => s.active !== false).map((s) => s.name).sort()}
              selected={selectedSellers}
              onChange={setSelectedSellers}
              icon={<Users className="w-4 h-4" />}
            />
            <MultiSelect
              label="Cidades"
              placeholder="Filtrar por cidade..."
              options={cityOptions}
              selected={selectedCities}
              onChange={setSelectedCities}
              icon={<MapPin className="w-4 h-4" />}
            />

            {/* Preset manager */}
            {selectedSellers.length === 1 && (
              <div className="flex flex-col gap-1.5 min-w-[12rem]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtro pré-definido</label>
                {sellerPresets.some((p) => p.sellerName === selectedSellers[0]) ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {sellerPresets.filter((p) => p.sellerName === selectedSellers[0]).length} cidade(s) salva(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => removePresetForSeller(selectedSellers[0])}
                      disabled={presetsLoading}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => savePresetForSeller(selectedSellers[0], selectedCities.length > 0 ? selectedCities : cityOptions)}
                    disabled={presetsLoading || cityOptions.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                  >
                    {presetsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                    Salvar cidades como padrão
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Loading State (consulta em andamento) -- */}
      {loading && !data && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500/15 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-[0_10px_28px_rgba(20,150,111,0.18)]">
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-600 border-r-emerald-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Consultando pedidos em aberto...</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
            Estamos processando os dados de pedidos, estoque e cidades atendidas.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Carregando dados em tempo real
          </div>
        </div>
      )}

      {/* -- Empty State (antes de consultar) -- */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
              <ClipboardList className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 border-2 border-white shadow-sm">
              <Search className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Previsão de Pedidos</h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">
            Consulte para visualizar todos os pedidos em aberto, estoque disponível e cidades atendidas.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Dados atualizados em tempo real do Sankhya
          </div>
        </div>
      )}

      {/* -- Error -- */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Erro ao carregar dados</p>
            <p className="text-sm mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* -- Aviso: cidades não selecionadas -- */}
      {unselectedCitiesAlert && (
        <button
          type="button"
          onClick={() => setShowUnselectedCitiesModal(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-left transition-all hover:bg-amber-100 hover:shadow-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 border border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {unselectedCitiesAlert.unselected.length} cidade{unselectedCitiesAlert.unselected.length !== 1 ? 's' : ''} não selecionada{unselectedCitiesAlert.unselected.length !== 1 ? 's' : ''} com {unselectedCitiesAlert.totalOrders} pedido{unselectedCitiesAlert.totalOrders !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">
              Clique para ver os detalhes dessas cidades e pedidos · {fmtKg(unselectedCitiesAlert.totalWeight)} kg
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-amber-500 rotate-[-90deg]" />
        </button>
      )}

      {/* -- Stats -- */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatBadge label="Total de pedidos" value={totals.orders.toLocaleString('pt-BR')} sub={`${totals.clients} cliente${totals.clients !== 1 ? 's' : ''}`} icon={<ClipboardList className="w-5 h-5" />} colorKey="default" />
          <StatBadge label="Vendas" value={groupedOrders.VENDA.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.VENDA.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<ShoppingCart className="w-5 h-5" />} colorKey="VENDA" onClick={() => setModalType('VENDA')} />
          <StatBadge label="Bonificações" value={groupedOrders.BONIFICACAO.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.BONIFICACAO.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<Box className="w-5 h-5" />} colorKey="BONIFICACAO" onClick={() => setModalType('BONIFICACAO')} />
          <StatBadge label="Trocas" value={groupedOrders.TROCA.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.TROCA.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<Truck className="w-5 h-5" />} colorKey="TROCA" onClick={() => setModalType('TROCA')} />
          <StatBadge label="Não Confirmados" value={groupedOrders.NAO_CONFIRMADO.length.toLocaleString('pt-BR')} sub={`${fmtKg(groupedOrders.NAO_CONFIRMADO.reduce((a, o) => a + o.items.reduce((s, i) => s + i.weightKg, 0), 0))} kg`} icon={<AlertTriangle className="w-5 h-5" />} colorKey="NAO_CONFIRMADO" onClick={() => setModalType('NAO_CONFIRMADO')} />
        </div>
      )}

      {/* -- Produtos (bloco único, largura total) -- */}
      {data && filteredOrders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col">
          <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                  <Package className="h-4 w-4 text-emerald-700" />
                </span>
                Produtos
              </h3>
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {productAggregates.length} item{productAggregates.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-100/80">
                <tr className="[&_th]:whitespace-nowrap">
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-20">
                    <button type="button" onClick={() => handleSort('productCode')} className="inline-flex items-center cursor-pointer hover:text-emerald-700 transition-colors">
                      SKU <SortIcon column="productCode" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    <button type="button" onClick={() => handleSort('productName')} className="inline-flex items-center cursor-pointer hover:text-emerald-700 transition-colors">
                      DESCRIÇÃO <SortIcon column="productName" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-14">UN</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-24">
                    <button type="button" onClick={() => handleSort('quantity')} className="inline-flex items-center justify-end w-full cursor-pointer hover:text-emerald-700 transition-colors">
                      QTD <SortIcon column="quantity" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-36">
                    <button type="button" onClick={() => handleSort('weightKg')} className="inline-flex items-center justify-end w-full cursor-pointer hover:text-emerald-700 transition-colors">
                      PESO TOTAL <SortIcon column="weightKg" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-24">
                    <button type="button" onClick={() => handleSort('stock')} className="inline-flex items-center justify-end w-full cursor-pointer hover:text-emerald-700 transition-colors">
                      ESTOQUE <SortIcon column="stock" />
                    </button>
                  </th>
                  <th className="px-1 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 w-36">
                    <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center justify-center w-full cursor-pointer hover:text-emerald-700 transition-colors">
                      COBERTURA <SortIcon column="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedProductAggregates.map((p, index) => {
                  const stock = stockMap.get(p.productCode) ?? 0
                  const diff = stock - p.quantity
                  const hasStock = diff >= 0

                  const missingKg = Math.abs(diff) * (p.quantity > 0 ? p.weightKg / p.quantity : 0)

                  return (
                    <tr key={p.productCode} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} transition-colors hover:bg-emerald-50/40`}>
                      <td className={cn('px-3 py-3.5 text-sm font-medium whitespace-nowrap', hasStock ? 'text-slate-600' : 'text-rose-600')}>{p.productCode}</td>
                      <td className={cn('px-3 py-3.5 font-semibold', hasStock ? 'text-slate-800' : 'text-rose-700')}>{p.productName}</td>
                      <td className={cn('px-3 py-3.5 text-center font-medium whitespace-nowrap', hasStock ? 'text-slate-600' : 'text-rose-600')}>{p.unit}</td>
                      <td className={cn('px-3 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap', hasStock ? 'text-slate-800' : 'text-rose-600')}>{fmtQty(p.quantity)}</td>
                      <td className={cn('px-3 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap', hasStock ? 'text-slate-800' : 'text-rose-600')}>{fmtKg(p.weightKg)} <span className="text-xs font-medium text-slate-400">kg</span></td>
                      <td className={cn('px-3 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap', hasStock ? 'text-slate-800' : 'text-rose-600')}>{fmtQty(stock)}</td>
                      <td className="px-0 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center rounded-xl border text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
                            hasStock
                              ? 'border-emerald-300/80 bg-linear-to-b from-emerald-50 to-emerald-100/70 text-emerald-800 px-2 py-1'
                              : 'border-rose-300/80 bg-linear-to-b from-rose-50 to-rose-100/70 text-rose-800 px-2 py-1.5'
                          )}
                        >
                          {hasStock ? (
                            <span className="tracking-[0.01em]">SUFICIENTE</span>
                          ) : (
                            <span className="flex flex-col items-center leading-tight">
                              <span className="tracking-[0.01em]">FALTA {fmtQty(Math.abs(diff))} {p.unit}</span>
                              <span className="text-[10px] font-medium opacity-80">{fmtKg(missingKg)} kg</span>
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Cidades Atendidas (grid 3 colunas, design profissional) -- */}
      {data && filteredOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-linear-to-r from-[#f6f8f7] to-white">
            <h3 className="text-base font-bold text-[#0f2a1d] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#14966f]" />
              Cidades Atendidas — {cityAggregates.length} cidade{cityAggregates.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cityAggregates.map((c) => {
                const tone = getUfTone(c.uf)
                return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setSelectedCityKey(c.key)}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5',
                    tone.card
                  )}
                >
                  {/* Subtle top accent */}
                  <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-linear-to-r opacity-70 transition-opacity duration-300 group-hover:opacity-100', tone.accent)} />

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone.icon)}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0f2a1d] truncate leading-tight">{c.city}</p>
                      </div>
                    </div>
                    {c.uf && (
                      <span className={cn('shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', tone.badge)}>
                        {c.uf}
                      </span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="my-3 h-px bg-[#e8ece3]" />

                  {/* Stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-[#7ea07d]" />
                      <span className="text-xs text-[#5a6d55]">
                        <span className="font-bold text-[#0f2a1d]">{c.orderCount}</span> pedido{c.orderCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-[#7ea07d]" />
                      <span className="text-xs font-bold text-[#0f2a1d]">{fmtKg(c.weightKg)} <span className="text-[10px] font-medium text-[#7ea07d]">kg</span></span>
                    </div>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </div>
      )}

      {/* -- Order Modal -- */}
      {modalType && data && (
        <OrderModal
          orders={groupedOrders[modalType]}
          title={modalType === 'VENDA' ? 'Pedidos de Venda' : modalType === 'BONIFICACAO' ? 'Pedidos de Bonificação' : modalType === 'TROCA' ? 'Pedidos de Troca' : modalType === 'NAO_CONFIRMADO' ? 'Pedidos Não Confirmados' : 'Outros Pedidos'}
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}

      {selectedCityAggregate && (
        <CityOrdersModal
          aggregate={selectedCityAggregate}
          orders={cityOrdersByKey.get(selectedCityAggregate.key) ?? []}
          onClose={() => setSelectedCityKey(null)}
        />
      )}

      {showUnselectedCitiesModal && unselectedCitiesAlert && (
        <UnselectedCitiesModal
          cities={unselectedCitiesAlert.unselected}
          cityOrdersByKey={cityOrdersByKey}
          onClose={() => setShowUnselectedCitiesModal(false)}
        />
      )}

      {/* -- Empty -- */}
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



