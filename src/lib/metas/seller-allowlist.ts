export const SELLER_PROFILE_TYPES = ['NOVATO', 'ANTIGO_1', 'ANTIGO_15', 'SUPERVISOR'] as const
export type SellerProfileType = (typeof SELLER_PROFILE_TYPES)[number]

export function normalizeSellerProfileType(value: unknown): SellerProfileType {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'ANTIGO_1') return 'ANTIGO_1'
  if (normalized === 'ANTIGO_15') return 'ANTIGO_15'
  if (normalized === 'SUPERVISOR') return 'SUPERVISOR'
  return 'NOVATO'
}

export interface AllowedSeller {
  code?: string | null
  partnerCode?: string | null
  name: string
  active: boolean
  profileType: SellerProfileType
}

// Lista corporativa de vendedores considerados no painel de metas.
// Atualize este arquivo para incluir/remover vendedores elegiveis.
export const METAS_ALLOWED_SELLERS: AllowedSeller[] = [
  {
    code: '22',
    partnerCode: '230',
    name: 'ROSILAINE FERREIRA',
    active: true,
    profileType: 'NOVATO',
  },
]

function normalize(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getActiveAllowedSellers() {
  return METAS_ALLOWED_SELLERS.filter((seller) => seller.active)
}

export function getActiveAllowedSellersFromList(list: AllowedSeller[]) {
  return list.filter((seller) => seller.active)
}

export function matchesAllowedSeller(
  sellerCode: string | null | undefined,
  sellerName: string | null | undefined,
  partnerCode?: string | null | undefined,
  list: AllowedSeller[] = METAS_ALLOWED_SELLERS
) {
  const active = getActiveAllowedSellersFromList(list)
  if (active.length === 0) return true

  const code = String(sellerCode ?? '').trim()
  const partner = String(partnerCode ?? '').trim()
  const name = normalize(String(sellerName ?? ''))

  return active.some((seller) => {
    const allowedCode = String(seller.code ?? '').trim()
    const allowedPartner = String(seller.partnerCode ?? '').trim()
    const allowedName = normalize(seller.name)
    if (allowedCode && code && allowedCode === code) return true
    if (allowedPartner && partner && allowedPartner === partner) return true
    if (allowedName && name && allowedName === name) return true
    return false
  })
}
