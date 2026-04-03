import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { ToastProvider } from '@/components/ui/Toast'
import packageJson from '../../../package.json'
import { Suspense } from 'react'

const APP_VERSION = packageJson.version ?? '1.0.0'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-surface-100 via-slate-100 to-cyan-50/60">
        <Suspense fallback={<div className="w-64 shrink-0 bg-surface-900" />}>
          <Sidebar appVersion={APP_VERSION} />
        </Suspense>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-transparent">
            <div className="px-6 pt-4 pb-1">
              <Breadcrumb />
            </div>
            <div className="px-6 pb-6 pt-4">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
