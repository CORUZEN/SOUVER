import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { ToastProvider } from '@/components/ui/Toast'
import { APP_VERSION } from '@/generated/app-version'
import { Suspense } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <div className="dashboard-ov-theme flex h-screen overflow-hidden">
        <Suspense fallback={<div className="w-64 shrink-0 bg-linear-to-b from-[#0f2117] via-[#163325] to-[#1f4733]" />}>
          <Sidebar appVersion={APP_VERSION} />
        </Suspense>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<div className="h-20 shrink-0 border-b border-[#3e6d52]/52 bg-linear-to-r from-[#102218] via-[#153224] to-[#1f4935]" />}>
            <Header />
          </Suspense>
          <main className="dashboard-main-bg flex-1 overflow-y-auto">
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
