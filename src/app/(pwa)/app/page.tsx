'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/client/hooks/use-auth'

export default function PwaEntryPage() {
  const { data: authData, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!authData?.user) {
      window.location.replace('/app/login')
      return
    }

    const roleCode = authData.user.roleCode?.toUpperCase() ?? ''

    if (roleCode === 'COMMERCIAL_SUPERVISOR' || roleCode === 'SALES_SUPERVISOR') {
      window.location.replace('/app/supervisor')
      return
    }

    if (roleCode === 'SELLER') {
      window.location.replace('/app/vendedor')
      return
    }

    if (roleCode === 'DIRECTORATE') {
      window.location.replace('/app/diretoria')
      return
    }

    // Manager / Developer — go to full desktop
    window.location.replace('/metas')
  }, [authData, isLoading])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-950">
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
        <Image
          src="/branding/ouroverde-badge.webp"
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
