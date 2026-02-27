/**
 * Generate the next invoice number.
 * Format: {PREFIX}-{YEAR}-{SEQUENCE} e.g. FP-2026-0001
 */
export function nextInvoiceNumber(
  lastNumber: string | null | undefined,
  prefix: string = 'FP'
): string {
  const year = new Date().getFullYear()
  const fallback = `${prefix}-${year}-0001`

  if (!lastNumber) return fallback

  // Match format: PREFIX-YEAR-SEQ
  const m = lastNumber.match(/^(.+?)-(\d{4})-(\d+)$/)
  if (m) {
    const prevYear = Number(m[2])
    const seq = Number(m[3])
    const padLen = Math.max(4, m[3].length)
    if (prevYear !== year) return `${prefix}-${year}-0001`
    return `${prefix}-${year}-${String(seq + 1).padStart(padLen, '0')}`
  }

  // Fallback: any trailing number
  const m2 = lastNumber.match(/^(.*?)(\d+)$/)
  if (m2) {
    const p = m2[1]
    const n = Number(m2[2])
    return `${p}${String(n + 1).padStart(m2[2].length, '0')}`
  }

  return fallback
}

/**
 * Build the invoice counter padded string from a numeric counter.
 */
export function buildInvoiceNumber(prefix: string, year: number, counter: number): string {
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`
}
