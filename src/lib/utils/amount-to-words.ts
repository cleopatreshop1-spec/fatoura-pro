/**
 * Convert a numeric amount to French words (Tunisian Dinar format).
 * Example: 1200.500 → "Mille deux cents dinars et cinq cents millimes"
 *
 * Rules:
 * - Integer part → "X dinars"
 * - Decimal part (3 digits = millimes) → "Y millimes"
 * - Joined by "et" if both parts present
 * - "mille" never pluralised, "million/milliard" pluralised with s
 * - "cent" pluralised only when final and not followed by another number
 * - "vingt" pluralised only at 80 when final (quatre-vingts)
 * - "un" → "un" (not "une") in dinar context
 */

const ONES: string[] = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]

function tensToWords(n: number, isFinal: boolean): string {
  if (n < 20) return ONES[n]

  const tens = Math.floor(n / 10)
  const unit = n % 10

  switch (tens) {
    case 2:
      if (unit === 0) return isFinal ? 'vingts' : 'vingt'
      if (unit === 1) return 'vingt et un'
      return `vingt-${ONES[unit]}`
    case 3:
      if (unit === 0) return 'trente'
      if (unit === 1) return 'trente et un'
      return `trente-${ONES[unit]}`
    case 4:
      if (unit === 0) return 'quarante'
      if (unit === 1) return 'quarante et un'
      return `quarante-${ONES[unit]}`
    case 5:
      if (unit === 0) return 'cinquante'
      if (unit === 1) return 'cinquante et un'
      return `cinquante-${ONES[unit]}`
    case 6:
      if (unit === 0) return 'soixante'
      if (unit === 1) return 'soixante et un'
      return `soixante-${ONES[unit]}`
    case 7:
      // 70-79: soixante-dix, soixante et onze, soixante-douze...
      if (unit === 0) return 'soixante-dix'
      if (unit === 1) return 'soixante et onze'
      return `soixante-${ONES[10 + unit]}`
    case 8:
      // 80-89: quatre-vingts, quatre-vingt-un...
      if (unit === 0) return isFinal ? 'quatre-vingts' : 'quatre-vingt'
      return `quatre-vingt-${ONES[unit]}`
    case 9:
      // 90-99: quatre-vingt-dix, quatre-vingt-onze...
      if (unit === 0) return 'quatre-vingt-dix'
      return `quatre-vingt-${ONES[10 + unit]}`
    default:
      return ''
  }
}

function hundredsToWords(n: number, isFinal: boolean): string {
  if (n === 0) return ''
  if (n < 100) return tensToWords(n, isFinal)

  const hundreds = Math.floor(n / 100)
  const remainder = n % 100

  if (hundreds === 1) {
    if (remainder === 0) return isFinal ? 'cent' : 'cent'
    return `cent ${tensToWords(remainder, isFinal)}`
  }

  const hundredWord = ONES[hundreds]
  if (remainder === 0) return isFinal ? `${hundredWord} cents` : `${hundredWord} cent`
  return `${hundredWord} cent ${tensToWords(remainder, isFinal)}`
}

function chunkToWords(n: number, isFinal: boolean): string {
  return hundredsToWords(n, isFinal)
}

function integerToWords(n: number): string {
  if (n === 0) return 'zéro'

  if (n < 0) return `moins ${integerToWords(-n)}`

  const parts: string[] = []

  const milliards = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1_000)
  const remainder = n % 1_000

  const hasAfterMilliards = millions > 0 || milliers > 0 || remainder > 0
  const hasAfterMillions = milliers > 0 || remainder > 0
  const hasAfterMilliers = remainder > 0

  if (milliards > 0) {
    const w = chunkToWords(milliards, !hasAfterMilliards)
    parts.push(milliards === 1 ? 'un milliard' : `${w} milliards`)
  }

  if (millions > 0) {
    const w = chunkToWords(millions, !hasAfterMillions)
    parts.push(millions === 1 ? 'un million' : `${w} millions`)
  }

  if (milliers > 0) {
    if (milliers === 1) {
      parts.push('mille')
    } else {
      const w = chunkToWords(milliers, false)
      parts.push(`${w} mille`)
    }
  }

  if (remainder > 0) {
    parts.push(chunkToWords(remainder, true))
  }

  return parts.join(' ')
}

/**
 * Convert a TND amount to French words.
 * @param amount - numeric value (e.g. 1200.500)
 * @returns e.g. "Mille deux cents dinars et cinq cents millimes"
 */
export function amountToWords(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return 'Montant invalide'

  const rounded = Math.round(amount * 1000) / 1000
  const intPart = Math.floor(rounded)
  const millimes = Math.round((rounded - intPart) * 1000)

  const dinarWords = integerToWords(intPart)
  const dinarLabel = intPart <= 1 ? 'dinar' : 'dinars'

  const capitalised =
    dinarWords.charAt(0).toUpperCase() + dinarWords.slice(1)

  if (millimes === 0) {
    return `${capitalised} ${dinarLabel}`
  }

  const millimeWords = integerToWords(millimes)
  const millimeLabel = millimes <= 1 ? 'millime' : 'millimes'

  return `${capitalised} ${dinarLabel} et ${millimeWords} ${millimeLabel}`
}
