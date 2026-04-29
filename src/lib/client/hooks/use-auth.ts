'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWithRefresh } from '../fetch-with-refresh'

export type AuthUser = {
  id?: string
  name: string
  email: string
  role?: string | { name?: string; code?: string } | null
  roleCode?: string
  sellerCode?: string
  avatarUrl?: string | null
  impersonation?: {
    active: boolean
    developerName: string
  } | null
  canAccessIntegrations?: boolean
  modulePermissions?: Record<string, boolean>
  metasPermissions?: {
    config?: { view?: boolean; edit?: boolean; save?: boolean; remove?: boolean }
    sellers?: { view?: boolean; edit?: boolean; save?: boolean; remove?: boolean }
    products?: { view?: boolean; edit?: boolean; save?: boolean; remove?: boolean }
  }
}

export type AuthMeResponse = { user?: AuthUser } | null

async function fetchAuthMe(): Promise<AuthMeResponse> {
  const response = await fetchWithRefresh('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  return response.json()
}

export function useAuth() {
  return useQuery<AuthMeResponse>({
    queryKey: ['auth', 'me'],
    queryFn: fetchAuthMe,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
}

export function useInvalidateAuth() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }
}
