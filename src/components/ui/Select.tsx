'use client'

import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { forwardRef, SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-surface-700">
            {label}
            {props.required && (
              <span className="text-error-500 ml-1" aria-hidden>*</span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-10 rounded-lg border text-sm text-surface-900 bg-white',
              'pl-3 pr-9 appearance-none cursor-pointer',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'disabled:bg-surface-50 disabled:text-surface-400 disabled:cursor-not-allowed',
              error
                ? 'border-error-500 focus:ring-error-500'
                : 'border-surface-300 hover:border-surface-400',
              className
            )}
            aria-describedby={
              error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
            }
            aria-invalid={!!error}
            {...props}
          >
            {placeholder && (
              <option value="">{placeholder}</option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-error-500">{error}</p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-surface-500">{hint}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
