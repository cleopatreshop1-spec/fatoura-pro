export type InvoiceLine = {
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
}

export type AIAction =
  | { type: 'CREATE_INVOICE'; data: { client_name: string; lines: InvoiceLine[] } }
  | null

export function parseAction(responseText: string): AIAction {
  const match = responseText.match(/ACTION:([A-Z_]+):(\{[\s\S]+\})\s*$/)
  if (!match) return null

  try {
    const [, actionType, jsonStr] = match
    const data = JSON.parse(jsonStr)
    if (actionType === 'CREATE_INVOICE') {
      return { type: 'CREATE_INVOICE', data }
    }
  } catch {
    // Malformed JSON — silently ignore
  }
  return null
}

export function stripAction(responseText: string): string {
  return responseText.replace(/\nACTION:[A-Z_]+:\{[\s\S]+\}\s*$/, '').trim()
}
