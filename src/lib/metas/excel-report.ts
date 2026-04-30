import * as XLSX from 'xlsx-js-style'

export interface ExportStageCell {
  stageKey: string
  stageLabel: string
  ratio: number
}

export interface ExportRow {
  rank: number
  name: string
  supervisorName: string
  profileTypeLabel: string
  status: 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'
  pointsRatio: number
  rewardAchieved: number
  rewardMode: 'PERCENT' | 'CURRENCY'
  uniqueClients: number
  baseClients: number
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  averageTicket: number
  stages: ExportStageCell[]
  pointsAchieved: number
  pointsTarget: number
  kpiRewardAchieved: number
  gapToTarget: number
}

export interface ExportPayload {
  rows: ExportRow[]
  monthLabel: string
  scopeLabel: string
  generatedBy?: string
}

type CellStyle = Record<string, unknown>

const C = {
  deep: '0B3B2E',
  deep2: '0E5A45',
  accent: '1FCB92',
  white: 'FFFFFF',
  paper: 'F7FAF9',
  line: 'DDE7E4',
  text: '1F2937',
  muted: '6B7280',
  ok: '059669',
  warn: 'D97706',
  bad: 'DC2626',
  h1: '059669',
  h2: '0891B2',
  h3: '2563EB',
  h4: '6366F1',
  h5: 'F59E0B',
  h6: 'FB7185',
}

function nowStr() {
  return new Date().toLocaleString('pt-BR')
}

function fmt(n: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

function fmtCurr(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function fmtPct(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
}

function heatColor(ratio: number) {
  if (ratio >= 1) return C.h1
  if (ratio >= 0.85) return C.h2
  if (ratio >= 0.7) return C.h3
  if (ratio >= 0.55) return C.h4
  if (ratio >= 0.4) return C.h5
  return C.h6
}

function statusColor(status: ExportRow['status']) {
  if (status === 'SUPEROU' || status === 'NO_ALVO') return C.ok
  if (status === 'ATENCAO') return C.warn
  return C.bad
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, v: unknown, s?: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
  const cell: Record<string, unknown> = {}
  if (typeof v === 'number') {
    cell.t = 'n'
    cell.v = v
  } else if (typeof v === 'boolean') {
    cell.t = 'b'
    cell.v = v
  } else {
    cell.t = 's'
    cell.v = v == null ? '' : String(v)
  }
  if (s) cell.s = s
  ws[addr] = cell as unknown as XLSX.CellObject
}

function merge(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } })
}

function styleHeaderBand(title: string, accent = false): CellStyle {
  return {
    font: { bold: true, color: { rgb: accent ? C.accent : C.white }, sz: accent ? 12 : 10, italic: accent },
    fill: { fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
}

function sectionRibbonStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: C.deep }, sz: 10 },
    fill: { fgColor: { rgb: 'EAF7F1' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: C.accent } },
      bottom: { style: 'thin', color: { rgb: C.accent } },
      left: { style: 'thin', color: { rgb: C.line } },
      right: { style: 'thin', color: { rgb: C.line } },
    },
  }
}

function tableHeaderStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: C.white }, sz: 10 },
    fill: { fgColor: { rgb: C.deep2 } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: C.accent } },
      bottom: { style: 'thin', color: { rgb: C.accent } },
      left: { style: 'thin', color: { rgb: C.deep } },
      right: { style: 'thin', color: { rgb: C.deep } },
    },
  }
}

function dataStyle(alt: boolean, center = false): CellStyle {
  return {
    font: { color: { rgb: C.text }, sz: 10 },
    fill: { fgColor: { rgb: alt ? C.paper : C.white } },
    alignment: { horizontal: center ? 'center' : 'left', vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: C.line } },
      left: { style: 'thin', color: { rgb: C.line } },
      right: { style: 'thin', color: { rgb: C.line } },
    },
  }
}

function buildHeader(ws: XLSX.WorkSheet, lastCol: number, title: string, subtitle: string, period: string, generatedBy?: string) {
  for (let c = 1; c <= lastCol; c++) {
    setCell(ws, 1, c, '', styleHeaderBand('', true))
    setCell(ws, 2, c, '', styleHeaderBand(''))
    setCell(ws, 3, c, '', styleHeaderBand(''))
    setCell(ws, 4, c, '', { fill: { fgColor: { rgb: C.accent } } })
  }

  merge(ws, 1, 1, 1, lastCol)
  merge(ws, 2, 1, 2, lastCol)
  merge(ws, 3, 1, 3, lastCol)

  setCell(ws, 1, 1, 'SISTEMA OURO VERDE - GESTAO COMERCIAL', styleHeaderBand('', true))
  setCell(ws, 2, 1, title, { ...styleHeaderBand(''), font: { bold: true, color: { rgb: C.white }, sz: 17 } })
  setCell(ws, 3, 1, `${subtitle}  |  Periodo: ${period}  |  Gerado em: ${nowStr()}  |  Responsavel: ${generatedBy || 'Sistema Ouro Verde'}`, {
    font: { color: { rgb: 'B9F3DE' }, sz: 9 },
    fill: { fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'left', vertical: 'center' },
  })

  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][0] = { hpt: 22 }
  ws['!rows'][1] = { hpt: 30 }
  ws['!rows'][2] = { hpt: 20 }
  ws['!rows'][3] = { hpt: 4 }
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((w) => ({ wch: w }))
}

