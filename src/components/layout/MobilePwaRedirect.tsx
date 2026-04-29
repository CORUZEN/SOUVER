'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/client/hooks/use-auth'

const MOBILE_ROLES = new Set(['COMMERCIAL_SUPERVISOR', 'SELLER', 'DIRECTORATE'])

/**
 * Silently redirects mobile users with supervisor/seller roles to the
 * dedicated PWA view instead of the desktop dashboard.
 * Runs only on the client; no visible UI.
 */
export default function MobilePwaRedirect() {
  const router = useRouter()
  const { data: authData } = useAuth()

  useEffect(() => {
    // Skip on desktop / tablet widths
    if (window.innerWidth >= 768) return
    // Skip if already in standalone PWA or if URL is already /app/*
    if (window.location.pathname.startsWith('/app')) return

    const roleCode = (authData?.user?.roleCode ?? '').toUpperCase()
    if (MOBILE_ROLES.has(roleCode)) {
      router.replace('/app')
    }
  }, [router, authData])

  return null
}
