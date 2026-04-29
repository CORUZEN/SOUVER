'use client'

import { useQuery } from '@tanstack/react-query'

export type TrendDay = {
  date: string
  batches: number
  movements: number
  ncs: number
}

export type TrendResponse = {
  days: TrendDay[]
}

async function fetchTrend(): Promise<TrendResponse> {
  const response = await fetch('/api/dashboard/trend?days=7')
  if (!response.ok) throw new Error('Falha ao carregar tendência')
  return response.json()
}

export function useDashboardTrend() {
  return useQuery<TrendResponse>({
    queryKey: ['dashboard', 'trend'],
    queryFn: fetchTrend,
    staleTime: 120_000,
    retry: 1,
  })
}
