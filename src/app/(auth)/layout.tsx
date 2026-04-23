import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'
import PwaInstallBanner from '@/components/ui/PwaInstallBanner'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className={cn(manrope.className, 'pwa-theme min-h-dvh')}>
        {children}
      </div>
      <PwaInstallBanner />
    </>
  )
}
