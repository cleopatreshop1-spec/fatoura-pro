import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const { fiduciaire_token } = await request.json()

    if (!fiduciaire_token) return err('fiduciaire_token requis', 400)

    // Find the pending invitation by token
    const { data: invite, error: findErr } = await (supabase as any)
      .from('fiduciaire_clients')
      .select('id, fiduciaire_company_id, invited_email, status')
      .eq('invite_token', fiduciaire_token)
      .eq('status', 'pending')
      .maybeSingle()

    if (findErr) return err(findErr.message, 500)
    if (!invite) return err('Invitation introuvable ou deja acceptee', 404)

    // Link this company to the fiduciaire
    const { error: updateErr } = await (supabase as any)
      .from('fiduciaire_clients')
      .update({
        client_company_id: company.id,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', (invite as any).id)

    if (updateErr) return err(updateErr.message, 500)

    await logActivity(supabase as any, company.id, user.id,
      'fiduciaire_invite_accepted', 'fiduciaire_client', (invite as any).id,
      `Invitation acceptee depuis ${(invite as any).fiduciaire_company_id}`)

    return success({ message: 'Lien fiduciaire etabli avec succes' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
