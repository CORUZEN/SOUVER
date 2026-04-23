'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAuthMeCached } from '@/lib/client/auth-me-cache'

const MOBILE_ROLES = new Set(['COMMERCIAL_SUPERVISOR', 'SELLER', 'DIRECTORATE'])

/**
 * Silently redirects mobile users with supervisor/seller roles to the
 * dedicated PWA view instead of the desktop dashboard.
 * Runs only on the client; no visible UI.
 */
export default function MobilePwaRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Skip on desktop / tablet widths
    if (window.innerWidth >= 768) return
    // Skip if already in standalone PWA or if URL is already /app/*
    if (window.location.pathname.startsWith('/app')) return

    fetchAuthMeCached()
      .then((data) => {
        const roleCode = (data?.user?.roleCode ?? '').toUpperCase()
        if (MOBILE_ROLES.has(roleCode)) {
          router.replace('/app')
        }
      })
      .catch(() => {/* ignore — don't redirect on network error */})
  }, [router])

  return null
}
