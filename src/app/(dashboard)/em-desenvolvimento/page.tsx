import type { Metadata } from 'next'
import { BriefcaseBusiness, Clock3, Sparkles } from 'lucide-react'
import { getModulePlan } from '@/lib/development-modules'

export const metadata: Metadata = {
  title: 'Módulos em Desenvolvimento',
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
  const modulePlan = getModulePlan(selectedModuleKey)
  const statusLabel = 'Em desenvolvimento'

  const nextDelivery =
    modulePlan.roadmap.find((item) => item.status === 'Em desenvolvimento')?.title ??
    'Entrega em andamento'

  const summaryHighlights = [
    modulePlan.capabilities[0],
    modulePlan.tools[0],
    modulePlan.roadmap[0]?.description,
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-[calc(100dvh-11rem)] flex items-center justify-center">
      <section className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-lg">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-emerald-500 to-cyan-500" />

        <div className="p-6 md:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-surface-600">
            <BriefcaseBusiness className="h-3.5 w-3.5 text-primary-600" />
            {modulePlan.section} • {modulePlan.label}
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold leading-tight text-surface-900 md:text-4xl">
              Funcionalidades em evolução profissional
            </h1>
            <p className="max-w-3xl text-sm text-surface-600 md:text-base">{modulePlan.description}</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-surface-900">{statusLabel}</p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Próxima entrega</p>
              <p className="mt-1 text-sm font-semibold text-surface-900">{nextDelivery}</p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Itens planejados</p>
              <p className="mt-1 text-sm font-semibold text-surface-900">
                {modulePlan.capabilities.length + modulePlan.tools.length} funcionalidades
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-surface-800">
              <Sparkles className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold">Resumo das novidades planejadas</h2>
            </div>
            <ul className="space-y-2 text-sm text-surface-600">
              {summaryHighlights.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-surface-500">
            <Clock3 className="h-3.5 w-3.5" />
            Módulo em preparação para entrega corporativa.
          </p>
        </div>
      </section>
    </div>
  )
}
