'use client'

import { cn } from '@/lib/utils'
import { forwardRef, TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, rows = 4, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-surface-700">
            {label}
            {props.required && (
              <span className="text-error-500 ml-1" aria-hidden>*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'w-full rounded-lg border text-sm text-surface-900 placeholder:text-surface-400 bg-white',
            'px-3 py-2.5 resize-y min-h-20',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'disabled:bg-surface-50 disabled:text-surface-400 disabled:cursor-not-allowed',
            error
              ? 'border-error-500 focus:ring-error-500'
              : 'border-surface-300 hover:border-surface-400',
            className
          )}
          aria-describedby={
            error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          aria-invalid={!!error}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-xs text-error-500">{error}</p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="text-xs text-surface-500">{hint}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
