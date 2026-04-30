import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PdfExportRow {
  rank: number
  name: string
  supervisorName: string
  profileTypeLabel: string
  status: string
  pointsRatio: number
  rewardAchieved: number
  rewardMode: 'PERCENT' | 'CURRENCY'
  uniqueClients: number
  baseClients: number
  totalOrders: number
  totalValue: number
  financialTarget: number
  totalGrossWeight: number
  weightSoldKgByGroup: number
  weightTargetKg: number
  averageTicket: number
  stages: Array<{ stageKey: string; stageLabel: string; ratio: number }>
  pointsAchieved: number
  pointsTarget: number
  metasHit: number
  metasTotal: number
  distribuicaoSellerHit: 0 | 1
  distribuicaoClientsHit: number
  distribuicaoClientsTarget: number
  kpiRewardAchieved: number
  gapToTarget: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 1)}%`
}

export function generateSellerPdfReport(options: {
  row: PdfExportRow
  monthLabel: string
  scopeLabel: string
  generatedBy?: string
}): jsPDF {
  const { row, monthLabel, scopeLabel, generatedBy } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  let y = 14

  // Colors
  const primaryColor = '#0f281d'
  const accentColor = '#2ec08d'
  const textDark = '#1a1a1a'
  const textLight = '#666666'

  // --- HEADER ---
  doc.setFillColor(primaryColor)
  doc.rect(0, 0, pageWidth, 32, 'F')

  doc.setTextColor('#ffffff')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('OURO VERDE', margin, 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema Empresarial · Relatório Individual de Metas', margin, 20)

  doc.setFontSize(8)
  doc.text(`${scopeLabel} · ${monthLabel}`, margin, 26)

  if (generatedBy) {
    doc.text(`Emitido por: ${generatedBy}`, pageWidth - margin, 26, { align: 'right' })
  }

  y = 40

  // --- SELLER INFO ---
  doc.setTextColor(textDark)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(row.name, margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(textLight)
  const infoLine = [
    `Supervisor: ${row.supervisorName || '—'}`,
    `Perfil: ${row.profileTypeLabel}`,
    `Status: ${row.status}`,
  ].join('   |   ')
  doc.text(infoLine, margin, y)
  y += 10

  // --- SUMMARY CARDS (simulated with table) ---
  doc.setFontSize(10)
  doc.setTextColor(textDark)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo de Performance', margin, y)
  y += 4

  const summaryData = [
    ['Pontuação', formatPercent(row.pointsRatio), 'Meta Financeira', formatCurrency(row.financialTarget)],
    ['Premiação', row.rewardMode === 'PERCENT' ? formatPercent(row.rewardAchieved / 100) : formatCurrency(row.rewardAchieved), 'Pedidos', String(row.totalOrders)],
    ['Clientes Únicos', `${row.uniqueClients} / ${row.baseClients}`, 'Ticket Médio', formatCurrency(row.averageTicket)],
    ['Peso Bruto Total', `${formatNumber(row.totalGrossWeight, 2)} kg`, 'Peso por Grupo', `${formatNumber(row.weightSoldKgByGroup, 2)} / ${formatNumber(row.weightTargetKg, 2)} kg`],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, font: 'helvetica' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      1: { textColor: textDark, cellWidth: 38 },
      2: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      3: { textColor: textDark, cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: '#f8faf9' },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // --- STAGES BREAKDOWN ---
  if (row.stages.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(textDark)
    doc.setFont('helvetica', 'bold')
    doc.text('Aderência por Etapa', margin, y)
    y += 4

    const stageRows = row.stages.map((s) => [
      s.stageLabel,
      formatPercent(s.ratio),
      s.ratio >= 1 ? '✓ Atingida' : s.ratio >= 0.8 ? 'Quase lá' : 'Em progresso',
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['Etapa', 'Aderência', 'Status']],
      body: stageRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: '#ffffff', fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' },
      },
      bodyStyles: { textColor: textDark },
      alternateRowStyles: { fillColor: '#f8faf9' },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // --- METAS HIT DETAIL ---
  doc.setFontSize(10)
  doc.setTextColor(textDark)
  doc.setFont('helvetica', 'bold')
  doc.text('Metas Conquistadas', margin, y)
  y += 4

  const metasData = [
    ['Metas Batidas', `${row.metasHit} / ${row.metasTotal}`],
    ['Distribuição de Itens', row.distribuicaoSellerHit ? '✓ Atingida' : 'Não atingida'],
    ['Clientes com Itens', `${row.distribuicaoClientsHit} / ${row.distribuicaoClientsTarget}`],
    ['Premiação por KPIs', formatCurrency(row.kpiRewardAchieved)],
    ['Gap para Meta', formatCurrency(row.gapToTarget)],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: metasData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5, font: 'helvetica' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: textLight, cellWidth: 50 },
      1: { textColor: textDark, cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: '#f8faf9' },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14

  // --- SIGNATURE AREA ---
  const sigY = Math.min(y, 250)
  doc.setDrawColor(accentColor)
  doc.setLineWidth(0.3)
  doc.line(margin, sigY, margin + 70, sigY)

  doc.setFontSize(8)
  doc.setTextColor(textLight)
  doc.setFont('helvetica', 'normal')
  doc.text('Assinatura do Vendedor', margin, sigY + 4)
  doc.text(row.name, margin, sigY + 8)

  doc.line(pageWidth - margin - 70, sigY, pageWidth - margin, sigY)
  doc.text('Assinatura do Supervisor', pageWidth - margin - 70, sigY + 4)
  doc.text(row.supervisorName || '—', pageWidth - margin - 70, sigY + 8)

  // --- FOOTER ---
  const footerY = 285
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Sistema Ouro Verde · Confidencial`, pageWidth / 2, footerY, { align: 'center' })

  return doc
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}
