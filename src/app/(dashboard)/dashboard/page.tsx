import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Módulos em Desenvolvimento',
}

export default function DashboardPage() {
  redirect('/em-desenvolvimento?modulo=painel-executivo')
}
