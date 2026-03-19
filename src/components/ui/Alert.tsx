import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

const STYLES: Record<AlertVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error:   'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info:    'border-blue-200 bg-blue-50 text-blue-800',
}

const ICONS: Record<AlertVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const ICON_STYLES: Record<AlertVariant, string> = {
  success: 'text-green-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  className?: string
}) {
  const Icon = ICONS[variant]

  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-lg border p-4', STYLES[variant], className)}
    >
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', ICON_STYLES[variant])} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className="text-sm mt-0.5 opacity-90">{children}</div>}
      </div>
    </div>
  )
}
