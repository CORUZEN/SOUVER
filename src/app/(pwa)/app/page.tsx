'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function PwaEntryPage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const roleCode = data?.user?.roleCode?.toUpperCase() ?? ''

        if (roleCode === 'COMMERCIAL_SUPERVISOR') {
          router.replace('/app/supervisor')
          return
        }

        if (roleCode === 'SELLER') {
          router.replace('/app/vendedor')
          return
        }

        // Manager / Director / Developer — go to full desktop
        router.replace('/metas')
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-950">
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
        <Image
          src="/branding/ouroverde-badge.png"
          alt="Ouro Verde"
          fill
          sizes="64px"
          className="object-contain"
          priority
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold text-white">Ouro Verde</p>
        <p className="text-xs text-surface-400">Carregando…</p>
      </div>
      <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-surface-800">
        <div className="h-full animate-[progress_1.5s_ease-in-out_infinite] rounded-full bg-emerald-500" />
      </div>
    </div>
  )
}
