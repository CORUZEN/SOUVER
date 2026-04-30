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
  executive?: ExportExecutiveSummary
}

export interface ExportExecutiveSummary {
  financialTarget: number
  totalRevenue: number
  rewardTotal: number
  rewardTarget: number
  totalOrders: number
  weightTarget: number
  totalWeight: number
  metasHit: number
  metasTotal: number
  uniqueClients: number
  totalBaseClients: number
  averageOverallPct: number
  totalVolumes: number
  previousTotalVolumes?: number
  previousMetasHit?: number
  distributionSellersHit: number
  distributionSellersTotal: number
  distributionClientsWithItems: number
  distributionClientsTarget: number
  devolucaoValue: number
  devolucaoPct: number
  devolucaoLimitPct: number
  inadimplenciaValue: number
  inadimplenciaPct: number
  inadimplenciaLimitPct: number
  inadimplenciaLimitDays: number
  inadimplenciaTitlesCount: number
  weightByBrand: Array<{
    brand: string
    targetKg: number
    soldKg: number
    hitSellers: number
    sellerCount: number
  }>
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
  cardFrame: '8FA9A1',
  cardInner: 'C9D8D3',
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

function toTitleCase(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1))
    .join(' ')
}

function shortPersonName(name: string, isVendor = false): string {
  const raw = (name || '').trim()
  if (!raw) return '-'
  const upper = raw.toLocaleUpperCase('pt-BR')
  if (isVendor && upper.startsWith('EVANDSON ')) return 'Evandson Santos'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return toTitleCase(parts[0])
  return toTitleCase(`${parts[0]} ${parts[1]}`)
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
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }
}

function sectionRibbonStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: C.white }, sz: 10 },
    fill: { fgColor: { rgb: '0E5A45' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: C.accent } },
      bottom: { style: 'thin', color: { rgb: C.accent } },
      left: { style: 'thin', color: { rgb: C.deep } },
      right: { style: 'thin', color: { rgb: C.deep } },
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

  setCell(ws, 1, 1, 'SISTEMA OURO VERDE - GESTÃO COMERCIAL', styleHeaderBand('', true))
  setCell(ws, 2, 1, title, {
    ...styleHeaderBand(''),
    font: { bold: true, color: { rgb: C.white }, sz: 22 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  })
  setCell(ws, 3, 1, `${subtitle}  |  Período: ${period}  |  Gerado em: ${nowStr()}  |  Responsável: ${generatedBy || 'Sistema Ouro Verde'}`, {
    font: { color: { rgb: 'B9F3DE' }, sz: 10, bold: true },
    fill: { fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  })

  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][0] = { hpt: 28 }
  ws['!rows'][1] = { hpt: 42 }
  ws['!rows'][2] = { hpt: 26 }
  ws['!rows'][3] = { hpt: 6 }
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

function metricCard(
  ws: XLSX.WorkSheet,
  row: number,
  c1: number,
  c2: number,
  label: string,
  value: string,
  note: string,
  tone: 'ok' | 'warn' | 'bad' | 'info' = 'info'
) {
  const toneHeader = tone === 'ok' ? '0B5D4B' : tone === 'warn' ? '8A4B08' : tone === 'bad' ? '9F1239' : '0B4F75'
  const toneBorder = C.cardFrame
  const innerBorder = C.cardInner
  const bodyBg = 'FBFDFC'
  for (let c = c1; c <= c2; c++) {
    setCell(ws, row, c, '', {
      fill: { fgColor: { rgb: toneHeader } },
      border: {
        top: { style: 'medium', color: { rgb: toneBorder } },
        bottom: { style: 'thin', color: { rgb: toneBorder } },
        left: { style: 'medium', color: { rgb: toneBorder } },
        right: { style: 'medium', color: { rgb: toneBorder } },
      },
    })
    setCell(ws, row + 1, c, '', {
      fill: { fgColor: { rgb: bodyBg } },
      border: {
        bottom: { style: 'thin', color: { rgb: innerBorder } },
        left: { style: 'medium', color: { rgb: toneBorder } },
        right: { style: 'medium', color: { rgb: toneBorder } },
      },
    })
    setCell(ws, row + 2, c, '', {
      fill: { fgColor: { rgb: bodyBg } },
      border: {
        bottom: { style: 'medium', color: { rgb: toneBorder } },
        left: { style: 'medium', color: { rgb: toneBorder } },
        right: { style: 'medium', color: { rgb: toneBorder } },
      },
    })
  }

  merge(ws, row, c1, row, c2)
  merge(ws, row + 1, c1, row + 1, c2)
  merge(ws, row + 2, c1, row + 2, c2)

  setCell(ws, row, c1, label, {
    font: { bold: true, color: { rgb: C.white }, sz: 9 },
    fill: { fgColor: { rgb: toneHeader } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { rgb: toneBorder } },
      bottom: { style: 'thin', color: { rgb: toneBorder } },
      left: { style: 'medium', color: { rgb: toneBorder } },
      right: { style: 'medium', color: { rgb: toneBorder } },
    },
  })
  setCell(ws, row + 1, c1, value, {
    font: { bold: true, color: { rgb: C.text }, sz: 17 },
    fill: { fgColor: { rgb: bodyBg } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: innerBorder } },
      left: { style: 'medium', color: { rgb: toneBorder } },
      right: { style: 'medium', color: { rgb: toneBorder } },
    },
  })
  setCell(ws, row + 2, c1, note, {
    font: { color: { rgb: C.muted }, sz: 9 },
    fill: { fgColor: { rgb: bodyBg } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { rgb: toneBorder } },
      left: { style: 'medium', color: { rgb: toneBorder } },
      right: { style: 'medium', color: { rgb: toneBorder } },
    },
  })
}

