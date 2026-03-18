import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Breadcrumb from '@/components/ui/Breadcrumb'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4 pb-1">
            <Breadcrumb />
          </div>
          <div className="px-6 pb-6 pt-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
