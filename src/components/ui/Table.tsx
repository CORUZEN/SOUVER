'use client'

import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { ReactNode } from 'react'
import Button from './Button'

export interface Column<T = Record<string, unknown>> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  className?: string
  render?: (value: unknown, row: T, index: number) => ReactNode
}

export interface TableProps<T = Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  className?: string
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, ri) => (
        <tr key={ri} className="border-b border-surface-100">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div
                className="h-4 bg-surface-100 rounded animate-pulse"
                style={{ width: `${50 + ((ri * 7 + ci * 13) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function Table<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  isLoading,
  emptyMessage = 'Nenhum registro encontrado.',
  emptyIcon,
  totalCount,
  page = 1,
  pageSize = 20,
  onPageChange,
  sortBy,
  sortDir,
  onSort,
  className,
}: TableProps<T>) {
  const total = totalCount ?? data.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  function handleSort(key: string) {
    if (!onSort) return
    onSort(key, sortBy === key && sortDir === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto rounded-xl border border-surface-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-semibold text-surface-600 whitespace-nowrap',
                    col.sortable && 'cursor-pointer select-none hover:text-surface-900',
                    col.width,
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="text-surface-400">
                        {sortBy === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-surface-400">
                    {emptyIcon && <div className="opacity-50 mb-1">{emptyIcon}</div>}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, ri) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-surface-100 hover:bg-surface-50 transition-colors last:border-0"
                >
                  {columns.map((col) => {
                    const val = (row as Record<string, unknown>)[col.key]
                    return (
                      <td key={col.key} className={cn('px-4 py-3 text-surface-800', col.className)}>
                        {col.render ? col.render(val, row, ri) : (val != null ? String(val) : '—')}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalCount !== undefined && totalCount > pageSize && (
        <div className="flex items-center justify-between px-1 pt-4">
          <p className="text-sm text-surface-500">
            Mostrando {from}–{to} de {totalCount} registros
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <span className="px-3 text-sm text-surface-600 font-medium">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
