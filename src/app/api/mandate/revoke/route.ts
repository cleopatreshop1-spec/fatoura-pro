import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'

export async function PATCH(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)

    const { data: mandate } = await (supabase as any)
      .from('mandates').select('id')
      .eq('company_id', company.id).eq('is_active', true)
      .limit(1).maybeSingle()

    if (!mandate) return err('Aucun mandat actif', 404)

    const { error } = await (supabase as any).from('mandates').update({
      is_active:  false,
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    }).eq('id', (mandate as any).id)

    if (error) return err(error.message, 500)
    await logActivity(supabase as any, company.id, user.id, 'mandate_revoked', 'mandate', (mandate as any).id, 'Mandat de signature révoqué')
    return success({ message: 'Mandat révoqué' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

// Kept for backward compat
export { PATCH as POST }
