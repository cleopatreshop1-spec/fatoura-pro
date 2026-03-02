import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const { error } = await (supabase as any)
      .from('anomalies')
      .update({ is_dismissed: true })
      .eq('id', id)
      .eq('company_id', co.id)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: any) {
    return err(error.message ?? 'Erreur interne', error.status ?? 500)
  }
}
