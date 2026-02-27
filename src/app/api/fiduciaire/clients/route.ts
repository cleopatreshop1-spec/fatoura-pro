import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const { data, error } = await (supabase as any)
      .from('fiduciaire_clients')
      .select(`
        id, client_company_id, invited_email, client_name, status,
        accepted_at, invited_at, permissions, revoked_at,
        clientCompany:companies!client_company_id(id, name, matricule_fiscal, invoice_prefix)
      `)
      .eq('fiduciaire_company_id', company.id)
      .order('invited_at', { ascending: false })
    if (error) return err(error.message, 500)
    return success({ clients: data })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
