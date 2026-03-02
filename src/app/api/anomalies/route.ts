import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'

export const maxDuration = 15

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const { data, error } = await (supabase as any)
      .from('anomalies')
      .select('*, invoices(number, ttc_amount)')
      .eq('company_id', co.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return Response.json({ anomalies: data ?? [] })
  } catch (error: any) {
    return err(error.message ?? 'Erreur interne', error.status ?? 500)
  }
}
