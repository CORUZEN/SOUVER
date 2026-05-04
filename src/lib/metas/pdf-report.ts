import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PdfKpiRule {
  id: string
  stage: string
  stageLabel: string
  kpi: string
  description: string
  targetText: string
  progress: number
  points: number
  rewardValue: number
}

export interface PdfExportData {
  name: string
  supervisorName: string
  profileTypeLabel: string
  status: string
  pointsRatio: number
  rewardAchieved: number
  rewardMode: 'PERCENT' | 'CURRENCY'
  rewardTarget: number
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
  kpiRewardAchieved: number
  gapToTarget: number
  rules: PdfKpiRule[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value * 100, decimals)}%`
}

function formatPercentExact(value: number): string {
  return `${formatNumber(value * 100, 2)}%`
}

function formatRewardPercent(value: number): string {
  return `${formatNumber(value, 2)}%`
}

function stageLabel(key: string): string {
  const map: Record<string, string> = {
    W1: '1ª Semana',
    W2: '2ª Semana',
    W3: '3ª Semana',
    CLOSING: 'Fechamento',
  }
  return map[key] ?? key
}

export function generateSellerPdfReport(options: {
  row: PdfExportData
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

  // --- SELLER INFO (simplified) ---
  doc.setTextColor(textDark)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(row.name, margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(textLight)
  doc.text(`Supervisor: ${row.supervisorName || '—'}`, margin, y)
  y += 10

  // --- SUMMARY ---
  doc.setFontSize(10)
  doc.setTextColor(textDark)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo de Performance', margin, y)
  y += 4

  const financialPct = row.financialTarget > 0 ? row.totalValue / row.financialTarget : 0

  // Premiação: for PERCENT mode, use formatRewardPercent (no *100) to match web panel
  const rewardDisplay = row.rewardMode === 'PERCENT'
    ? formatRewardPercent(row.kpiRewardAchieved)
    : formatCurrency(row.kpiRewardAchieved)

  const summaryData = [
    ['Pontuação', formatPercent(row.pointsRatio, 2), 'Meta Financeira', `${formatCurrency(row.financialTarget)} (${formatPercent(financialPct, 1)})`],
    ['Premiação', rewardDisplay, 'Total de Pedidos', formatCurrency(row.totalValue)],
    ['Clientes Únicos', `${row.uniqueClients} / ${row.baseClients}`, 'Pedidos', String(row.totalOrders)],
    ['Peso Bruto Total', `${formatNumber(row.totalGrossWeight, 2)} kg`, 'Peso por Grupo', `${formatNumber(row.weightSoldKgByGroup, 2)} / ${formatNumber(row.weightTargetKg, 2)} kg`],
    ['Metas Batidas', `${row.metasHit} / ${row.metasTotal}`, '', ''],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5, font: 'helvetica' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      1: { textColor: textDark, cellWidth: 56 },
      2: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      3: { textColor: textDark, cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: '#f8faf9' },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // --- KPI DETAIL ---
  let tableEndY = y
  if (row.rules.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(textDark)
    doc.setFont('helvetica', 'bold')
    doc.text('Metas e Parâmetros do Ciclo', margin, y)
    y += 4

    const stageOrder = ['W1', 'W2', 'W3', 'CLOSING']
    const rulesByStage = new Map<string, PdfKpiRule[]>()
    for (const rule of row.rules) {
      const list = rulesByStage.get(rule.stage) ?? []
      list.push(rule)
      rulesByStage.set(rule.stage, list)
    }

    const allRows: Array<[string, string, string, string, string, string]> = []
    let totalRewardValue = 0
    for (const stageKey of stageOrder) {
      const rules = rulesByStage.get(stageKey)
      if (!rules || rules.length === 0) continue
      for (const r of rules) {
        const progressPct = r.progress
        const diff = progressPct >= 1 ? 'Meta atingida' : `Faltam ${formatPercent(1 - progressPct, 1)}`
        const rewardLabel = row.rewardMode === 'PERCENT'
          ? formatRewardPercent(r.rewardValue)
          : formatCurrency(r.rewardValue)
        totalRewardValue += r.rewardValue
        allRows.push([
          stageLabel(r.stage),
          r.kpi,
          r.targetText,
          formatPercent(progressPct, 1),
          diff,
          rewardLabel,
        ])
      }
    }

    // Total row
    const totalRewardLabel = row.rewardMode === 'PERCENT'
      ? formatRewardPercent(totalRewardValue)
      : formatCurrency(totalRewardValue)
    allRows.push([
      'Totais',
      `${allRows.length} KPIs`,
      `Meta: ${formatCurrency(row.financialTarget)}`,
      '',
      `1 vendedor(es)`,
      totalRewardLabel,
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['Etapa', 'KPI', 'Meta', 'Atingimento', 'Diferença', 'Premiação']],
      body: allRows,
      theme: 'striped',
      headStyles: { fillColor: '#e8f5f0', textColor: primaryColor, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8.5, cellPadding: 1.8, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 42 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26 },
        4: { cellWidth: 32 },
        5: { cellWidth: 'auto' },
      },
      bodyStyles: { textColor: textDark },
      alternateRowStyles: { fillColor: '#f8faf9' },
      footStyles: { fillColor: primaryColor, textColor: '#ffffff', fontStyle: 'bold', fontSize: 8.5 },
      showFoot: 'lastPage',
    })

    tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // --- SIGNATURE AREA ---
  const sigY = Math.min(tableEndY, 270)
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
  const footerY = 288
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Sistema Ouro Verde · Confidencial`, pageWidth / 2, footerY, { align: 'center' })

  return doc
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}
