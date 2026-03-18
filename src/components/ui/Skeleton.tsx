import { cn } from '@/lib/utils'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { ReactNode } from 'react'
import Button from './Button'

// ─── Skeleton ───────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-200 rounded', className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}

// ─── Spinner ────────────────────────────────────────────────
export function Spinner({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <svg
      className={cn('animate-spin text-primary-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Carregando"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── Loading Page ────────────────────────────────────────────
export function LoadingPage({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 text-surface-500">
      <Spinner size="lg" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      {icon && <div className="mb-2 text-surface-300">{icon}</div>}
      <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────
export function ErrorState({
  title = 'Erro ao carregar dados',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <AlertCircle className="w-10 h-10 text-error-400 mb-2" />
      <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-xs">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