function writeMainTable(ws: XLSX.WorkSheet, startRow: number, rows: ExportRow[]) {
  const headers = ['#', 'Vendedor', 'Supervisor', 'Perfil', '% Geral', 'Premiação', 'Clientes', 'Pedidos', 'Valor Faturado', 'Peso (kg)', 'Ticket Médio', '1ª Semana', '2ª Semana', '3ª Semana', 'Fechamento']
  headers.forEach((h, i) => setCell(ws, startRow, i + 1, h, tableHeaderStyle()))
  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][startRow - 1] = { hpt: 26 }

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
      shortPersonName(r.name, true),
      shortPersonName(r.supervisorName),
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
    ]

    vals.forEach((v, i) => setCell(ws, row, i + 1, v, dataStyle(alt, i === 0 || i === 4 || i === 6 || i === 7 || i >= 11)))
    ws['!rows'] = ws['!rows'] || []
    ws['!rows'][row - 1] = { hpt: 24 }

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

  })

  addAutoFilter(ws, startRow, 1, startRow + rows.length, 15)
}

export async function generateMetasReport(payload: ExportPayload): Promise<Buffer> {
  const { rows, monthLabel, scopeLabel, generatedBy, executive } = payload
  const wb = XLSX.utils.book_new()

  const ws1: XLSX.WorkSheet = {}
  buildHeader(ws1, 10, 'RELATÓRIO EXECUTIVO DE METAS', scopeLabel, monthLabel, generatedBy)
  addSheetTitleRibbon(ws1, 6, 1, 10, 'RESUMO EXECUTIVO CONSOLIDADO')

  const totalVendors = rows.length
  const totalOrders = rows.reduce((s, r) => s + r.totalOrders, 0)
  const totalClients = rows.reduce((s, r) => s + r.uniqueClients, 0)
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0)
  const totalWeight = rows.reduce((s, r) => s + r.totalGrossWeight, 0)
  const totalPoints = rows.reduce((s, r) => s + r.pointsAchieved, 0)
  const totalReward = rows.reduce((s, r) => s + r.rewardAchieved, 0)
  const avgAchieve = totalVendors ? rows.reduce((s, r) => s + r.pointsRatio, 0) / totalVendors : 0

  const ex = executive
  const financialTarget = ex?.financialTarget ?? 0
  const totalRevenueConsolidated = ex?.totalRevenue ?? totalValue
  const financialPct = financialTarget > 0 ? totalRevenueConsolidated / financialTarget : 0
  const financialGap = Math.max(financialTarget - totalRevenueConsolidated, 0)
  const financialOver = Math.max(totalRevenueConsolidated - financialTarget, 0)

  const rewardTarget = ex?.rewardTarget ?? 0
  const rewardValue = ex?.rewardTotal ?? totalReward
  const rewardPct = rewardTarget > 0 ? rewardValue / rewardTarget : 0

  const weightTarget = ex?.weightTarget ?? 0
  const weightSold = ex?.totalWeight ?? totalWeight
  const weightPct = weightTarget > 0 ? weightSold / weightTarget : 0
  const weightGap = Math.max(weightTarget - weightSold, 0)
  const weightOver = Math.max(weightSold - weightTarget, 0)

  const metasHit = ex?.metasHit ?? 0
  const metasTotal = ex?.metasTotal ?? 0

  // 4 cards por linha no topo (A:J), aproveitando melhor a largura útil.
  metricCard(ws1, 7, 1, 3, 'META DE FATURAMENTO', `${fmt(financialPct * 100, 1)}%`, financialOver > 0 ? `${fmtCurr(financialOver)} acima da meta` : `${fmtCurr(financialGap)} restantes para atingir`, financialPct >= 1 ? 'ok' : financialPct >= 0.85 ? 'warn' : 'bad')
  metricCard(ws1, 7, 4, 5, 'CUSTO DE PREMIAÇÕES', fmtCurr(rewardValue), rewardTarget > 0 ? `${fmt(rewardPct * 100, 1)}% comprometido de ${fmtCurr(rewardTarget)}` : 'Previsão não parametrizada', rewardPct <= 0.8 ? 'ok' : rewardPct <= 1 ? 'warn' : 'bad')
  metricCard(ws1, 7, 6, 8, 'PEDIDOS NO MÊS', fmt(ex?.totalOrders ?? totalOrders, 0), 'Consolidado dos vendedores monitorados', 'info')
  metricCard(ws1, 7, 9, 10, 'MÉDIA GERAL', `${fmt(ex?.averageOverallPct ?? (avgAchieve * 100), 2)}%`, `${fmt(metasHit, 0)}/${fmt(metasTotal, 0)} metas`, 'info')

  metricCard(ws1, 10, 1, 3, 'META DE PESO CONSOLIDADA', `${fmt(weightTarget, 2)} kg`, weightOver > 0 ? `${fmt(weightOver, 2)} kg acima` : `${fmt(weightGap, 2)} kg restantes`, weightPct >= 1 ? 'ok' : weightPct >= 0.85 ? 'warn' : 'bad')
  metricCard(ws1, 10, 4, 5, 'PESO TOTAL DOS PEDIDOS', `${fmt(weightSold, 2)} kg`, `${fmt(weightPct * 100, 1)}% da meta`, weightPct >= 1 ? 'ok' : 'info')
  metricCard(ws1, 10, 6, 8, 'META FINANCEIRA CONSOLIDADA', fmtCurr(financialTarget), 'Soma das metas da equipe', 'info')
  metricCard(ws1, 10, 9, 10, 'VALOR TOTAL DE PEDIDOS', fmtCurr(totalRevenueConsolidated), `${fmt(financialPct * 100, 1)}% da meta`, financialPct >= 1 ? 'ok' : 'info')

  addSheetTitleRibbon(ws1, 14, 1, 10, 'DISTRIBUIÇÃO, COBERTURA E QUALIDADE DA CARTEIRA')
  metricCard(
    ws1,
    15,
    1,
    3,
    'DISTRIBUIÇÃO DE ITENS',
    `${fmt(ex?.distributionSellersHit ?? 0, 0)}/${fmt(ex?.distributionSellersTotal ?? 0, 0)}`,
    `${fmt((ex?.distributionSellersTotal ?? 0) > 0 ? ((ex?.distributionSellersHit ?? 0) / (ex?.distributionSellersTotal ?? 1)) * 100 : 0, 1)}% dos vendedores no alvo`,
    'info'
  )
  metricCard(
    ws1,
    15,
    4,
    6,
    'COBERTURA DA BASE',
    `${fmt(ex?.distributionClientsWithItems ?? 0, 0)}/${fmt(ex?.distributionClientsTarget ?? 0, 0)}`,
    `${fmt((ex?.distributionClientsTarget ?? 0) > 0 ? ((ex?.distributionClientsWithItems ?? 0) / (ex?.distributionClientsTarget ?? 1)) * 100 : 0, 1)}% da cobertura configurada`,
    'info'
  )
  metricCard(
    ws1,
    15,
    7,
    8,
    'CLIENTES ÚNICOS / BASE',
    `${fmt(ex?.uniqueClients ?? totalClients, 0)}/${fmt(ex?.totalBaseClients ?? 0, 0)}`,
    `${fmt((ex?.totalBaseClients ?? 0) > 0 ? ((ex?.uniqueClients ?? 0) / (ex?.totalBaseClients ?? 1)) * 100 : 0, 1)}% de cobertura geral`,
    'info'
  )
  metricCard(
    ws1,
    15,
    9,
    10,
    'METAS CONQUISTADAS',
    `${fmt(metasHit, 0)}/${fmt(metasTotal, 0)}`,
    `${fmt(metasTotal > 0 ? (metasHit / metasTotal) * 100 : 0, 1)}% de atingimento geral`,
    metasTotal > 0 && metasHit / metasTotal >= 0.85 ? 'ok' : 'info'
  )

  addSheetTitleRibbon(ws1, 19, 1, 10, 'INADIMPLÊNCIA, DEVOLUÇÃO E COMPARATIVO MENSAL')
  const devolOver = (ex?.devolucaoPct ?? 0) - (ex?.devolucaoLimitPct ?? 0)
  const inadOver = (ex?.inadimplenciaPct ?? 0) - (ex?.inadimplenciaLimitPct ?? 0)
  metricCard(ws1, 20, 1, 3, 'DEVOLUÇÃO GERAL', fmtCurr(ex?.devolucaoValue ?? 0), `${fmt(ex?.devolucaoPct ?? 0, 3)}% | limite ${fmt(ex?.devolucaoLimitPct ?? 0, 2)}%`, devolOver <= 0 ? 'ok' : 'warn')
  metricCard(ws1, 20, 4, 6, 'INADIMPLÊNCIA GERAL', fmtCurr(ex?.inadimplenciaValue ?? 0), `${fmt(ex?.inadimplenciaPct ?? 0, 3)}% | ${fmt(ex?.inadimplenciaTitlesCount ?? 0, 0)} títulos > ${fmt(ex?.inadimplenciaLimitDays ?? 45, 0)} dias`, inadOver <= 0 ? 'ok' : 'warn')
  const volumeDelta = (ex?.previousTotalVolumes ?? 0) > 0 ? (ex!.totalVolumes - (ex?.previousTotalVolumes ?? 0)) : 0
  metricCard(ws1, 20, 7, 8, 'VOLUMES VS MÊS ANTERIOR', fmt(ex?.totalVolumes ?? 0, 0), ex?.previousTotalVolumes != null ? `${volumeDelta >= 0 ? '+' : '-'}${fmt(Math.abs(volumeDelta), 0)} volumes` : 'Sem base comparativa', 'info')
  metricCard(ws1, 20, 9, 10, 'TOTAL DE CLIENTES ÚNICOS', fmt(ex?.uniqueClients ?? totalClients, 0), `Base ativa: ${fmt(ex?.totalBaseClients ?? 0, 0)} clientes`, 'info')

  const detailFrameColor = '8FA9A1'
  const detailInnerColor = 'C9D8D3'
  const detailSectionStyle: CellStyle = {
    font: { bold: true, color: { rgb: C.white }, sz: 11 },
    fill: { fgColor: { rgb: '0E5A45' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: detailFrameColor } },
      bottom: { style: 'thin', color: { rgb: detailFrameColor } },
      left: { style: 'thin', color: { rgb: detailFrameColor } },
      right: { style: 'thin', color: { rgb: detailFrameColor } },
    },
  }
  for (let c = 1; c <= 10; c++) setCell(ws1, 24, c, '', detailSectionStyle)
  merge(ws1, 24, 1, 24, 10)
  setCell(ws1, 24, 1, 'DETALHES DE META DE PESO POR GRUPO', detailSectionStyle)

  const detailHeaderStyle: CellStyle = {
    font: { bold: true, color: { rgb: C.white }, sz: 10 },
    fill: { fgColor: { rgb: '0B6C5A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: detailFrameColor } },
      bottom: { style: 'thin', color: { rgb: detailFrameColor } },
      left: { style: 'thin', color: { rgb: detailFrameColor } },
      right: { style: 'thin', color: { rgb: detailFrameColor } },
    },
  }

  const weightHeaders = ['GRUPO', 'META (KG)', 'VENDIDO (KG)', 'ATINGIMENTO']
  const weightHeaderRanges: Array<[number, number]> = [
    [1, 3],   // A:C
    [4, 5],   // D:E
    [6, 7],   // F:G
    [8, 10],  // H:J
  ]
  weightHeaderRanges.forEach(([c1, c2], i) => {
    for (let c = c1; c <= c2; c++) setCell(ws1, 25, c, '', detailHeaderStyle)
    merge(ws1, 25, c1, 25, c2)
    setCell(ws1, 25, c1, weightHeaders[i], detailHeaderStyle)
  })
  const brands = (ex?.weightByBrand ?? []).slice(0, 6)

  const detailGridStyle = (alt: boolean): CellStyle => ({
    font: { color: { rgb: C.text }, sz: 10 },
    fill: { fgColor: { rgb: alt ? C.paper : C.white } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: detailInnerColor } },
      bottom: { style: 'thin', color: { rgb: detailInnerColor } },
      left: { style: 'thin', color: { rgb: detailInnerColor } },
      right: { style: 'thin', color: { rgb: detailInnerColor } },
    },
  })

  const detailGridStyleCenter = (alt: boolean): CellStyle => ({
    ...detailGridStyle(alt),
    alignment: { horizontal: 'center', vertical: 'center' },
  })

  brands.forEach((b, i) => {
    const r = 26 + i
    const ratio = b.targetKg > 0 ? b.soldKg / b.targetKg : 0

    // Preenche todas as células da linha com bordas para evitar falhas visuais em áreas mescladas.
    for (let c = 1; c <= 10; c++) setCell(ws1, r, c, '', detailGridStyle(i % 2 === 1))

    setCell(ws1, r, 1, b.brand || '-', detailGridStyle(i % 2 === 1))
    merge(ws1, r, 1, r, 3)
    setCell(ws1, r, 4, `${fmt(b.targetKg, 2)} kg`, detailGridStyleCenter(i % 2 === 1))
    merge(ws1, r, 4, r, 5)
    setCell(ws1, r, 6, `${fmt(b.soldKg, 2)} kg`, detailGridStyleCenter(i % 2 === 1))
    merge(ws1, r, 6, r, 7)
    setCell(ws1, r, 8, `${fmt(ratio * 100, 1)}%`, {
      ...detailGridStyleCenter(i % 2 === 1),
      font: { bold: true, color: { rgb: ratio >= 1 ? C.ok : C.h2 }, sz: 10 },
    })
    merge(ws1, r, 8, r, 10)
  })

  ws1['!rows'] = ws1['!rows'] || []
  ;[13, 18, 23].forEach((r) => { ws1['!rows']![r - 1] = { hpt: 5 } })
  ;[7, 10, 15, 20].forEach((r) => {
    ws1['!rows']![r - 1] = { hpt: 16 }
    ws1['!rows']![r] = { hpt: 24 }
    ws1['!rows']![r + 1] = { hpt: 18 }
  })
  ws1['!rows']![24] = { hpt: 20 }
  ws1['!rows']![25] = { hpt: 20 }
  setCols(ws1, [19, 15, 15, 15, 15, 15, 15, 13, 13, 12])
  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 36, c: 9 } })
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Executivo')

  const ws2: XLSX.WorkSheet = {}
  buildHeader(ws2, 15, 'DESEMPENHO INDIVIDUAL DE VENDEDORES', `${scopeLabel} - ${rows.length} vendedores monitorados`, monthLabel, generatedBy)
  writeMainTable(ws2, 8, rows)
  setCols(ws2, [6, 34, 24, 15, 11, 15, 13, 11, 20, 16, 16, 11, 11, 11, 12])
  ws2['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 9 + rows.length, c: 14 } })
  XLSX.utils.book_append_sheet(wb, ws2, 'Desempenho por Vendedor')

  const bySupervisor = new Map<string, ExportRow[]>()
  rows.forEach((r) => {
    const sup = r.supervisorName || 'Sem supervisor'
    if (!bySupervisor.has(sup)) bySupervisor.set(sup, [])
    bySupervisor.get(sup)!.push(r)
  })

  for (const [sup, supRows] of Array.from(bySupervisor.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const ws: XLSX.WorkSheet = {}
    const shortSup = shortPersonName(sup)
    buildHeader(ws, 14, `SUPERVISOR: ${shortSup.toLocaleUpperCase('pt-BR')}`, `${scopeLabel} - ${supRows.length} vendedores`, monthLabel, generatedBy)

    addSheetTitleRibbon(ws, 6, 1, 14, `Resumo Executivo da Equipe — ${monthLabel}`)

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
      ['PREMIAÇÃO', fmtCurr(supReward)],
      ['ATINGIMENTO', fmtPct(supAvg)],
    ]

    supMetrics.forEach((m, i) => {
      setCell(ws, 7, i + 1, m[0], {
        font: { bold: true, color: { rgb: C.deep }, sz: 9 },
        fill: { fgColor: { rgb: 'E6F7F1' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: C.accent } },
          left: { style: 'thin', color: { rgb: C.line } },
          right: { style: 'thin', color: { rgb: C.line } },
        },
      })
      setCell(ws, 8, i + 1, m[1], {
        font: { bold: true, color: { rgb: C.deep }, sz: 15 },
        fill: { fgColor: { rgb: C.white } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          bottom: { style: 'medium', color: { rgb: C.accent } },
          left: { style: 'thin', color: { rgb: C.line } },
          right: { style: 'thin', color: { rgb: C.line } },
        },
      })
    })
    ws['!rows'] = ws['!rows'] || []
    ws['!rows'][5] = { hpt: 22 }
    ws['!rows'][6] = { hpt: 22 }
    ws['!rows'][7] = { hpt: 30 }

    const headers = ['#', 'Vendedor', 'Perfil', '% Geral', 'Premiação', 'Clientes', 'Pedidos', 'Valor Faturado', 'Peso (kg)', 'Ticket Médio', '1ª Sem', '2ª Sem', '3ª Sem', 'Fechamento']
    headers.forEach((h, i) => setCell(ws, 10, i + 1, h, tableHeaderStyle()))
    ws['!rows'][9] = { hpt: 26 }

    supRows.forEach((r, idx) => {
      const row = 11 + idx
      const alt = idx % 2 === 1
      const rowMeta = ws['!rows'] ?? (ws['!rows'] = [])
      const stages = [
        r.stages.find((s) => s.stageKey === 'W1')?.ratio,
        r.stages.find((s) => s.stageKey === 'W2')?.ratio,
        r.stages.find((s) => s.stageKey === 'W3')?.ratio,
        r.stages.find((s) => s.stageKey === 'CLOSING')?.ratio,
      ]
      const vals: Array<unknown> = [
        r.rank,
        shortPersonName(r.name, true),
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
      ]
      vals.forEach((v, i) => setCell(ws, row, i + 1, v, dataStyle(alt, i === 0 || i === 3 || i === 5 || i === 6 || i >= 10)))
      rowMeta[row - 1] = { hpt: 24 }

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

    })

    addAutoFilter(ws, 10, 1, 10 + supRows.length, 14)
    setCols(ws, [6, 30, 15, 11, 15, 13, 11, 20, 16, 16, 10, 10, 10, 12])
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 11 + supRows.length, c: 14 } })

    const safeName = (`Sup ${shortSup}`).replace(/[\\/*?:\[\]]/g, '').slice(0, 31)
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
