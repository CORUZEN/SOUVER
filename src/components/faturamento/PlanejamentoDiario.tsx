'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSellersAllowlist } from '@/lib/client/hooks/use-metas'
import {
  AlertTriangle,
  BookMarked,
  Box,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Users,
  Warehouse,
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

interface DailyOrder {
  orderNumber: string
  sellerCode: string
  sellerName: string
  partnerCode: string
  clientName: string
  city: string
  uf: string
  items: OrderItem[]
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

interface SavedFilterList {
  id: string
  name: string
  excludedClientCodes: string[]
  createdAt: string
}

interface City {
  code: string
  name: string
  ufCode: string
  uf: string
}

type View = 'dashboard' | 'cities'

interface FaturamentoData {
  date: string
  totalOrders: number
  totalClients: number
  orders: DailyOrder[]
  products: ProductSummary[]
}

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const LS_FILTER_LISTS = 'faturamento-filter-lists-v1'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
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
  return n % 1 === 0 ? n.toString() : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

// ── Multi-select combobox ────────────────────
interface MultiSelectProps {
  label: string
  placeholder: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  icon?: React.ReactNode
}

function MultiSelectCombobox({ label, placeholder, options, selected, onChange, icon }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () =>
      options.filter(
        (o) =>
          !selected.includes(o) &&
          o.toLowerCase().includes(search.toLowerCase().trim())
      ),
    [options, selected, search]
  )

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    inputRef.current?.focus()
  }

  function remove(value: string) {
    onChange(selected.filter((s) => s !== value))
  }

  function selectAll() {
    onChange([...options])
    setOpen(false)
    setSearch('')
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-55">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div
        className={`min-h-10.5 flex flex-wrap gap-1.5 items-center border rounded-xl px-3 py-2 bg-white cursor-text transition-all duration-150
          ${open ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full max-w-40"
          >
            <span className="truncate">{s}</span>
            <button
              type="button"
              className="hover:text-red-500 transition-colors shrink-0"
              onClick={(e) => { e.stopPropagation(); remove(s) }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-20 text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
        <button
          type="button"
          className="ml-auto shrink-0 text-slate-400 hover:text-slate-600"
          onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); setSearch('') }}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500 font-medium">
              {filtered.length} opção{filtered.length !== 1 ? 'ões' : ''}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline font-medium">
                Todos
              </button>
              {selected.length > 0 && (
                <button type="button" onClick={clearAll} className="text-xs text-red-500 hover:underline font-medium">
                  Limpar
                </button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">
                {search ? 'Sem resultados' : 'Todos selecionados'}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => add(o)}
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 truncate"
                >
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

// ── Stat card ────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${colors[color]}`}>
      <div className="shrink-0 text-current opacity-80">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70 truncate">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Cities management view
───────────────────────────────────────────── */

interface CitiesViewProps {
  cities: City[]
  onBack: () => void
  onSyncDone: (cities: City[]) => void
}

function CitiesView({ cities, onBack, onSyncDone }: CitiesViewProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)
  const [filterName, setFilterName] = useState('')
  const [filterUf, setFilterUf] = useState('')

  const ufOptions = useMemo(
    () => [...new Set(cities.map((c) => c.uf).filter(Boolean))].sort(),
    [cities]
  )

  const filtered = useMemo(() => {
    let list = cities
    if (filterUf) list = list.filter((c) => c.uf === filterUf)
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return list
  }, [cities, filterName, filterUf])

  async function doSync() {
    setSyncing(true)
    setSyncError(null)
    setSyncSuccess(null)
    try {
      const res = await fetch('/api/faturamento/cities/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      onSyncDone(json.cities ?? [])
      setSyncSuccess(json.message ?? `${json.count} cidades sincronizadas.`)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative rounded-2xl border-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl overflow-hidden px-6 py-5">
        <div className="absolute inset-x-3 top-0 h-0.5 bg-linear-to-r from-blue-500 via-cyan-400 to-emerald-400" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Logística · Planejamento de Faturamento</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Lista de Cidades</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {cities.length} cidade{cities.length !== 1 ? 's' : ''} na lista
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={doSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60 transition-all"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar Sankhya
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Voltar ao painel
            </button>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Erro ao sincronizar</p>
            <p className="text-sm mt-0.5 opacity-80">{syncError}</p>
          </div>
        </div>
      )}
      {syncSuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-emerald-700">
          <MapPin className="w-5 h-5 shrink-0" />
          <p className="font-semibold text-sm">{syncSuccess}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="relative flex-1 min-w-50">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Buscar por nome da cidade…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <select
            value={filterUf}
            onChange={(e) => setFilterUf(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            <option value="">Todos os estados</option>
            {ufOptions.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500 font-medium shrink-0">
            {filtered.length.toLocaleString('pt-BR')} de {cities.length.toLocaleString('pt-BR')}
          </span>
        </div>

        {cities.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center text-slate-400 gap-4">
            <MapPin className="w-12 h-12 opacity-20" />
            <div>
              <p className="font-semibold text-slate-600">Nenhuma cidade na lista</p>
              <p className="text-sm mt-1">Clique em <strong>Sincronizar Sankhya</strong> para importar todas as cidades.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Cód.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Cód. UF</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sigla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.slice(0, 500).map((city, i) => (
                  <tr key={`${city.code}-${i}`} className={`hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400">{city.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{city.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{city.ufCode}</td>
                    <td className="px-4 py-2.5">
                      {city.uf && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          {city.uf}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="px-5 py-3 text-xs text-slate-500 text-center border-t border-slate-100 bg-slate-50">
                Exibindo 500 de {filtered.length.toLocaleString('pt-BR')} resultados. Use o filtro para restringir a busca.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */

export default function PlanejamentoDiario() {
  const today = todayIso()
  const tomorrow = tomorrowIso()

  // ── View ──────────────────────────────────
  const [view, setView] = useState<View>('dashboard')

  // ── Filter state ─────────────────────────
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedSellers, setSelectedSellers] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  // ── Exclusion list state ──────────────────
  const [excludedClients, setExcludedClients] = useState<string[]>([])
  const [clientInputValue, setClientInputValue] = useState('')
  const [savedLists, setSavedLists] = useState<SavedFilterList[]>([])
  const [saveListName, setSaveListName] = useState('')
  const [exclusionPanelOpen, setExclusionPanelOpen] = useState(false)
  const [savedListsOpen, setSavedListsOpen] = useState(false)

  // ── Data state ────────────────────────────
  const [cities, setCities] = useState<City[]>([])
  const [data, setData] = useState<FaturamentoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  // ── Load saved lists from localStorage ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_FILTER_LISTS)
      if (raw) setSavedLists(JSON.parse(raw) as SavedFilterList[])
    } catch { /* ignore */ }
  }, [])

  function persistLists(lists: SavedFilterList[]) {
    setSavedLists(lists)
    try { localStorage.setItem(LS_FILTER_LISTS, JSON.stringify(lists)) } catch { /* ignore */ }
  }

  const { data: allowlistData } = useSellersAllowlist()
  const sellers: AllowedSeller[] = useMemo(() => {
    const list = allowlistData?.sellers ?? []
    return Array.isArray(list)
      ? list.map((s) => ({ code: s.code ?? null, name: s.name, active: s.active ?? true }))
      : []
  }, [allowlistData])

  // ── Load cities on mount ─────────
  useEffect(() => {
    fetch('/api/faturamento/cities')
      .then((r) => r.ok ? r.json() : { cities: [] })
      .then((d) => setCities(Array.isArray(d.cities) ? d.cities : []))
      .catch(() => setCities([]))
  }, [])

  // ── Derived seller options ────────────────
  const sellerOptions = useMemo(
    () => sellers.filter((s) => s.active !== false).map((s) => s.name).sort(),
    [sellers]
  )

  // ── City options from stored list ─────────
  const cityOptions = useMemo(() => {
    if (cities.length > 0) {
      return cities.map((c) => c.uf ? `${c.name} - ${c.uf}` : c.name).sort()
    }
    // Fallback: derive from loaded orders
    if (!data) return []
    const set = new Set(data.orders.map((o) => o.uf ? `${o.city} - ${o.uf}` : o.city).filter(Boolean))
    return [...set].sort()
  }, [cities, data])

  // ── Apply client-side filters ─────────────
  const filteredOrders = useMemo(() => {
    if (!data) return []
    let orders = data.orders

    // Filter by selected sellers (by name)
    if (selectedSellers.length > 0) {
      orders = orders.filter((o) => selectedSellers.includes(o.sellerName))
    }

    // Filter by selected cities
    if (selectedCities.length > 0) {
      orders = orders.filter((o) => selectedCities.includes(o.city))
    }

    // Filter out excluded clients
    if (excludedClients.length > 0) {
      const excSet = new Set(excludedClients.map((c) => c.trim()))
      orders = orders.filter((o) => !excSet.has(o.partnerCode))
    }

    return orders
  }, [data, selectedSellers, selectedCities, excludedClients])

  // ── Recompute product totals after client-side filters ──
  const filteredProducts = useMemo(() => {
    const totals = new Map<string, ProductSummary>()
    for (const order of filteredOrders) {
      for (const item of order.items) {
        const existing = totals.get(item.productCode)
        if (existing) {
          existing.totalQuantity += item.quantity
          existing.totalWeightKg += item.weightKg
        } else {
          // Use stockQty from original products list
          const originalProduct = data?.products.find((p) => p.productCode === item.productCode)
          totals.set(item.productCode, {
            productCode: item.productCode,
            productName: item.productName,
            group: item.group,
            unit: item.unit,
            totalQuantity: item.quantity,
            totalWeightKg: item.weightKg,
            stockQty: originalProduct?.stockQty ?? 0,
          })
        }
      }
    }
    return Array.from(totals.values()).sort((a, b) => a.productName.localeCompare(b.productName))
  }, [filteredOrders, data])

  // ── Stats ─────────────────────────────────
  const totalWeight = useMemo(
    () => filteredProducts.reduce((acc, p) => acc + p.totalWeightKg, 0),
    [filteredProducts]
  )
  const uniqueClients = useMemo(
    () => new Set(filteredOrders.map((o) => o.partnerCode)).size,
    [filteredOrders]
  )
  const uniqueCitiesCount = useMemo(
    () => new Set(filteredOrders.map((o) => o.city)).size,
    [filteredOrders]
  )

  // ── Fetch data ────────────────────────────
  const fetchData = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      // Build seller codes from selected sellers
      const sellerCodeList = sellers
        .filter((s) => selectedSellers.length === 0 || selectedSellers.includes(s.name))
        .map((s) => s.code)
        .filter(Boolean)
        .join(',')

      const params = new URLSearchParams({ date })
      if (sellerCodeList) params.set('sellers', sellerCodeList)

      const res = await fetch(`/api/faturamento?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json as FaturamentoData)
      setLastFetched(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [sellers, selectedSellers])

  // Auto-fetch on mount with today
  useEffect(() => {
    if (sellers.length > 0) fetchData(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellers])

  // ── Client exclusion helpers ──────────────
  function addExcludedClient() {
    const value = clientInputValue.trim()
    if (!value) return
    // Allow comma-separated codes
    const codes = value.split(/[,;\s]+/).map((c) => c.trim()).filter(Boolean)
    const newSet = [...new Set([...excludedClients, ...codes])]
    setExcludedClients(newSet)
    setClientInputValue('')
  }

  function removeExcludedClient(code: string) {
    setExcludedClients((prev) => prev.filter((c) => c !== code))
  }

  function saveCurrentList() {
    const name = saveListName.trim()
    if (!name || excludedClients.length === 0) return
    const newList: SavedFilterList = {
      id: crypto.randomUUID(),
      name,
      excludedClientCodes: [...excludedClients],
      createdAt: new Date().toISOString(),
    }
    persistLists([...savedLists, newList])
    setSaveListName('')
  }

  function deleteList(id: string) {
    persistLists(savedLists.filter((l) => l.id !== id))
  }

  function applyList(list: SavedFilterList) {
    setExcludedClients(list.excludedClientCodes)
  }

  // ── Quick date buttons ────────────────────
  function setQuickDate(iso: string) {
    setSelectedDate(iso)
    if (sellers.length > 0) fetchData(iso)
  }

  /* ──────────────────────────────────────────
     Cities view guard
  ────────────────────────────────────────── */

  if (view === 'cities') {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <CitiesView
          cities={cities}
          onBack={() => setView('dashboard')}
          onSyncDone={(updated) => setCities(updated)}
        />
      </div>
    )
  }

  /* ──────────────────────────────────────────
     Dashboard view
  ────────────────────────────────────────── */

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 [&_button:not(:disabled)]:cursor-pointer">

      {/* ── Header (metas-style dark card) ── */}
      <div className="relative rounded-2xl border-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl overflow-hidden px-6 py-5">
        <div className="absolute inset-x-3 top-0 h-0.5 bg-linear-to-r from-blue-500 via-cyan-400 to-emerald-400" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Branding */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Logística · Planejamento</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">Planejamento de Faturamento</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                Pedidos em aberto — {formatDate(selectedDate)}
              </span>
              {lastFetched && (
                <span className="text-xs text-slate-500">atualizado às {lastFetched}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Cities management */}
            <button
              type="button"
              onClick={() => setView('cities')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              <MapPin className="w-3.5 h-3.5" />
              Lista de Cidades
              {cities.length > 0 && (
                <span className="rounded-full bg-blue-500/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-200">
                  {cities.length.toLocaleString('pt-BR')}
                </span>
              )}
            </button>

            {/* Quick dates */}
            <button
              type="button"
              onClick={() => setQuickDate(today)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                selectedDate === today
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(tomorrow)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                selectedDate === tomorrow
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Amanhã
            </button>

            {/* Date picker */}
            <div className="flex items-center gap-1.5 border border-white/20 rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20 transition-colors">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold text-white bg-transparent outline-none cursor-pointer scheme-dark"
              />
            </div>

            <button
              type="button"
              onClick={() => fetchData(selectedDate)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/80 border border-emerald-400/40 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Filter bar ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Filtros de visualização</h2>
            {(selectedSellers.length > 0 || selectedCities.length > 0) && (
              <button
                type="button"
                onClick={() => { setSelectedSellers([]); setSelectedCities([]) }}
                className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <MultiSelectCombobox
              label="Vendedores"
              placeholder="Filtrar por vendedor…"
              options={sellerOptions}
              selected={selectedSellers}
              onChange={setSelectedSellers}
              icon={<Users className="w-4 h-4" />}
            />
            <MultiSelectCombobox
              label="Cidades"
              placeholder={cities.length === 0 ? 'Sincronize em "Lista de Cidades"' : 'Filtrar por cidade…'}
              options={cityOptions}
              selected={selectedCities}
              onChange={setSelectedCities}
              icon={<MapPin className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* ── Client exclusion panel ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExclusionPanelOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <UserMinus className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-bold text-slate-700">Exclusão de clientes</span>
              {excludedClients.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  {excludedClients.length} cliente{excludedClients.length !== 1 ? 's' : ''} excluído{excludedClients.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${exclusionPanelOpen ? 'rotate-90' : ''}`} />
          </button>

          {exclusionPanelOpen && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              {/* Input row */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Adicionar código(s) de cliente
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Digite o código do parceiro (CODPARC) a excluir. Separe múltiplos com vírgula ou espaço.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientInputValue}
                    onChange={(e) => setClientInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcludedClient() } }}
                    placeholder="Ex: 100, 250, 8964"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addExcludedClient}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
              </div>

              {/* Exclusion chips */}
              {excludedClients.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes excluídos</span>
                    <button type="button" onClick={() => setExcludedClients([])} className="text-xs text-red-500 hover:underline">
                      Limpar todos
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {excludedClients.map((code) => {
                      const order = data?.orders.find((o) => o.partnerCode === code)
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium px-3 py-1.5 rounded-full"
                        >
                          <span className="font-bold">{code}</span>
                          {order && <span className="opacity-70 truncate max-w-30">— {order.clientName}</span>}
                          <button type="button" onClick={() => removeExcludedClient(code)} className="hover:text-red-600 transition-colors shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Save / load lists */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                {/* Save current */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Salvar lista de exclusão
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveListName}
                      onChange={(e) => setSaveListName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCurrentList() } }}
                      placeholder="Nome da lista (ex: Grandes redes)"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      disabled={excludedClients.length === 0}
                    />
                    <button
                      type="button"
                      onClick={saveCurrentList}
                      disabled={!saveListName.trim() || excludedClients.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                    >
                      <Save className="w-4 h-4" /> Salvar
                    </button>
                  </div>
                </div>

                {/* Saved lists */}
                {savedLists.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setSavedListsOpen((p) => !p)}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <BookMarked className="w-3.5 h-3.5" />
                      Listas salvas ({savedLists.length})
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${savedListsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {savedListsOpen && (
                      <div className="mt-2 space-y-2">
                        {savedLists.map((list) => (
                          <div
                            key={list.id}
                            className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-700 truncate">{list.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {list.excludedClientCodes.length} cliente{list.excludedClientCodes.length !== 1 ? 's' : ''}
                                {' · '}
                                <span className="font-mono text-slate-400">{list.excludedClientCodes.slice(0, 4).join(', ')}{list.excludedClientCodes.length > 4 ? '…' : ''}</span>
                              </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => applyList(list)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                Aplicar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteList(list.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Erro ao carregar dados</p>
              <p className="text-sm mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Consultando Sankhya…</span>
          </div>
        )}

        {/* ── Data panels ── */}
        {!loading && data && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="Pedidos"
                value={String(filteredOrders.length)}
                sub={filteredOrders.length !== data.totalOrders ? `de ${data.totalOrders} total` : 'no período filtrado'}
                icon={<ClipboardList className="w-5 h-5" />}
                color="blue"
              />
              <StatCard
                label="Clientes"
                value={String(uniqueClients)}
                sub={`${uniqueCitiesCount} cidade${uniqueCitiesCount !== 1 ? 's' : ''}`}
                icon={<Users className="w-5 h-5" />}
                color="violet"
              />
              <StatCard
                label="Produtos distintos"
                value={String(filteredProducts.length)}
                sub="SKUs únicos"
                icon={<Package className="w-5 h-5" />}
                color="emerald"
              />
              <StatCard
                label="Peso total"
                value={`${fmtKg(totalWeight)} kg`}
                sub="a faturar no dia"
                icon={<Box className="w-5 h-5" />}
                color="amber"
              />
              {excludedClients.length > 0 && (
                <StatCard
                  label="Excluídos"
                  value={String(excludedClients.length)}
                  sub="clientes fora do cálculo"
                  icon={<UserMinus className="w-5 h-5" />}
                  color="rose"
                />
              )}
            </div>

            {/* ── Product table ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Produtos a faturar</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} · {formatDate(selectedDate)}
                    </p>
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Nenhum produto encontrado com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">SKU</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produto</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Grupo</th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Un.</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Qtd. Pedida</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Peso (kg)</th>
                        <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Estoque atual</th>
                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map((product, i) => {
                        const stockOk = product.stockQty >= product.totalQuantity
                        const stockLow = !stockOk && product.stockQty > 0
                        const stockZero = product.stockQty <= 0
                        return (
                          <tr
                            key={product.productCode}
                            className={`transition-colors hover:bg-slate-50/80 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                          >
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">{product.productCode}</td>
                            <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-70">
                              <span className="truncate block">{product.productName}</span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                                {product.group || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-500 uppercase">{product.unit}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">{fmtQty(product.totalQuantity)}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">{fmtKg(product.totalWeightKg)}</td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <span
                                className={`font-bold ${stockZero ? 'text-red-600' : stockLow ? 'text-amber-600' : 'text-emerald-600'}`}
                              >
                                {fmtQty(product.stockQty)}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">{product.unit}</span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {stockZero ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                                  <TrendingDown className="w-3 h-3" /> Sem estoque
                                </span>
                              ) : stockLow ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                  <AlertTriangle className="w-3 h-3" /> Estoque baixo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                  <TrendingUp className="w-3 h-3" /> OK
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-200">
                        <td colSpan={4} className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Total — {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-800 whitespace-nowrap">
                          {fmtQty(filteredProducts.reduce((a, p) => a + p.totalQuantity, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-800 whitespace-nowrap">
                          {fmtKg(totalWeight)} kg
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Orders detail table ── */}
            <OrdersDetailTable orders={filteredOrders} />
          </>
        )}

        {/* Empty state (no data loaded yet) */}
        {!loading && !error && !data && (
          <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400 gap-4">
            <Warehouse className="w-14 h-14 opacity-20" />
            <div>
              <p className="font-semibold text-slate-600 text-base">Selecione uma data e clique em Atualizar</p>
              <p className="text-sm mt-1">Os pedidos em aberto serão carregados do Sankhya</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Orders detail sub-component
───────────────────────────────────────────── */

function OrdersDetailTable({ orders }: { orders: DailyOrder[] }) {
  const [expanded, setExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<'seller' | 'city'>('seller')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return orders
    const q = searchQuery.toLowerCase()
    return orders.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.sellerName.toLowerCase().includes(q) ||
        o.orderNumber.includes(q) ||
        o.partnerCode.includes(q)
    )
  }, [orders, searchQuery])

  // Group orders
  const grouped = useMemo(() => {
    const map = new Map<string, DailyOrder[]>()
    for (const order of filtered) {
      const key = groupBy === 'seller' ? order.sellerName : (order.uf ? `${order.city} — ${order.uf}` : order.city)
      const arr = map.get(key) ?? []
      arr.push(order)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupBy])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-slate-500" />
          <div className="text-left">
            <span className="text-sm font-bold text-slate-800">Pedidos detalhados</span>
            <span className="ml-2 text-xs text-slate-500 font-medium">({orders.length} pedido{orders.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center bg-slate-50">
            <div className="relative flex items-center gap-2 flex-1 min-w-50">
              <Search className="w-4 h-4 text-slate-400 absolute left-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pedido, cliente, cidade…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              Agrupar por:
              <button
                type="button"
                onClick={() => setGroupBy('seller')}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${groupBy === 'seller' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 hover:border-slate-300'}`}
              >
                Vendedor
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('city')}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${groupBy === 'city' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 hover:border-slate-300'}`}
              >
                Cidade
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-150 overflow-y-auto overscroll-contain">
            {grouped.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Nenhum resultado.</div>
            ) : (
              grouped.map(([groupKey, groupOrders]) => (
                <OrderGroup key={groupKey} label={groupKey} orders={groupOrders} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function OrderGroup({ label, orders }: { label: string; orders: DailyOrder[] }) {
  const [open, setOpen] = useState(true)
  const totalItems = orders.reduce((a, o) => a + o.items.length, 0)
  const totalWeight = orders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.weightKg, 0), 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
          <span className="font-bold text-sm text-slate-700 truncate">{label}</span>
          <span className="text-xs text-slate-500 font-medium">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {fmtKg(totalWeight)} kg
          </span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-50">
          {orders.map((order) => (
            <OrderRow key={order.orderNumber} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderRow({ order }: { order: DailyOrder }) {
  const [open, setOpen] = useState(false)
  const weight = order.items.reduce((a, i) => a + i.weightKg, 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-blue-50/40 transition-colors text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="font-mono text-xs text-slate-400 w-16 shrink-0">#{order.orderNumber}</span>
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{order.clientName}</span>
        <span className="text-xs text-slate-500 shrink-0">{order.city}{order.uf ? ` · ${order.uf}` : ''}</span>
        <span className="text-xs text-slate-500 shrink-0">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
        <span className="text-xs font-semibold text-slate-600 shrink-0 w-24 text-right">{fmtKg(weight)} kg</span>
      </button>
      {open && (
        <div className="mx-6 mb-2 rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Produto</th>
                <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Grupo</th>
                <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Qtd</th>
                <th className="text-center px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Un</th>
                <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Peso kg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {order.items.map((item, i) => (
                <tr key={`${item.productCode}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-slate-400">{item.productCode}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 max-w-50 truncate">{item.productName}</td>
                  <td className="px-3 py-2 text-slate-500">{item.group}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-700">{fmtQty(item.quantity)}</td>
                  <td className="px-3 py-2 text-center text-slate-500 uppercase">{item.unit}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-700">{fmtKg(item.weightKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
