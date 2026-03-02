export interface ScannedLine {
  description: string
  quantity: number
  unit_price: number
  tva_rate: 0 | 7 | 13 | 19
  total_ht: number
}

export interface ScannedInvoice {
  confidence: number
  vendor: {
    name: string
    address: string
    phone: string
    mf: string
    rne: string
  }
  client: {
    name: string
    address: string
    mf: string
  }
  invoice: {
    number: string
    date: string
    due_date: string | null
  }
  lines: ScannedLine[]
  totals: {
    total_ht: number
    total_tva: number
    timbre: number
    total_ttc: number
  }
  payment: {
    method: 'cash' | 'cheque' | 'virement' | 'traite' | 'unknown'
    notes: string
  }
  language_detected: 'ar' | 'fr' | 'mixed'
  warnings: string[]
}

export type ScanStatus =
  | 'idle'
  | 'capturing'
  | 'enhancing'
  | 'reading'
  | 'structuring'
  | 'done'
  | 'error'

export interface ScanStep {
  key: ScanStatus
  label: string
  duration: number
}
