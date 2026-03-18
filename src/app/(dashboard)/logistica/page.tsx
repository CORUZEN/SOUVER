'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Trash2,
  RotateCcw,
  Sliders,
  ChevronRight,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string
  sku: string
  name: string
  description?: string | null
  category?: string | null
  unit: string
  currentQty: number
  minQty?: number | null
  maxQty?: number | null
  location?: string | null
  isActive: boolean
  createdBy: { id: string; fullName: string }
  createdAt: string
  _count?: { movements: number }
}

interface InventoryMovement {
  id: string
  type: string
  quantity: number
  unit: string
  qtyBefore: number
  qtyAfter: number
  reason?: string | null
  batchRef?: string | null
  supplier?: string | null
  documentRef?: string | null
  movedAt: string
  createdBy: { id: string; fullName: string }
  item?: { id: string; name: string; sku: string; unit: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
  TRANSFER: 'Transferência',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolução',
  WASTE: 'Descarte',
}

const MOVEMENT_ICONS: Record<string, React.ReactNode> = {
  ENTRY: <TrendingUp size={14} className="text-green-600" />,
  EXIT: <TrendingDown size={14} className="text-red-600" />,
  TRANSFER: <ArrowLeftRight size={14} className="text-blue-600" />,
  ADJUSTMENT: <Sliders size={14} className="text-yellow-600" />,
  RETURN: <RotateCcw size={14} className="text-purple-600" />,
  WASTE: <Trash2 size={14} className="text-red-700" />,
}

const MOVEMENT_VARIANTS: Record<string, 'success' | 'error' | 'info' | 'warning' | 'default'> = {
  ENTRY: 'success',
  EXIT: 'error',
  TRANSFER: 'info',
  ADJUSTMENT: 'warning',
  RETURN: 'default',
  WASTE: 'error',
}

function isLowStock(item: InventoryItem) {
  return item.minQty != null && Number(item.currentQty) <= Number(item.minQty)
}

function formatQty(qty: number | null | undefined, unit?: string) {
  if (qty == null) return '—'
  return `${Number(qty).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unit ?? ''}`
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LogisticaPage() {
  // Listagem
  const [items, setItems] = useState<InventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [filterActive, setFilterActive] = useState<string>('true')

  // Detalhe / Movimentações
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Modal Item
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [itemForm, setItemForm] = useState({
    sku: '', name: '', description: '', category: '',
    unit: 'kg', minQty: '', maxQty: '', location: '',
  })

  // Modal Movimentação
  const [showMovModal, setShowMovModal] = useState(false)
  const [savingMov, setSavingMov] = useState(false)
  const [movForm, setMovForm] = useState({
    type: 'ENTRY', quantity: '', reason: '',
    supplier: '', documentRef: '', batchRef: '',
  })

  // ─── Busca ─────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) params.set('search', search)
      if (filterActive) params.set('isActive', filterActive)
      if (filterLowStock) params.set('lowStock', 'true')
      const res = await fetch(`/api/inventory/items?${params}`)
      if (!res.ok) throw new Error('Falha ao carregar itens')
      const data = await res.json()
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterActive, filterLowStock])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ─── Detalhe ───────────────────────────────────────────────────────────────

  async function openDetail(item: InventoryItem) {
    setSelectedItem(item)
    setLoadingMovements(true)
    try {
      const res = await fetch(`/api/inventory/movements?itemId=${item.id}&pageSize=30`)
      const data = await res.json()
      setMovements(data.items ?? [])
    } catch {
      setMovements([])
    } finally {
      setLoadingMovements(false)
    }
  }

  // ─── Salvar Item ───────────────────────────────────────────────────────────

