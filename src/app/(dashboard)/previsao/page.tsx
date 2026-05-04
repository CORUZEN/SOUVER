import PrevisaoDeEstoque from '@/components/faturamento/PlanejamentoDiario'

export const metadata = {
  title: 'Previsão de Estoque',
  description: 'Visualize pedidos em aberto por vendedor, cidade e período.',
}

export default function PrevisaoPage() {
  return <PrevisaoDeEstoque />
}
