import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, hasPermission, METAS_PERMISSION_CODES } from '@/lib/auth/permissions'
import {
  getActiveAllowedSellersFromList,
  normalizeSellerProfileType,
  type AllowedSeller,
} from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist, writeSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const canView = await hasPermission(authUser.roleId, METAS_PERMISSION_CODES.SELLERS_VIEW)
  if (!canView) {
    return NextResponse.json({ message: 'Sem permissao para visualizar vendedores da meta.' }, { status: 403 })
  }

  const sellers = await readSellerAllowlist()
  return NextResponse.json({
    total: sellers.length,
    activeTotal: getActiveAllowedSellersFromList(sellers).length,
    sellers,
  })
}

export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

  const canSave = await hasPermission(authUser.roleId, METAS_PERMISSION_CODES.SELLERS_SAVE)
  if (!canSave) {
    return NextResponse.json({ message: 'Sem permissao para salvar vendedores da meta.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const sellers = body?.sellers
  if (!Array.isArray(sellers)) {
    return NextResponse.json({ message: 'Payload invalido. Envie sellers: []' }, { status: 400 })
  }

  const normalizedInput: AllowedSeller[] = sellers.map((item: unknown) => {
    const seller = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      code: seller.code == null ? null : String(seller.code),
      partnerCode: seller.partnerCode == null ? null : String(seller.partnerCode),
      name: String(seller.name ?? ''),
      active: Boolean(seller.active),
      profileType: normalizeSellerProfileType(seller.profileType),
    }
  })

  const saved = await writeSellerAllowlist(normalizedInput)
  return NextResponse.json({
    message: 'Lista de vendedores da meta atualizada com sucesso.',
    total: saved.length,
    activeTotal: getActiveAllowedSellersFromList(saved).length,
    sellers: saved,
  })
}