function addAutoFilter(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } }) }
}

function addSheetTitleRibbon(ws: XLSX.WorkSheet, r: number, c1: number, c2: number, title: string) {
  for (let c = c1; c <= c2; c++) setCell(ws, r, c, '', sectionRibbonStyle())
  merge(ws, r, c1, r, c2)
  setCell(ws, r, c1, title, sectionRibbonStyle())
}

function writeMainTable(ws: XLSX.WorkSheet, startRow: number, rows: ExportRow[]) {
  const headers = ['#', 'Vendedor', 'Supervisor', 'Perfil', '% Geral', 'Premiacao', 'Clientes', 'Pedidos', 'Valor Faturado', 'Peso (kg)', 'Ticket Medio', '1a Semana', '2a Semana', '3a Semana', 'Fechamento', 'Status']
  headers.forEach((h, i) => setCell(ws, startRow, i + 1, h, tableHeaderStyle()))

  rows.forEach((r, idx) => {
    const row = startRow + 1 + idx
    const alt = idx % 2 === 1
    const stages = [
      r.stages.find((s) => s.stageKey === 'W1')?.ratio,
      r.stages.find((s) => s.stageKey === 'W2')?.ratio,
      r.stages.find((s) => s.stageKey === 'W3')?.ratio,
      r.stages.find((s) => s.stageKey === 'CLOSING')?.ratio,
    ]
    const vals: Array<unknown> = [
      r.rank,
      r.name,
      r.supervisorName || '-',
      r.profileTypeLabel,
      `${fmt(Math.min(Math.max(r.pointsRatio, 0), 1) * 100, 1)}%`,
      r.rewardMode === 'PERCENT' ? `${fmt(r.rewardAchieved, 2)}%` : fmtCurr(r.rewardAchieved),
      r.baseClients > 0 ? `${r.uniqueClients}/${r.baseClients}` : `${r.uniqueClients}`,
      r.totalOrders,
      fmtCurr(r.totalValue),
      `${fmt(r.totalGrossWeight, 2)} kg`,
      fmtCurr(r.averageTicket),
      stages[0] == null ? '-' : `${Math.round(stages[0] * 100)}%`,
      stages[1] == null ? '-' : `${Math.round(stages[1] * 100)}%`,
      stages[2] == null ? '-' : `${Math.round(stages[2] * 100)}%`,
      stages[3] == null ? '-' : `${Math.round(stages[3] * 100)}%`,
      r.status,
    ]

    vals.forEach((v, i) => setCell(ws, row, i + 1, v, dataStyle(alt, i === 0 || i === 4 || i === 6 || i === 7 || i >= 11)))

    for (let s = 0; s < 4; s++) {
      const ratio = stages[s]
      if (ratio == null) continue
      setCell(ws, row, 12 + s, `${Math.round(ratio * 100)}%`, {
        font: { bold: true, color: { rgb: C.white }, sz: 10 },
        fill: { fgColor: { rgb: heatColor(ratio) } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: C.line } },
          left: { style: 'thin', color: { rgb: C.line } },
          right: { style: 'thin', color: { rgb: C.line } },
        },
      })
    }

    setCell(ws, row, 16, r.status, {
      ...dataStyle(alt, true),
      font: { bold: true, color: { rgb: statusColor(r.status) }, sz: 10 },
    })
  })

  addAutoFilter(ws, startRow, 1, startRow + rows.length, 16)
}

