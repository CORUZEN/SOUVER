import type { Metadata } from 'next'
import { Clock3 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getModulePlan } from '@/lib/development-modules'

export const metadata: Metadata = {
  title: 'Painel de Metas',
}

type SearchParamsShape = Record<string, string | string[] | undefined>

interface DevelopmentPageProps {
  searchParams?: Promise<SearchParamsShape>
}

const ACCESSIBLE_MODULE_KEYS = new Set(['metas'])

function resolveModuleKey(searchParams: SearchParamsShape): string {
  const value = searchParams.modulo
  const key = Array.isArray(value) ? value[0] : value
  return key && ACCESSIBLE_MODULE_KEYS.has(key) ? key : 'metas'
}

export default async function DevelopmentPage({ searchParams }: DevelopmentPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedModuleKey = resolveModuleKey(resolvedSearchParams)

  if (selectedModuleKey === 'metas') {
    redirect('/metas')
  }

  const modulePlan = getModulePlan(selectedModuleKey)
  return (
    <div className="min-h-[calc(100dvh-11rem)] flex items-center justify-center">
      <section className="w-full max-w-3xl rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500">
          MÃ³dulo â€¢ {modulePlan.label}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-surface-900">Entrega em evoluÃ§Ã£o</h1>
        <p className="mt-2 text-sm text-surface-600">{modulePlan.description}</p>
        <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-surface-500">
          <Clock3 className="h-3.5 w-3.5" />
          Em preparaÃ§Ã£o para entrega corporativa.
        </p>
      </section>
    </div>
  )
}