  function openCreateItem() {
    setEditingItem(null)
    setItemForm({ sku: '', name: '', description: '', category: '', unit: 'kg', minQty: '', maxQty: '', location: '' })
    setShowItemModal(true)
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item)
    setItemForm({
      sku: item.sku,
      name: item.name,
      description: item.description ?? '',
      category: item.category ?? '',
      unit: item.unit,
      minQty: item.minQty != null ? String(item.minQty) : '',
      maxQty: item.maxQty != null ? String(item.maxQty) : '',
      location: item.location ?? '',
    })
    setShowItemModal(true)
  }

  async function handleSaveItem() {
    setSavingItem(true)
    try {
      const body = {
        name: itemForm.name,
        description: itemForm.description || undefined,
        category: itemForm.category || undefined,
        unit: itemForm.unit,
        minQty: itemForm.minQty ? Number(itemForm.minQty) : undefined,
        maxQty: itemForm.maxQty ? Number(itemForm.maxQty) : undefined,
        location: itemForm.location || undefined,
        ...(editingItem ? {} : { sku: itemForm.sku }),
      }
      const url = editingItem ? `/api/inventory/items/${editingItem.id}` : '/api/inventory/items'
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Erro ao salvar item')
        return
      }
      setShowItemModal(false)
      fetchItems()
    } finally {
      setSavingItem(false)
    }
  }

  // ─── Movimentação ──────────────────────────────────────────────────────────

  async function handleRegisterMovement() {
    if (!selectedItem) return
    setSavingMov(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          type: movForm.type,
          quantity: Number(movForm.quantity),
          reason: movForm.reason || undefined,
          supplier: movForm.supplier || undefined,
          documentRef: movForm.documentRef || undefined,
          batchRef: movForm.batchRef || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Erro ao registrar movimentação')
        return
      }
      setShowMovModal(false)
      setMovForm({ type: 'ENTRY', quantity: '', reason: '', supplier: '', documentRef: '', batchRef: '' })
      // Recarregar dados
      const updated = await fetch(`/api/inventory/items/${selectedItem.id}`).then(r => r.json())
      setSelectedItem(updated)
      openDetail(updated)
      fetchItems()
    } finally {
      setSavingMov(false)
    }
  }

  // ─── Toggle ativo ──────────────────────────────────────────────────────────

  async function toggleActive(item: InventoryItem) {
    await fetch(`/api/inventory/items/${item.id}`, { method: 'PATCH' })
    fetchItems()
    if (selectedItem?.id === item.id) {
      setSelectedItem(s => s ? { ...s, isActive: !s.isActive } : null)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package size={22} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900">Logística / Estoque</h1>
            <p className="text-sm text-surface-500">Itens e movimentações de estoque</p>
          </div>
        </div>
        <Button onClick={openCreateItem} className="flex items-center gap-2">
          <Plus size={16} /> Novo Item
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por SKU, nome ou categoria..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <select
              value={filterActive}
              onChange={e => { setFilterActive(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="true">Somente ativos</option>
              <option value="false">Somente inativos</option>
              <option value="">Todos</option>
            </select>
            <label className="flex items-center gap-2 px-3 py-2 border border-surface-200 rounded-lg bg-white cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={filterLowStock}
                onChange={e => { setFilterLowStock(e.target.checked); setPage(1) }}
                className="accent-primary"
              />
              <AlertTriangle size={14} className="text-yellow-600" />
              Estoque baixo
            </label>
            <Button variant="outline" onClick={fetchItems} title="Atualizar">
              <RefreshCw size={15} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Listagem de Itens */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs text-surface-500 font-medium uppercase tracking-wide pl-1">
            {total} item{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Spinner /></div>
          ) : error ? (
            <ErrorState title={error} onRetry={fetchItems} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum item encontrado"
              description="Cadastre o primeiro item de estoque."
              action={<Button onClick={openCreateItem} className="flex items-center gap-2"><Plus size={14} /> Novo Item</Button>}
            />
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-sm ${
                    selectedItem?.id === item.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-semibold text-primary">{item.sku}</span>
                        {isLowStock(item) && (
                          <span title="Estoque abaixo do mínimo">
                            <AlertTriangle size={12} className="text-yellow-600" />
                          </span>
                        )}
                        {!item.isActive && (
                          <Badge variant="error" size="sm">Inativo</Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm text-surface-900 truncate">{item.name}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {item.category ?? 'Sem categoria'} · {item.location ?? 'Sem localização'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-sm font-bold ${isLowStock(item) ? 'text-yellow-700' : 'text-green-700'}`}>
                        {formatQty(item.currentQty, item.unit)}
                      </span>
                      <ChevronRight size={14} className="text-surface-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <span className="px-3 py-2 text-sm text-surface-600">{page} / {totalPages}</span>
              <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Próxima</Button>
            </div>
          )}
        </div>

        {/* Painel de Detalhe */}
        <div className="lg:col-span-3">
          {!selectedItem ? (
            <div className="h-full flex items-center justify-center text-surface-400 border-2 border-dashed border-surface-200 rounded-xl p-12">
              <div className="text-center">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um item para ver os detalhes</p>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-primary">{selectedItem.sku}</span>
                      {isLowStock(selectedItem) && (
                        <Badge variant="warning" size="sm">
                          <AlertTriangle size={10} className="mr-1" /> Estoque Mínimo
                        </Badge>
                      )}
                      {!selectedItem.isActive && <Badge variant="error" size="sm">Inativo</Badge>}
                    </div>
                    <CardTitle>{selectedItem.name}</CardTitle>
                    {selectedItem.description && (
                      <p className="text-sm text-surface-500 mt-1">{selectedItem.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditItem(selectedItem)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedItem.isActive ? 'ghost' : 'outline'}
                      onClick={() => toggleActive(selectedItem)}
                    >
                      {selectedItem.isActive ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4 text-sm">
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Saldo Atual</span>
                    <p className={`text-lg font-bold ${isLowStock(selectedItem) ? 'text-yellow-700' : 'text-green-700'}`}>
                      {formatQty(selectedItem.currentQty, selectedItem.unit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Mínimo / Máximo</span>
                    <p className="font-medium text-surface-800">
                      {formatQty(selectedItem.minQty, selectedItem.unit)} / {formatQty(selectedItem.maxQty, selectedItem.unit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Categoria</span>
                    <p className="font-medium text-surface-800">{selectedItem.category ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-surface-500 text-xs uppercase tracking-wide">Localização</span>
                    <p className="font-medium text-surface-800">{selectedItem.location ?? '—'}</p>
                  </div>
                </div>

                {/* Botão registrar movimento */}
                <div className="border-t border-surface-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-surface-700">Histórico de Movimentações</h3>
                    {selectedItem.isActive && (
                      <Button size="sm" onClick={() => setShowMovModal(true)}>
                        <Plus size={13} className="mr-1" /> Nova Movimentação
                      </Button>
                    )}
                  </div>

                  {loadingMovements ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : movements.length === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-6">Nenhuma movimentação registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {movements.map(mov => (
                        <div key={mov.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-50 border border-surface-100">
                          <div className="mt-0.5">{MOVEMENT_ICONS[mov.type]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={MOVEMENT_VARIANTS[mov.type]} size="sm">
                                {MOVEMENT_LABELS[mov.type]}
                              </Badge>
                              <span className="text-sm font-semibold text-surface-800">
                                {formatQty(mov.quantity, mov.unit)}
                              </span>
                              <span className="text-xs text-surface-400 ml-auto">{formatDate(mov.movedAt)}</span>
                            </div>
                            <p className="text-xs text-surface-500 mt-0.5">
                              {Number(mov.qtyBefore).toLocaleString('pt-BR')} → {Number(mov.qtyAfter).toLocaleString('pt-BR')} {mov.unit}
                              {mov.reason && ` · ${mov.reason}`}
                            </p>
                            {(mov.supplier || mov.documentRef) && (
                              <p className="text-xs text-surface-400">
                                {mov.supplier && `Fornecedor: ${mov.supplier}`}
                                {mov.supplier && mov.documentRef && ' · '}
                                {mov.documentRef && `Doc: ${mov.documentRef}`}
                              </p>
                            )}
                            <p className="text-xs text-surface-400">{mov.createdBy.fullName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Item */}
      <Modal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        title={editingItem ? 'Editar Item' : 'Novo Item de Estoque'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowItemModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={savingItem || !itemForm.name || (!editingItem && !itemForm.sku)}>
              {savingItem ? <><Spinner />Salvando...</> : editingItem ? 'Salvar' : 'Criar Item'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU *"
              value={itemForm.sku}
              onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))}
              placeholder="ex: CAF-GRD-001"
              disabled={!!editingItem}
            />
            <Input
              label="Unidade"
              value={itemForm.unit}
              onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
              placeholder="kg, un, L..."
            />
          </div>
          <Input
            label="Nome *"
            value={itemForm.name}
            onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nome do item"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Categoria"
              value={itemForm.category}
              onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
              placeholder="ex: Matéria-Prima"
            />
            <Input
              label="Localização"
              value={itemForm.location}
              onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))}
              placeholder="ex: Prateleira A-01"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Qtd. Mínima (alerta)"
              type="number"
              min={0}
              step="0.001"
              value={itemForm.minQty}
              onChange={e => setItemForm(f => ({ ...f, minQty: e.target.value }))}
              placeholder="0.000"
            />
            <Input
              label="Qtd. Máxima"
              type="number"
              min={0}
              step="0.001"
              value={itemForm.maxQty}
              onChange={e => setItemForm(f => ({ ...f, maxQty: e.target.value }))}
              placeholder="0.000"
            />
          </div>
          <Textarea
            label="Descrição"
            value={itemForm.description}
            onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrição do item..."
            rows={2}
          />
        </div>
      </Modal>

      {/* Modal Movimentação */}
      <Modal
        open={showMovModal}
        onClose={() => setShowMovModal(false)}
        title={`Nova Movimentação — ${selectedItem?.name ?? ''}`}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowMovModal(false)}>Cancelar</Button>
            <Button onClick={handleRegisterMovement} disabled={savingMov || !movForm.quantity || Number(movForm.quantity) <= 0}>
              {savingMov ? <><Spinner />Registrando...</> : 'Registrar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedItem && (
            <div className="p-3 bg-surface-50 rounded-lg text-sm">
              <span className="font-medium text-surface-700">Saldo atual: </span>
              <span className={`font-bold ${isLowStock(selectedItem) ? 'text-yellow-700' : 'text-green-700'}`}>
                {formatQty(selectedItem.currentQty, selectedItem.unit)}
              </span>
            </div>
          )}
          <Select
            label="Tipo de Movimentação"
            value={movForm.type}
            onChange={e => setMovForm(f => ({ ...f, type: e.target.value }))}
            options={Object.entries(MOVEMENT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Input
            label="Quantidade *"
            type="number"
            min={0.001}
            step="0.001"
            value={movForm.quantity}
            onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))}
            placeholder="0.000"
          />
          <Input
            label="Motivo / Observação"
            value={movForm.reason}
            onChange={e => setMovForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Motivo da movimentação..."
          />
          {movForm.type === 'ENTRY' && (
            <>
              <Input
                label="Fornecedor"
                value={movForm.supplier}
                onChange={e => setMovForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Nome do fornecedor"
              />
              <Input
                label="Nº Documento (NF, Pedido)"
                value={movForm.documentRef}
                onChange={e => setMovForm(f => ({ ...f, documentRef: e.target.value }))}
                placeholder="ex: NF-00001"
              />
            </>
          )}
          {movForm.type === 'EXIT' && (
            <Input
              label="Referência ao Lote de Produção"
              value={movForm.batchRef}
              onChange={e => setMovForm(f => ({ ...f, batchRef: e.target.value }))}
              placeholder="ex: LOT-2026-001"
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
