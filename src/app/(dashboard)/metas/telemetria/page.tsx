import type { Metadata } from 'next'
import MetasTelemetryWorkspace from '@/components/metas/MetasTelemetryWorkspace'

export const metadata: Metadata = {
  title: 'Telemetria de Metas',
}

export default function MetasTelemetryPage() {
  return <MetasTelemetryWorkspace />
}

