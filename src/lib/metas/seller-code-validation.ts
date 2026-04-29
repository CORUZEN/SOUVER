/**
 * Valida e sanitiza códigos de vendedor para uso seguro em queries Sankhya.
 * Rejeita qualquer caractere não-numérico para prevenir SQL Injection.
 */

const SELLER_CODE_REGEX = /^\d+$/

/**
 * Verifica se um código de vendedor é válido (apenas números).
 */
export function isValidSellerCode(code: unknown): boolean {
  if (typeof code !== 'string') return false
  const trimmed = code.trim()
  if (trimmed.length === 0 || trimmed.length > 20) return false
  return SELLER_CODE_REGEX.test(trimmed)
}

/**
 * Filtra um array de códigos de vendedor, retornando apenas os válidos.
 * Remove duplicados.
 */
export function sanitizeSellerCodes(codes: unknown[]): string[] {
  const valid = new Set<string>()
  for (const code of codes) {
    if (isValidSellerCode(code)) {
      valid.add((code as string).trim())
    }
  }
  return Array.from(valid)
}

/**
 * Escapa um código de vendedor para uso em SQL literal.
 * Apenas aceita números puros — nunca concatena strings arbitrárias.
 */
export function escapeSellerCodeForSql(code: string): string | null {
  if (!isValidSellerCode(code)) return null
  return code.trim()
}

/**
 * Constrói uma cláusula IN segura para códigos de vendedor.
 * Retorna string vazia se não houver códigos válidos.
 */
export function buildSafeSellerInClause(codes: string[], columnName: string): string {
  const safeCodes = sanitizeSellerCodes(codes)
  if (safeCodes.length === 0) return ''
  return `AND ${columnName} IN (${safeCodes.join(', ')})\n  `
}
