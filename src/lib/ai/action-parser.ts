export type InvoiceLine = {
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
}

export type InvoiceAction = {
  type: 'CREATE_INVOICE'
  data: {
    client_name:      string | null
    client_matricule: string | null
    lines: InvoiceLine[]
    invoice_date: string
    notes:        string | null
    confidence:   number
  }
}

export type AIAction = InvoiceAction | null

export interface ParsedAIResponse {
  text:   string
  action: AIAction
}

export function parseAIResponse(rawResponse: string): ParsedAIResponse {
  const match = rawResponse.match(/%%ACTION%%\s*([\s\S]*?)\s*%%END_ACTION%%/)

  if (!match) {
    return { text: rawResponse.trim(), action: null }
  }

  const text = rawResponse
    .replace(/%%ACTION%%[\s\S]*?%%END_ACTION%%/, '')
    .trim()

  try {
    const parsed = JSON.parse(match[1]) as InvoiceAction
    if (!parsed?.type || !parsed?.data) {
      return { text: rawResponse.trim(), action: null }
    }
    return { text, action: parsed }
  } catch {
    return { text: rawResponse.trim(), action: null }
  }
}

// Legacy compat — kept so existing imports don't break during transition
export function parseAction(responseText: string): AIAction {
  return parseAIResponse(responseText).action
}

export function stripAction(responseText: string): string {
  return parseAIResponse(responseText).text
}
