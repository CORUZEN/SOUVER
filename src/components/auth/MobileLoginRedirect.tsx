'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirects mobile and PWA users to the dedicated mobile login page.
 * Runs only client-side; no render output.
 */
export default function MobileLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    const isPwa =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true

    if (isMobile || isPwa) {
      router.replace('/app/login')
    }
  }, [router])

  return null
}
