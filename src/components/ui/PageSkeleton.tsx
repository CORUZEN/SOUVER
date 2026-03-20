import { Skeleton } from './Skeleton'

/** Skeleton genérico de página — aparece instantaneamente durante navegação */
export function PageSkeleton({ cards = 4, table = true }: { cards?: number; table?: boolean }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* KPI Cards */}
      {cards > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {table && (
        <div className="bg-white rounded-xl border border-surface-200">
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-4 border-b border-surface-100">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          {/* Rows */}
          <div className="divide-y divide-surface-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <div className="ml-auto">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Skeleton para dashboard/painel com gráficos */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton para páginas de chat/comunicação */
export function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-xl border border-surface-200 overflow-hidden animate-in fade-in duration-150">
      {/* Sidebar de conversas */}
      <div className="w-80 border-r border-surface-200 bg-white">
        <div className="p-4 border-b border-surface-100">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="divide-y divide-surface-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Área principal */}
      <div className="flex-1 bg-surface-50 flex items-center justify-center">
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  )
}
