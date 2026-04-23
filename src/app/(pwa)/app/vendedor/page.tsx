'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PwaLoadingScreen from '@/components/pwa/PwaLoadingScreen'

export default function VendedorPwaRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/supervisor')
  }, [router])

  return <PwaLoadingScreen label="Carregando sistema" progress={35} />
}

