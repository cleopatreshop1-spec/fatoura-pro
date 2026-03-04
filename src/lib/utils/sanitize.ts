/**
 * Sanitize a string for safe use: trim + strip HTML tags + collapse whitespace.
 * Never use client-supplied strings raw in DB or AI prompts without calling this.
 */
export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // strip control chars
    .trim()
    .slice(0, maxLength)
}

/** Sanitize all string fields in a plain object one level deep. */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T, maxLength = 500): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? sanitizeString(v, maxLength) : v
  }
  return out as T
}
