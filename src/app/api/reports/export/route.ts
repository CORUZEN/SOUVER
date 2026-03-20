import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/domains/audit/audit.service'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Helper: convert array of objects to CSV string ──────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape  = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ]
  return lines.join('\n')
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─── Helper: convert array of objects to XLSX buffer ─────────────

function xlsxResponse(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string,
): NextResponse {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─── Helper: generate PDF from tables ────────────────────────────

interface PdfTable {
  heading?: string
  columns: string[]
  rows: (string | number)[][]
}

function pdfResponse(
  title: string,
  tables: PdfTable[],
  filename: string,
): NextResponse {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  doc.setFontSize(16)
  doc.setTextColor(30, 40, 80)
  doc.text(title, 40, 44)

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} — SOUVER / Café Ouro Verde`, 40, 60)

  let curY = 74

  for (const table of tables) {
    if (table.heading) {
      doc.setFontSize(11)
      doc.setTextColor(40, 60, 100)
      doc.text(table.heading, 40, curY)
      curY += 12
    }

    autoTable(doc, {
      startY: curY,
      head: [table.columns],
      body: table.rows,
      styles:      { fontSize: 7.5, cellPadding: 3 },
      headStyles:  { fillColor: [28, 52, 97], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    curY = (doc as any).lastAutoTable.finalY + 22
  }

  const buf = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─── GET /api/reports/export?module=production|inventory|quality|hr&format=csv|xlsx|pdf&period=today|week|month|quarter|all ──

function buildPeriodFilter(period: string): { gte?: Date; lte?: Date } | undefined {
  const now = new Date()
  const to  = new Date(now)
  to.setHours(23, 59, 59, 999)

  switch (period) {
    case 'today': {
      const from = new Date(now); from.setHours(0, 0, 0, 0)
      return { gte: from, lte: to }
    }
    case 'week': {
      const from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0)
      return { gte: from, lte: to }
    }
    case 'month': {
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: to }
    }
    case 'quarter': {
      const from = new Date(now); from.setDate(from.getDate() - 89); from.setHours(0, 0, 0, 0)
      return { gte: from, lte: to }
    }
    default:
      return undefined
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const mod    = req.nextUrl.searchParams.get('module') ?? ''
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'
  const period = req.nextUrl.searchParams.get('period') ?? 'all'
  const now    = new Date()
  const ts     = now.toISOString().slice(0, 10)

  const dateFilter = buildPeriodFilter(period)

  if (mod === 'production') {
    const batches = await prisma.productionBatch.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      include: {
        department: { select: { name: true } },
        createdBy:  { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows = batches.map((b: (typeof batches)[number]) => ({
      Código:       b.batchCode,
      Produto:      b.productName,
      Tipo:         b.productType ?? '',
      Linha:        b.productionLine ?? '',
      Turno:        b.shift,
      Departamento: b.department?.name ?? '',
      ResponsavelCriacao: b.createdBy?.fullName ?? '',
      Status:       b.status,
      QtdPlanejada: b.plannedQty?.toString() ?? '',
      QtdProduzida: b.producedQty?.toString() ?? '',
      Unidade:      b.unit,
      Inicio:       b.startedAt   ? new Date(b.startedAt).toLocaleDateString('pt-BR')  : '',
      Fim:          b.finishedAt  ? new Date(b.finishedAt).toLocaleDateString('pt-BR') : '',
      CriadoEm:    new Date(b.createdAt).toLocaleDateString('pt-BR'),
    }))

    await auditLog({
      userId: auth.id,
      module: 'reports',
      action: 'EXPORT',
      description: `Exportação de produção em formato ${format.toUpperCase()} (${rows.length} registros)`,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    })

    if (format === 'pdf') {
      return pdfResponse(
        'Relatório de Produção',
        [{
          columns: ['Código', 'Produto', 'Tipo', 'Linha', 'Turno', 'Depto', 'Status', 'Qtd.Plan.', 'Qtd.Prod.', 'Unid.', 'Início', 'Fim', 'Criado em'],
          rows: rows.map(r => [
            r.Código, r.Produto, r.Tipo, r.Linha, r.Turno, r.Departamento,
            r.Status, r.QtdPlanejada, r.QtdProduzida, r.Unidade, r.Inicio, r.Fim, r.CriadoEm,
          ]),
        }],
        `producao_${ts}.pdf`,
      )
    }
    if (format === 'xlsx') return xlsxResponse([{ name: 'Produção', rows }], `producao_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `producao_${ts}.csv`)
  }

  if (mod === 'inventory') {
    const items = await prisma.inventoryItem.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      orderBy: { name: 'asc' },
    })

    const rows = items.map((i: (typeof items)[number]) => ({
      SKU:        i.sku,
      Nome:       i.name,
      Descricao:  i.description ?? '',
      Categoria:  i.category ?? '',
      Unidade:    i.unit,
      QtdAtual:   i.currentQty.toString(),
      QtdMinima:  i.minQty?.toString() ?? '',
      QtdMaxima:  i.maxQty?.toString() ?? '',
      Localizacao: i.location ?? '',
      Ativo:      i.isActive ? 'Sim' : 'Não',
      CriadoEm:  new Date(i.createdAt).toLocaleDateString('pt-BR'),
    }))

    await auditLog({
      userId: auth.id,
      module: 'reports',
      action: 'EXPORT',
      description: `Exportação de logística em formato ${format.toUpperCase()} (${rows.length} registros)`,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    })

    if (format === 'pdf') {
      return pdfResponse(
        'Relatório de Estoque / Logística',
        [{
          columns: ['SKU', 'Nome', 'Descrição', 'Categoria', 'Unid.', 'Qtd. Atual', 'Qtd. Mín.', 'Qtd. Máx.', 'Localização', 'Ativo', 'Criado em'],
          rows: rows.map(r => [
            r.SKU, r.Nome, r.Descricao, r.Categoria, r.Unidade,
            r.QtdAtual, r.QtdMinima, r.QtdMaxima, r.Localizacao, r.Ativo, r.CriadoEm,
          ]),
        }],
        `estoque_${ts}.pdf`,
      )
    }
    if (format === 'xlsx') return xlsxResponse([{ name: 'Estoque', rows }], `estoque_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `estoque_${ts}.csv`)
  }

  if (mod === 'quality') {
    const [inspections, ncs] = await Promise.all([
      prisma.qualityRecord.findMany({
        where: dateFilter ? { inspectedAt: dateFilter } : undefined,
        include: {
          batch:       { select: { batchCode: true } },
          inspectedBy: { select: { fullName: true } },
        },
        orderBy: { inspectedAt: 'desc' },
      }),
      prisma.nonConformance.findMany({
        where: dateFilter ? { openedAt: dateFilter } : undefined,
        include: {
          openedBy: { select: { fullName: true } },
          batch:    { select: { batchCode: true } },
        },
        orderBy: { openedAt: 'desc' },
      }),
    ])

    const iRows = inspections.map((r: (typeof inspections)[number]) => ({
      Lote:         r.batch?.batchCode ?? '',
      TipoInspecao: r.inspectionType,
      Resultado:    r.result,
      Inspetor:     r.inspectedBy?.fullName ?? '',
      Data:         new Date(r.inspectedAt).toLocaleDateString('pt-BR'),
      Observacoes:  r.notes ?? '',
    }))

    const ncRows = ncs.map((n: (typeof ncs)[number]) => ({
      Titulo:       n.title,
      Descricao:    n.description,
      Lote:         n.batch?.batchCode ?? '',
      Severidade:   n.severity,
      Status:       n.status,
      AbertoEm:     new Date(n.openedAt).toLocaleDateString('pt-BR'),
      AbertoPor:    n.openedBy?.fullName ?? '',
      Resolucao:    n.resolution ?? '',
      ResolvidoEm:  n.resolvedAt ? new Date(n.resolvedAt).toLocaleDateString('pt-BR') : '',
    }))

    await auditLog({
      userId: auth.id,
      module: 'reports',
      action: 'EXPORT',
      description: `Exportação de qualidade em formato ${format.toUpperCase()} (${iRows.length + ncRows.length} registros)`,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    })

    if (format === 'pdf') {
      return pdfResponse(
        'Relatório de Qualidade',
        [
          {
            heading: 'Inspeções',
            columns: ['Lote', 'Tipo Inspeção', 'Resultado', 'Inspetor', 'Data', 'Observações'],
            rows: iRows.map(r => [r.Lote, r.TipoInspecao, r.Resultado, r.Inspetor, r.Data, r.Observacoes]),
          },
          {
            heading: 'Não Conformidades',
            columns: ['Título', 'Lote', 'Severidade', 'Status', 'Aberto em', 'Aberto por', 'Resolução', 'Resolvido em'],
            rows: ncRows.map(r => [r.Titulo, r.Lote, r.Severidade, r.Status, r.AbertoEm, r.AbertoPor, r.Resolucao, r.ResolvidoEm]),
          },
        ],
        `qualidade_${ts}.pdf`,
      )
    }

    if (format === 'xlsx') {
      return xlsxResponse(
        [
          { name: 'Inspeções', rows: iRows },
          { name: 'Não Conformidades', rows: ncRows },
        ],
        `qualidade_${ts}.xlsx`,
      )
    }

    // Retorna dois blocos no mesmo CSV, separados por uma linha em branco
    const csv = [
      '=== INSPEÇÕES ===',
      toCsv(iRows),
      '',
      '=== NÃO CONFORMIDADES ===',
      toCsv(ncRows),
    ].join('\n')

    return csvResponse(csv, `qualidade_${ts}.csv`)
  }

  if (mod === 'hr') {
    const users = await prisma.user.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      include: {
        role:       { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    })

    const rows = users.map((u: (typeof users)[number]) => ({
      Nome:         u.fullName,
      Email:        u.email,
      Login:        u.login,
      Telefone:     u.phone ?? '',
      Perfil:       u.role?.name ?? '',
      Departamento: u.department?.name ?? '',
      Status:       u.status,
      '2FA':        u.twoFactorEnabled ? 'Sim' : 'Não',
      ÚltimoLogin:  u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : '',
      CriadoEm:    new Date(u.createdAt).toLocaleDateString('pt-BR'),
    }))

    await auditLog({
      userId: auth.id,
      module: 'reports',
      action: 'EXPORT',
      description: `Exportação de RH em formato ${format.toUpperCase()} (${rows.length} registros)`,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    })

    if (format === 'pdf') {
      return pdfResponse(
        'Relatório de Recursos Humanos',
        [{
          columns: ['Nome', 'Email', 'Login', 'Telefone', 'Perfil', 'Departamento', 'Status', '2FA', 'Últ. Login', 'Criado em'],
          rows: rows.map(r => [
            r.Nome, r.Email, r.Login, r.Telefone, r.Perfil,
            r.Departamento, r.Status, r['2FA'], r['ÚltimoLogin'], r.CriadoEm,
          ]),
        }],
        `colaboradores_${ts}.pdf`,
      )
    }
    if (format === 'xlsx') return xlsxResponse([{ name: 'Colaboradores', rows }], `colaboradores_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `colaboradores_${ts}.csv`)
  }

  return NextResponse.json({ error: 'Módulo inválido. Use: production, inventory, quality, hr' }, { status: 400 })
}
