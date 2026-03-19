import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

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
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─── GET /api/reports/export?module=production|inventory|quality|hr&format=csv|xlsx ──

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const mod    = req.nextUrl.searchParams.get('module') ?? ''
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'
  const now    = new Date()
  const ts     = now.toISOString().slice(0, 10)

  if (mod === 'production') {
    const batches = await prisma.productionBatch.findMany({
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

    if (format === 'xlsx') return xlsxResponse([{ name: 'Produção', rows }], `producao_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `producao_${ts}.csv`)
  }

  if (mod === 'inventory') {
    const items = await prisma.inventoryItem.findMany({
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

    if (format === 'xlsx') return xlsxResponse([{ name: 'Estoque', rows }], `estoque_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `estoque_${ts}.csv`)
  }

  if (mod === 'quality') {
    const [inspections, ncs] = await Promise.all([
      prisma.qualityRecord.findMany({
        include: {
          batch:       { select: { batchCode: true } },
          inspectedBy: { select: { fullName: true } },
        },
        orderBy: { inspectedAt: 'desc' },
      }),
      prisma.nonConformance.findMany({
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

    if (format === 'xlsx') return xlsxResponse([{ name: 'Colaboradores', rows }], `colaboradores_${ts}.xlsx`)
    return csvResponse(toCsv(rows), `colaboradores_${ts}.csv`)
  }

  return NextResponse.json({ error: 'Módulo inválido. Use: production, inventory, quality, hr' }, { status: 400 })
}
