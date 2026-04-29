'use client'

import { useQuery } from '@tanstack/react-query'

export type SellerPerformance = {
  id: string
  name: string
  login: string
  orders: Array<{
    orderNumber: string
    negotiatedAt: string
    totalValue: number
    grossWeight: number
    totalVolumes: number
    clientCode: string
  }>
  returns: Array<{ negotiatedAt: string; totalValue: number }>
  openTitles: Array<{
    titleId: string
    dueDate: string
    overdueDays: number
    totalValue: number
  }>
  supervisorCode: string | null
  supervisorName: string | null
  baseClientCount: number
  totalValue: number
  totalReturnedValue: number
  totalOpenTitlesValue: number
  totalGrossWeight: number
  totalOrders: number
}

export type SellersPerformanceResponse = {
  source: string
  year: number
  month: number
  range: { startDate: string; endDateExclusive: string }
  integration: { id: string; name: string }
  policy: { allowlistEnabled: boolean; allowlistCount: number }
  sellers: SellerPerformance[]
}

async function fetchSellersPerformance(
  year: number,
  month: number,
  companyScope: string
): Promise<SellersPerformanceResponse> {
  const response = await fetch(
    `/api/metas/sellers-performance?year=${year}&month=${month}&companyScope=${companyScope}`
  )
  if (!response.ok) throw new Error('Falha ao carregar performance dos vendedores')
  return response.json()
}

export function useSellersPerformance(year: number, month: number, companyScope: string) {
  return useQuery<SellersPerformanceResponse>({
    queryKey: ['metas', 'sellers-performance', year, month, companyScope],
    queryFn: () => fetchSellersPerformance(year, month, companyScope),
    staleTime: 60_000,
    retry: 1,
  })
}

export type MetasConfigResponse = {
  scopeKey: string
  metaConfigs: Record<string, unknown>
  monthConfigs: Record<string, unknown>
  updatedAt: string | null
}

async function fetchMetasConfig(): Promise<MetasConfigResponse> {
  const response = await fetch('/api/metas/config')
  if (!response.ok) throw new Error('Falha ao carregar configuração de metas')
  return response.json()
}

export function useMetasConfig() {
  return useQuery<MetasConfigResponse>({
    queryKey: ['metas', 'config'],
    queryFn: fetchMetasConfig,
    staleTime: 300_000,
    retry: 1,
  })
}

export type PwaSummaryResponse = {
  year: number
  month: number
  roleCode: string
  isSupervisor: boolean
  supervisorCode: string | null
  cycleWeeks: Array<{
    key: string
    start: string
    end: string
    businessDays: string[]
  }>
  sellers: Array<{
    sellerCode: string
    name: string
    monthlyTarget: number
    totalSold: number
    totalReturned: number
    totalOpenTitles: number
    achievementPct: number
    groupProgress: Array<{
      groupKey: string
      targetKg: number
      soldKg: number
      ratio: number
      hit: boolean
    }>
  }>
  totalMonthlyTarget: number
  sellerCount: number
  blocksConfigured: number
  configuredAt: string | null
}

async function fetchPwaSummary(year: number, month: number): Promise<PwaSummaryResponse> {
  const response = await fetch(`/api/pwa/summary?year=${year}&month=${month}`)
  if (!response.ok) throw new Error('Falha ao carregar resumo PWA')
  return response.json()
}

export function usePwaSummary(year: number, month: number) {
  return useQuery<PwaSummaryResponse>({
    queryKey: ['pwa', 'summary', year, month],
    queryFn: () => fetchPwaSummary(year, month),
    staleTime: 60_000,
    retry: 1,
  })
}

export type BrandWeightResponse = { rows: Array<Record<string, unknown>> }

async function fetchBrandWeight(
  year: number,
  month: number,
  companyScope: string,
  stageEnds: Record<string, string>,
): Promise<BrandWeightResponse> {
  const params = new URLSearchParams({ year: String(year), month: String(month), companyScope })
  for (const [key, value] of Object.entries(stageEnds)) {
    if (value) params.set(key, value)
  }
  const response = await fetch(`/api/metas/sellers-performance/brand-weight?${params.toString()}`)
  if (!response.ok) throw new Error('Falha ao carregar pesos por marca')
  return response.json()
}

export function useBrandWeight(
  year: number,
  month: number,
  companyScope: string,
  stageEnds: Record<string, string>,
) {
  return useQuery<BrandWeightResponse>({
    queryKey: ['metas', 'brand-weight', year, month, companyScope, stageEnds],
    queryFn: () => fetchBrandWeight(year, month, companyScope, stageEnds),
    staleTime: 60_000,
    retry: 1,
  })
}

export type ItemDistributionResponse = {
  rows: Array<Record<string, unknown>>
  sellerItems: Array<Record<string, unknown>>
  diagnostics?: { productCodesRequested: number }
}

async function fetchItemDistribution(
  year: number,
  month: number,
  companyScope: string,
  stageEnds: Record<string, string>,
): Promise<ItemDistributionResponse> {
  const params = new URLSearchParams({ year: String(year), month: String(month), companyScope })
  for (const [key, value] of Object.entries(stageEnds)) {
    if (value) params.set(key, value)
  }
  const response = await fetch(`/api/metas/sellers-performance/item-distribution?${params.toString()}`)
  if (!response.ok) throw new Error('Falha ao carregar distribuição de itens')
  return response.json()
}

export function useItemDistribution(
  year: number,
  month: number,
  companyScope: string,
  stageEnds: Record<string, string>,
) {
  return useQuery<ItemDistributionResponse>({
    queryKey: ['metas', 'item-distribution', year, month, companyScope, stageEnds],
    queryFn: () => fetchItemDistribution(year, month, companyScope, stageEnds),
    staleTime: 60_000,
    retry: 1,
  })
}

export type ProductFocusResponse = {
  rows: Array<{ sellerCode: string; soldKg: number; soldClients: number }>
}

async function fetchProductFocus(
  year: number,
  month: number,
  companyScope: string,
  productCode: string,
): Promise<ProductFocusResponse> {
  const response = await fetch(
    `/api/metas/sellers-performance/product-focus?year=${year}&month=${month}&companyScope=${companyScope}&productCode=${encodeURIComponent(productCode)}`
  )
  if (!response.ok) throw new Error('Falha ao carregar dados do produto foco')
  return response.json()
}

export function useProductFocus(
  year: number,
  month: number,
  companyScope: string,
  productCode: string,
) {
  return useQuery<ProductFocusResponse>({
    queryKey: ['metas', 'product-focus', year, month, companyScope, productCode],
    queryFn: () => fetchProductFocus(year, month, companyScope, productCode),
    staleTime: 60_000,
    retry: 1,
    enabled: !!productCode,
  })
}

export type SellersAllowlistResponse = {
  sellers: Array<{
    code?: string | null
    name: string
    profileType?: string
    active?: boolean
    supervisorCode?: string | null
  }>
}

async function fetchSellersAllowlist(): Promise<SellersAllowlistResponse> {
  const response = await fetch('/api/metas/sellers-allowlist')
  if (!response.ok) throw new Error('Falha ao carregar lista de vendedores')
  return response.json()
}

export function useSellersAllowlist() {
  return useQuery<SellersAllowlistResponse>({
    queryKey: ['metas', 'sellers-allowlist'],
    queryFn: fetchSellersAllowlist,
    staleTime: 300_000,
    retry: 1,
  })
}
