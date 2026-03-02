import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)

    const { data, error } = await (supabase as any)
      .from('ai_suggestions')
      .select('id, message, type, created_at')
      .eq('company_id', company.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) return err(error.message, 500)

    return success({ suggestions: data ?? [], count: (data ?? []).length })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
