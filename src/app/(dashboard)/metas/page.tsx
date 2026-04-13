import type { Metadata } from 'next'
import MetasWorkspace from '@/components/metas/MetasWorkspace'

export const metadata: Metadata = {
  title: 'Painel de Metas',
}

export default function MetasPage() {
  return <MetasWorkspace />
}
