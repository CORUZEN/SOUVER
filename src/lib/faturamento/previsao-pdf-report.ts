import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PrevisaoPdfProduct {
  productCode: string
  productName: string
  unit: string
  quantity: number
  weightKg: number
  stock: number
  hasStock: boolean
  diff: number
  missingKg: number
}

export interface PrevisaoPdfCity {
  city: string
  uf: string
  orderCount: number
  weightKg: number
}

export interface PrevisaoPdfMetrics {
  vendas: { count: number; weightKg: number }
  bonificacoes: { count: number; weightKg: number }
  trocas: { count: number; weightKg: number }
  naoConfirmados: { count: number; weightKg: number }
  emCarga: { count: number; weightKg: number }
}

export interface PrevisaoPdfSellerCities {
  sellerName: string
  cities: string[]
}

export interface PrevisaoPdfData {
  periodLabel: string
  generatedBy?: string
  selectedSellers: string[]
  selectedCities: string[]
  sellerCityMap: PrevisaoPdfSellerCities[]
  totals: { orders: number; clients: number; weight: number }
  metrics: PrevisaoPdfMetrics
  products: PrevisaoPdfProduct[]
  cities: PrevisaoPdfCity[]
  showInCarga?: boolean
}

function fmtNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

function fmtKg(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export function generatePrevisaoPdfReport(options: {
  data: PrevisaoPdfData
  logoBase64?: string
}): jsPDF {
  const { data: reportData, logoBase64 } = options
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
  doc.rect(0, 0, pageWidth, 28, 'F')

  let headerTextX = margin
  let separatorX = margin
  if (logoBase64) {
    const logoH = 20
    const logoAspectRatio = 200 / 112
    const logoW = logoH * logoAspectRatio
    doc.addImage(logoBase64, 'PNG', margin, 4, logoW, logoH)
    separatorX = margin + logoW + 3
    headerTextX = margin + logoW + 7

    doc.setDrawColor('#ffffff')
    doc.setLineWidth(0.4)
    doc.line(separatorX, 6, separatorX, 22)
  }

  doc.setTextColor('#ffffff')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Previsão de Pedidos', headerTextX, 13)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(`Gerado em: ${generatedAt}`, headerTextX, 19)

  if (reportData.generatedBy) {
    doc.text(`Emitido por: ${reportData.generatedBy}`, pageWidth - margin, 19, { align: 'right' })
  }

  y = 36

  // --- RESUMO EXECUTIVO ---
  doc.setTextColor(primaryColor)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo de Pedidos', margin, y)
  y += 4

  doc.setDrawColor(accentColor)
  doc.setLineWidth(0.4)
  doc.line(margin, y, margin + contentWidth, y)
  y += 6

  const summaryData = [
    ['Total de Pedidos', String(reportData.totals.orders), 'Clientes Únicos', String(reportData.totals.clients)],
    ['Vendas', `${reportData.metrics.vendas.count} · ${fmtKg(reportData.metrics.vendas.weightKg)} kg`, 'Bonificações', `${reportData.metrics.bonificacoes.count} · ${fmtKg(reportData.metrics.bonificacoes.weightKg)} kg`],
    ['Trocas', `${reportData.metrics.trocas.count} · ${fmtKg(reportData.metrics.trocas.weightKg)} kg`, 'Não Confirmados', `${reportData.metrics.naoConfirmados.count} · ${fmtKg(reportData.metrics.naoConfirmados.weightKg)} kg`],
    ...(reportData.showInCarga
      ? [['Em Carga', `${reportData.metrics.emCarga.count} · ${fmtKg(reportData.metrics.emCarga.weightKg)} kg`, 'Peso Total', `${fmtKg(reportData.totals.weight)} kg`]]
      : [['Peso Total', `${fmtKg(reportData.totals.weight)} kg`, '', '']]),
    ['Cidades Atendidas', `${reportData.cities.length}`, '', ''],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8, font: 'helvetica' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      1: { textColor: textDark, cellWidth: 56 },
      2: { fontStyle: 'bold', textColor: textLight, cellWidth: 38 },
      3: { textColor: textDark, cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: '#f8faf9' },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index !== undefined) {
        const rIdx = data.row.index
        const cIdx = data.column.index
        if ((cIdx === 1 || cIdx === 3) && String(data.cell.text).trim().length > 0) {
          data.cell.styles.fontStyle = 'bold'
          if (rIdx === 0) data.cell.styles.textColor = '#065f46'
          else if (rIdx === 1) data.cell.styles.textColor = '#0369a1'
          else if (rIdx === 2) data.cell.styles.textColor = '#b45309'
          else if (rIdx === 3 && cIdx === 1) data.cell.styles.textColor = '#7c3aed'
          else if (rIdx === 3 && cIdx === 3) data.cell.styles.textColor = primaryColor
          else if (rIdx === 4 && cIdx === 1) data.cell.styles.textColor = '#065f46'
        }
      }
    },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // --- PRODUTOS ---
  const productsRef = reportData.products
  if (productsRef.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(textDark)
    doc.setFont('helvetica', 'bold')
    doc.text(`Produtos em Aberto — ${productsRef.length} item${productsRef.length !== 1 ? 's' : ''}`, margin, y)
    y += 4

    const productRows = productsRef.map((p) => {
      const coverageText = p.hasStock
        ? 'SUFICIENTE'
        : `FALTA ${fmtNumber(Math.abs(p.diff), 2)} ${p.unit}\n${fmtKg(p.missingKg)} kg`
      return [
        p.productCode,
        p.productName,
        p.unit,
        fmtNumber(p.quantity, 2),
        `${fmtKg(p.weightKg)} kg`,
        fmtNumber(p.stock, 2),
        coverageText,
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['SKU', 'Descrição', 'UN', 'Qtd', 'Peso Total', 'Estoque', 'Cobertura']],
      body: productRows,
      theme: 'striped',
      headStyles: { fillColor: '#e8f5f0', textColor: primaryColor, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 22, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 32, halign: 'center' },
      },
      bodyStyles: { textColor: textDark },
      alternateRowStyles: { fillColor: '#f8faf9' },
      didParseCell: (cellData) => {
        // Alinha os títulos das colunas conforme o conteúdo
        if (cellData.section === 'head') {
          const headAligns: Array<'left' | 'center' | 'right'> = ['left', 'left', 'center', 'right', 'right', 'right', 'center']
          cellData.cell.styles.halign = headAligns[cellData.column.index] || 'left'
        }
        if (cellData.section === 'body' && cellData.row.index !== undefined) {
          const rowIndex = cellData.row.index
          const product = productsRef[rowIndex]
          if (!product) return
          if (!product.hasStock) {
            cellData.cell.styles.fillColor = '#fff1f2'
            cellData.cell.styles.textColor = '#be123c'
            if (cellData.column.index === 6) cellData.cell.styles.fontStyle = 'bold'
          } else if (cellData.column.index === 6) {
            cellData.cell.styles.textColor = '#065f46'
            cellData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // --- CIDADES ATENDIDAS ---
  if (reportData.cities.length > 0) {
    doc.addPage()
    y = 20
    doc.setFontSize(10)
    doc.setTextColor(textDark)
    doc.setFont('helvetica', 'bold')
    doc.text(`Cidades Atendidas — ${reportData.cities.length} cidade${reportData.cities.length !== 1 ? 's' : ''}`, margin, y)
    y += 4

    const cityRows = reportData.cities.map((c) => [
      c.city,
      c.uf,
      String(c.orderCount),
      `${fmtKg(c.weightKg)} kg`,
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['Cidade', 'UF', 'Pedidos', 'Peso Total']],
      body: cityRows,
      theme: 'striped',
      headStyles: { fillColor: '#e8f5f0', textColor: primaryColor, fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.8, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 32, halign: 'right' },
      },
      bodyStyles: { textColor: textDark },
      alternateRowStyles: { fillColor: '#f8faf9' },
      didParseCell: (cellData) => {
        if (cellData.section === 'head') {
          const headAligns: Array<'left' | 'center' | 'right'> = ['left', 'center', 'center', 'right']
          cellData.cell.styles.halign = headAligns[cellData.column.index] || 'left'
        }
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // --- FILTROS APLICADOS ---
  const hasSellerFilter = reportData.selectedSellers.length > 0
  const hasCityFilter = reportData.selectedCities.length > 0
  const hasFilters = hasSellerFilter || hasCityFilter
  const sellerCityMap = reportData.sellerCityMap

  if (hasFilters && sellerCityMap.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(textDark)
    doc.setFont('helvetica', 'bold')
    doc.text('Filtros Aplicados', margin, y)
    y += 4

    doc.setDrawColor(accentColor)
    doc.setLineWidth(0.4)
    doc.line(margin, y, margin + contentWidth, y)
    y += 6

    const filterRows = sellerCityMap.map((sc) => [
      sc.sellerName,
      sc.cities.join(', '),
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['Vendedor', 'Cidades Atendidas']],
      body: filterRows,
      theme: 'striped',
      headStyles: { fillColor: '#e8f5f0', textColor: primaryColor, fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2.2, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 55, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
      },
      bodyStyles: { textColor: textDark },
      alternateRowStyles: { fillColor: '#f8faf9' },
      didParseCell: (cellData) => {
        if (cellData.section === 'head') {
          const headAligns: Array<'left' | 'center' | 'right'> = ['left', 'left']
          cellData.cell.styles.halign = headAligns[cellData.column.index] || 'left'
        }
        if (cellData.section === 'body') {
          if (cellData.column.index === 0) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = primaryColor
          }
          if (cellData.column.index === 1) {
            cellData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // --- FOOTER ---
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const footerY = 288
    doc.setFontSize(7)
    doc.setTextColor('#999999')
    doc.text(
      `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Sistema Ouro Verde · Confidencial · Página ${i} de ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    )
  }

  return doc
}

export function downloadPrevisaoPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}
