export interface AllowedProduct {
  code: string
  description: string
  brand: string
  unit: string
  mobility: 'SIM' | 'NAO'
  active: boolean
}

export const METAS_ALLOWED_PRODUCT_BRANDS = [
  'CAFES',
  'COLORIFICOS/TEMPEROS',
  'GRAOS',
  'RACAO PASSAROS',
  'RACAO PET - CACHORRO',
  'RACAO PET - GATO',
] as const

export const METAS_ALLOWED_PRODUCTS: AllowedProduct[] = []

function normalize(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeBrand(value: string) {
  const normalized = normalize(value).replace(/\s+/g, ' ')
  const aliases: Record<string, string> = {
    CAFE: 'CAFES',
    CAFES: 'CAFES',
    'COLORIFICO/TEMPERO': 'COLORIFICOS/TEMPEROS',
    'COLORIFICOS/TEMPEROS': 'COLORIFICOS/TEMPEROS',
    'COLORIFICOS E TEMPEROS': 'COLORIFICOS/TEMPEROS',
    GRAO: 'GRAOS',
    GRAOS: 'GRAOS',
    'RACAO PASSARO': 'RACAO PASSAROS',
    'RACAO PASSAROS': 'RACAO PASSAROS',
    'RACAO PET CACHORRO': 'RACAO PET - CACHORRO',
    'RACAO PET - CACHORRO': 'RACAO PET - CACHORRO',
    'RACAO PET CACHORROS': 'RACAO PET - CACHORRO',
    'RACOES CACHORROS': 'RACAO PET - CACHORRO',
    'RACAO PET GATO': 'RACAO PET - GATO',
    'RACAO PET - GATO': 'RACAO PET - GATO',
    'RACOES GATOS': 'RACAO PET - GATO',
  }
  return aliases[normalized] ?? normalized
}

export function isAllowedProductBrand(value: string) {
  const normalized = normalizeBrand(value)
  return METAS_ALLOWED_PRODUCT_BRANDS.includes(normalized as (typeof METAS_ALLOWED_PRODUCT_BRANDS)[number])
}

export function getActiveAllowedProductsFromList(list: AllowedProduct[]) {
  return list.filter((item) => item.active)
}
