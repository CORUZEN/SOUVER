import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import {
  Factory,
  Truck,
  ShieldCheck,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'

const KPI_CARDS = [
  {
    label: 'Produção Hoje',
    value: '—',
    unit: 'lotes',
    icon: Factory,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    trend: null,
  },
  {
    label: 'Movimento Estoque',
    value: '—',
    unit: 'movimentos',
    icon: Truck,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    trend: null,
  },
  {
    label: 'Não Conformidades',
    value: '—',
    unit: 'abertas',
    icon: ShieldCheck,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    trend: null,
  },
  {
    label: 'Colaboradores Ativos',
    value: '—',
    unit: 'usuários',
    icon: Users,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    trend: null,
  },
]

const STATUS_ITEMS = [
  { label: 'Sistema', status: 'online', icon: CheckCircle2, color: 'text-green-500' },
  { label: 'Banco de Dados', status: 'aguardando configuração', icon: Clock, color: 'text-yellow-500' },
  { label: 'Integrações', status: 'não configuradas', icon: AlertTriangle, color: 'text-orange-500' },
]

export default function DashboardView() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">
            Painel Executivo
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Visão geral da operação — Fábrica Café Ouro Verde
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" />
          <span className="text-sm text-surface-600 font-medium">
            Sistema Ouro Verde — Fase 1
          </span>
          <Badge variant="success">Online</Badge>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, unit, icon: Icon, color, bg }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-surface-900">{value}</p>
              <p className="text-sm text-surface-500 truncate">{label}</p>
              <p className="text-xs text-surface-400">{unit}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Alerta de configuração inicial */}
      <Card className="border-gold-300 bg-gold-50">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-gold-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gold-900 text-sm">
              Configuração inicial necessária
            </h3>
            <p className="text-sm text-gold-700 mt-1 leading-relaxed">
              O sistema foi iniciado com sucesso. Para começar a operar, configure a conexão
              com o banco de dados PostgreSQL (Neon) no arquivo{' '}
              <code className="bg-gold-100 px-1 rounded text-xs font-mono">.env.local</code>{' '}
              e execute as migrations com{' '}
              <code className="bg-gold-100 px-1 rounded text-xs font-mono">npm run db:migrate</code>.
            </p>
          </div>
        </div>
      </Card>

      {/* Status do sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STATUS_ITEMS.map(({ label, status, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-surface-700 font-medium">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs text-surface-500 capitalize">
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Etapas — Fase 1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                'Configurar banco de dados (Neon PostgreSQL)',
                'Executar prisma migrate dev',
                'Executar seed de dados iniciais',
                'Criar primeiro usuário administrador',
                'Configurar perfis e permissões',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-surface-600">
                  <span className="w-5 h-5 rounded-full bg-surface-100 text-surface-500 flex items-center justify-center text-xs font-semibold shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
