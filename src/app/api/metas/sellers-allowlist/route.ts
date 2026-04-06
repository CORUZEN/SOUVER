import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/permissions'
import { getActiveAllowedSellersFromList, type AllowedSeller } from '@/lib/metas/seller-allowlist'
import { readSellerAllowlist, writeSellerAllowlist } from '@/lib/metas/seller-allowlist-store'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

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
