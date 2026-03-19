'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (id: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>')
  return ctx
}

export function Tabs({
  defaultTab,
  children,
  className,
}: {
  defaultTab: string
  children: ReactNode
  className?: string
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex border-b border-gray-200 gap-0', className)}
      role="tablist"
    >
      {children}
    </div>
  )
}

export function Tab({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const { activeTab, setActiveTab } = useTabs()
  const isActive = activeTab === id

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(id)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
        isActive
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const { activeTab } = useTabs()
  if (activeTab !== id) return null

  return (
    <div role="tabpanel" className={cn('pt-4', className)}>
      {children}
    </div>
  )
}
