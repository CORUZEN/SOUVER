'use client'

import { useQuery } from '@tanstack/react-query'

export type KPIData = {
  production: {
    openCount: number
    inProgressCount: number
    inProgress: number
    finishedToday: number
    finished: number
    totalBatches: number
    cancelled: number
    totalProducedQty: number | null
  }
  inventory: {
    totalItems: number
    activeItems: number
    lowStockItems: number
    lowStockCount: number
    movementsToday: number
    totalMovements: number
  }
  quality: {
    openNCs: number
    criticalNCs: number
    totalRecords: number
    approvedRecords: number
    rejectedRecords: number
    pendingRecords: number
    resolvedThisMonth: number
  }
  hr: {
    totalActive: number
    totalInactive: number
    total: number
    with2FA: number
    loggedToday: number
  }
  activeUsers?: number
  period?: string
  variation?: Record<string, number | null>
}

async function fetchKpis(period: string): Promise<KPIData> {
  const response = await fetch(`/api/dashboard/kpis?period=${period}&variation=true`)
  if (!response.ok) throw new Error('Falha ao carregar KPIs')
  return response.json()
}

export function useDashboardKpis(period: string) {
  return useQuery<KPIData>({
    queryKey: ['dashboard', 'kpis', period],
    queryFn: () => fetchKpis(period),
    staleTime: 30_000,
    retry: 1,
  })
}