export async function generateMetasReport(payload: ExportPayload): Promise<Buffer> {
  const { rows, monthLabel, scopeLabel, generatedBy } = payload
  const wb = XLSX.utils.book_new()

  const ws1: XLSX.WorkSheet = {}
  buildHeader(ws1, 10, 'RELATORIO EXECUTIVO DE METAS', scopeLabel, monthLabel, generatedBy)
  addSheetTitleRibbon(ws1, 6, 1, 10, 'VISAO GERAL DO PERIODO')

  const totalVendors = rows.length
  const totalOrders = rows.reduce((s, r) => s + r.totalOrders, 0)
  const totalClients = rows.reduce((s, r) => s + r.uniqueClients, 0)
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0)
  const totalWeight = rows.reduce((s, r) => s + r.totalGrossWeight, 0)
  const totalPoints = rows.reduce((s, r) => s + r.pointsAchieved, 0)
  const totalReward = rows.reduce((s, r) => s + r.rewardAchieved, 0)
  const avgAchieve = totalVendors ? rows.reduce((s, r) => s + r.pointsRatio, 0) / totalVendors : 0

  const metrics = [
    ['VENDEDORES', String(totalVendors)],
    ['PEDIDOS', String(totalOrders)],
    ['CLIENTES UNICOS', String(totalClients)],
    ['FATURAMENTO TOTAL', fmtCurr(totalValue)],
    ['PESO TOTAL', `${fmt(totalWeight, 2)} kg`],
    ['PONTOS CONQUISTADOS', fmt(totalPoints, 2)],
    ['PREMIACAO TOTAL', fmtCurr(totalReward)],
    ['ATINGIMENTO MEDIO', fmtPct(avgAchieve)],
  ]
  metrics.forEach((m, i) => {
    setCell(ws1, 7, i + 1, m[0], {
      font: { bold: true, color: { rgb: C.muted }, sz: 9 },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: C.accent } }, left: { style: 'thin', color: { rgb: C.line } }, right: { style: 'thin', color: { rgb: C.line } } },
    })
    setCell(ws1, 8, i + 1, m[1], {
      font: { bold: true, color: { rgb: C.deep }, sz: 14 },
      fill: { fgColor: { rgb: C.white } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: C.accent } }, left: { style: 'thin', color: { rgb: C.line } }, right: { style: 'thin', color: { rgb: C.line } } },
    })
  })

  addSheetTitleRibbon(ws1, 10, 1, 4, 'DISTRIBUICAO DE STATUS')
  const statusRows: Array<[string, number, string]> = [
    ['Superou meta', rows.filter((r) => r.status === 'SUPEROU').length, C.ok],
    ['No alvo', rows.filter((r) => r.status === 'NO_ALVO').length, C.ok],
    ['Atencao', rows.filter((r) => r.status === 'ATENCAO').length, C.warn],
    ['Critico', rows.filter((r) => r.status === 'CRITICO').length, C.bad],
  ]
  statusRows.forEach((r, i) => {
    setCell(ws1, 11 + i, 1, r[0], dataStyle(false))
    setCell(ws1, 11 + i, 2, r[1], { ...dataStyle(false, true), font: { bold: true, color: { rgb: r[2] }, sz: 11 } })
  })

  setCols(ws1, [24, 20, 20, 22, 22, 22, 22, 18, 12, 12])
  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 30, c: 15 } })
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Executivo')

  const ws2: XLSX.WorkSheet = {}
  buildHeader(ws2, 16, 'DESEMPENHO INDIVIDUAL DE VENDEDORES', `${scopeLabel} - ${rows.length} vendedores monitorados`, monthLabel, generatedBy)
  addSheetTitleRibbon(ws2, 6, 1, 16, `PAINEL CONSOLIDADO DE VENDEDORES - ${monthLabel}`)
  writeMainTable(ws2, 8, rows)
  setCols(ws2, [5, 28, 26, 14, 10, 14, 12, 10, 18, 14, 14, 11, 11, 11, 11, 12])
  ws2['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 9 + rows.length, c: 15 } })
  XLSX.utils.book_append_sheet(wb, ws2, 'Desempenho por Vendedor')

  const bySupervisor = new Map<string, ExportRow[]>()
  rows.forEach((r) => {
    const sup = r.supervisorName || 'Sem supervisor'
    if (!bySupervisor.has(sup)) bySupervisor.set(sup, [])
    bySupervisor.get(sup)!.push(r)
  })

  for (const [sup, supRows] of Array.from(bySupervisor.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const ws: XLSX.WorkSheet = {}
    buildHeader(ws, 15, `SUPERVISOR: ${sup.toUpperCase()}`, `${scopeLabel} - ${supRows.length} vendedores`, monthLabel, generatedBy)
    addSheetTitleRibbon(ws, 6, 1, 15, `RESUMO DA EQUIPE - ${monthLabel}`)

    const supOrders = supRows.reduce((s, r) => s + r.totalOrders, 0)
    const supClients = supRows.reduce((s, r) => s + r.uniqueClients, 0)
    const supValue = supRows.reduce((s, r) => s + r.totalValue, 0)
    const supWeight = supRows.reduce((s, r) => s + r.totalGrossWeight, 0)
    const supPoints = supRows.reduce((s, r) => s + r.pointsAchieved, 0)
    const supReward = supRows.reduce((s, r) => s + r.rewardAchieved, 0)
    const supAvg = supRows.length ? supRows.reduce((s, r) => s + r.pointsRatio, 0) / supRows.length : 0

    const supMetrics = [
      ['VENDEDORES', String(supRows.length)],
      ['PEDIDOS', String(supOrders)],
      ['CLIENTES', String(supClients)],
      ['FATURAMENTO', fmtCurr(supValue)],
      ['PESO', `${fmt(supWeight, 2)} kg`],
      ['PONTOS', fmt(supPoints, 2)],
      ['PREMIACAO', fmtCurr(supReward)],
      ['ATINGIMENTO', fmtPct(supAvg)],
    ]

    supMetrics.forEach((m, i) => {
      setCell(ws, 7, i + 1, m[0], {
        font: { bold: true, color: { rgb: C.muted }, sz: 9 },
        fill: { fgColor: { rgb: 'ECFDF5' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      })
      setCell(ws, 8, i + 1, m[1], {
        font: { bold: true, color: { rgb: C.deep }, sz: 13 },
        fill: { fgColor: { rgb: C.white } },
        alignment: { horizontal: 'center', vertical: 'center' },
      })
    })

    const headers = ['#', 'Vendedor', 'Perfil', '% Geral', 'Premiacao', 'Clientes', 'Pedidos', 'Valor Faturado', 'Peso (kg)', 'Ticket Medio', '1a Sem', '2a Sem', '3a Sem', 'Fechamento', 'Status']
    headers.forEach((h, i) => setCell(ws, 10, i + 1, h, tableHeaderStyle()))

    supRows.forEach((r, idx) => {
      const row = 11 + idx
      const alt = idx % 2 === 1
      const stages = [
        r.stages.find((s) => s.stageKey === 'W1')?.ratio,
        r.stages.find((s) => s.stageKey === 'W2')?.ratio,
        r.stages.find((s) => s.stageKey === 'W3')?.ratio,
        r.stages.find((s) => s.stageKey === 'CLOSING')?.ratio,
      ]
      const vals: Array<unknown> = [
        r.rank,
        r.name,
        r.profileTypeLabel,
        `${fmt(Math.min(Math.max(r.pointsRatio, 0), 1) * 100, 1)}%`,
        r.rewardMode === 'PERCENT' ? `${fmt(r.rewardAchieved, 2)}%` : fmtCurr(r.rewardAchieved),
        r.baseClients > 0 ? `${r.uniqueClients}/${r.baseClients}` : `${r.uniqueClients}`,
        r.totalOrders,
        fmtCurr(r.totalValue),
        `${fmt(r.totalGrossWeight, 2)} kg`,
        fmtCurr(r.averageTicket),
        stages[0] == null ? '-' : `${Math.round(stages[0] * 100)}%`,
        stages[1] == null ? '-' : `${Math.round(stages[1] * 100)}%`,
        stages[2] == null ? '-' : `${Math.round(stages[2] * 100)}%`,
        stages[3] == null ? '-' : `${Math.round(stages[3] * 100)}%`,
        r.status,
      ]
      vals.forEach((v, i) => setCell(ws, row, i + 1, v, dataStyle(alt, i === 0 || i === 3 || i === 5 || i === 6 || i >= 10)))

      for (let s = 0; s < 4; s++) {
        const ratio = stages[s]
        if (ratio == null) continue
        setCell(ws, row, 11 + s, `${Math.round(ratio * 100)}%`, {
          font: { bold: true, color: { rgb: C.white }, sz: 10 },
          fill: { fgColor: { rgb: heatColor(ratio) } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: C.line } },
            left: { style: 'thin', color: { rgb: C.line } },
            right: { style: 'thin', color: { rgb: C.line } },
          },
        })
      }

      setCell(ws, row, 15, r.status, {
        ...dataStyle(alt, true),
        font: { bold: true, color: { rgb: statusColor(r.status) }, sz: 10 },
      })
    })

    addAutoFilter(ws, 10, 1, 10 + supRows.length, 15)
    setCols(ws, [5, 30, 14, 10, 14, 12, 10, 18, 14, 14, 10, 10, 10, 10, 12])
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 11 + supRows.length, c: 15 } })

    const safeName = (`Sup ${sup}`).replace(/[\\/*?:\[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
  return new Uint8Array(out) as unknown as Buffer
}

export function downloadBuffer(buffer: Buffer, filename: string) {
  const bytes = Uint8Array.from(buffer as unknown as ArrayLike<number>)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
