import type { Invoice, InvoiceLine, Client, Company } from './database'

export type InvoiceStatus = 'draft' | 'pending' | 'valid' | 'rejected' | 'queued'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type ClientType = 'B2B' | 'B2C'
export type TvaRegime = 'reel' | 'forfait' | 'exonere'

export interface InvoiceWithRelations extends Invoice {
  clients: Client | null
  companies: Company | null
  invoice_lines: InvoiceLine[]
}

export interface InvoiceListItem {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: InvoiceStatus
  total_ht: number
  total_ttc: number
  payment_status: PaymentStatus
  client_name?: string
}

export interface DashboardKPIs {
  totalCA: number
  totalTVA: number
  pendingCount: number
  clientCount: number
}

export interface MonthlyRevenue {
  month: string
  ht: number
  tva: number
  ttc: number
}

export interface TvaBreakdownRow {
  period: string
  total_ht: number
  total_tva: number
  total_ttc: number
  invoice_count: number
  by_rate: Record<number, { base: number; tva: number }>
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export interface CompanyContextValue {
  activeCompany: Company | null
  loadingCompanies: boolean
  companyLoadError: string | null
  setActiveCompany: (company: Company | null) => void
}
