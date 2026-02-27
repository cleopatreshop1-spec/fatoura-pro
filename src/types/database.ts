export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          owner_id: string
          name: string
          matricule_fiscal: string | null
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          tva_regime: 'reel' | 'forfait' | 'exonere'
          bank_name: string | null
          bank_rib: string | null
          own_cert_pem: string | null
          own_key_pem: string | null
          ttn_username: string | null
          ttn_password: string | null
          invoice_prefix: string
          invoice_counter: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          matricule_fiscal: string | null
          address: string | null
          phone: string | null
          email: string | null
          type: 'B2B' | 'B2C'
          notes: string | null
          total_invoiced: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'total_invoiced'> & {
          id?: string
          created_at?: string
          total_invoiced?: number
        }
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          client_id: string | null
          invoice_number: string
          invoice_date: string
          due_date: string | null
          status: 'draft' | 'pending' | 'valid' | 'rejected' | 'queued'
          total_ht: number
          total_tva: number
          stamp_duty: number
          total_ttc: number
          total_in_words: string | null
          ttn_id: string | null
          ttn_xml: string | null
          ttn_response: Json | null
          ttn_rejection_reason: string | null
          submitted_at: string | null
          validated_at: string | null
          notes: string | null
          payment_status: 'unpaid' | 'partial' | 'paid'
          payment_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          sort_order: number
          description: string
          quantity: number
          unit_price: number
          tva_rate: number
          line_ht: number
          line_tva: number
          line_ttc: number
        }
        Insert: Omit<Database['public']['Tables']['invoice_lines']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['invoice_lines']['Insert']>
      }
      mandates: {
        Row: {
          id: string
          company_id: string
          accepted_by: string
          accepted_at: string
          ip_address: string | null
          user_agent: string | null
          seal_identifier: string
          seal_valid_until: string
          scope: string
          max_amount_ttc: number | null
          is_active: boolean
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['mandates']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['mandates']['Insert']>
      }
      ttn_queue: {
        Row: {
          id: string
          invoice_id: string
          attempts: number
          max_attempts: number
          last_error: string | null
          next_retry_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ttn_queue']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ttn_queue']['Insert']>
      }
      api_keys: {
        Row: {
          id: string
          company_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions: string[]
          last_used_at: string | null
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          company_id: string
          type: 'invoice_validated' | 'invoice_rejected' | 'mandate_expiring' | 'cert_expiring'
          title: string
          message: string | null
          invoice_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          company_id: string | null
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
      accountant_links: {
        Row: {
          id: string
          accountant_id: string | null
          company_id: string | null
          role: string | null
          invited_email: string | null
          invited_at: string | null
          accepted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['accountant_links']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['accountant_links']['Insert']>
      }
    }
  }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceLine = Database['public']['Tables']['invoice_lines']['Row']
export type Mandate = Database['public']['Tables']['mandates']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
