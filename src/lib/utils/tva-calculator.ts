export const TVA_RATES = [19, 13, 7, 0] as const
export type TvaRate = (typeof TVA_RATES)[number]

export const STAMP_DUTY = 0.600 // Droit de timbre fixe TND

export interface LineItem {
  quantity: number
  unit_price: number
  tva_rate: TvaRate | number
  discount?: number
}

export interface LineTotals {
  line_ht: number
  line_tva: number
  line_ttc: number
}

export interface InvoiceTotals {
  total_ht: number
  total_tva: number
  stamp_duty: number
  total_ttc: number
  /** TVA breakdown by rate */
  tva_by_rate: Record<number, { base: number; tva: number }>
}

export function calcLineTotals(item: LineItem): LineTotals {
  const gross = round3(item.quantity * item.unit_price)
  const discountFactor = item.discount && item.discount > 0 ? 1 - item.discount / 100 : 1
  const line_ht = round3(gross * discountFactor)
  const line_tva = round3(line_ht * item.tva_rate / 100)
  const line_ttc = round3(line_ht + line_tva)
  return { line_ht, line_tva, line_ttc }
}

export function calcInvoiceTotals(items: LineItem[]): InvoiceTotals {
  const tva_by_rate: Record<number, { base: number; tva: number }> = {}

  let total_ht = 0
  let total_tva = 0

  for (const item of items) {
    const { line_ht, line_tva } = calcLineTotals(item)
    total_ht += line_ht
    total_tva += line_tva

    const rate = item.tva_rate
    if (!tva_by_rate[rate]) tva_by_rate[rate] = { base: 0, tva: 0 }
    tva_by_rate[rate].base = round3(tva_by_rate[rate].base + line_ht)
    tva_by_rate[rate].tva = round3(tva_by_rate[rate].tva + line_tva)
  }

  total_ht = round3(total_ht)
  total_tva = round3(total_tva)
  const total_ttc = round3(total_ht + total_tva + STAMP_DUTY)

  return { total_ht, total_tva, stamp_duty: STAMP_DUTY, total_ttc, tva_by_rate }
}

/** Format a number with 3 decimal places (TND) */
export function fmtTND(n: number): string {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n)
}

/** Round to 3 decimal places */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
