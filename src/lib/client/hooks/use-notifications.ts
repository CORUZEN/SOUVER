'use client'

import { useQuery } from '@tanstack/react-query'

export type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export type NotificationsResponse = {
  notifications: Notification[]
  totalUnread: number
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch('/api/notifications?limit=10')
  if (!response.ok) throw new Error('Falha ao carregar notificações')
  return response.json()
}

export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
