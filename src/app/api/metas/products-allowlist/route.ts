import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, hasPermission, METAS_PERMISSION_CODES } from '@/lib/auth/permissions'
import { type AllowedProduct, getActiveAllowedProductsFromList } from '@/lib/metas/product-allowlist'
import { readProductAllowlist, writeProductAllowlist } from '@/lib/metas/product-allowlist-store'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const roleCode = authUser.role?.code?.toUpperCase() ?? ''
  const METAS_VIEWER_ROLES = new Set([
    'DEVELOPER', 'COMMERCIAL_MANAGER', 'DIRECTORATE',
    'COMMERCIAL_SUPERVISOR', 'SALES_SUPERVISOR', 'SELLER',
  ])
  const canView = METAS_VIEWER_ROLES.has(roleCode)
    || await hasPermission(authUser.roleId, METAS_PERMISSION_CODES.PRODUCTS_VIEW)
  if (!canView) {
    return NextResponse.json({ message: 'Sem permissao para visualizar produtos da meta.' }, { status: 403 })
  }

  const products = await readProductAllowlist()
  return NextResponse.json({
    total: products.length,
    activeTotal: getActiveAllowedProductsFromList(products).length,
    products,
  })
}

export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const canSave = await hasPermission(authUser.roleId, METAS_PERMISSION_CODES.PRODUCTS_SAVE)
  if (!canSave) {
    return NextResponse.json({ message: 'Sem permissao para salvar produtos da meta.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const products = body?.products
  if (!Array.isArray(products)) {
    return NextResponse.json({ message: 'Payload invalido. Envie products: []' }, { status: 400 })
  }

  const normalizedInput: AllowedProduct[] = products.map((item: unknown) => {
    const product = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      code: String(product.code ?? ''),
      description: String(product.description ?? ''),
      brand: String(product.brand ?? ''),
      unit: String(product.unit ?? ''),
      mobility: String(product.mobility ?? '').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
      active: Boolean(product.active),
    }
  })

  const saved = await writeProductAllowlist(normalizedInput)
  return NextResponse.json({
    message: 'Lista de produtos da meta atualizada com sucesso.',
    total: saved.length,
    activeTotal: getActiveAllowedProductsFromList(saved).length,
    products: saved,
  })
}

