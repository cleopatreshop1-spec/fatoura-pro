import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity, insertNotification } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const { email, client_name, message } = await request.json()

    if (!email?.trim()) return err('Email requis', 422)

    // Check not already invited
    const { count } = await (supabase as any)
      .from('fiduciaire_clients')
      .select('id', { count: 'exact', head: true })
      .eq('fiduciaire_company_id', company.id)
      .eq('invited_email', email.trim().toLowerCase())
      .neq('status', 'revoked')

    if ((count ?? 0) > 0) return err('Ce client a déjà été invité', 409)

    const { data, error } = await (supabase as any)
      .from('fiduciaire_clients')
      .insert({
        fiduciaire_company_id: company.id,
        invited_email: email.trim().toLowerCase(),
        client_name: client_name?.trim() || null,
        invite_message: message?.trim() || null,
        status: 'pending',
        invited_at: new Date().toISOString(),
      })
      .select('id, invite_token')
      .single()

    if (error) return err(error.message, 500)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fatoura.pro'
    const registerLink = `${baseUrl}/register?fiduciaire_token=${(data as any).invite_token}`

    await logActivity(supabase as any, company.id, user.id,
      'fiduciaire_invite_sent', 'fiduciaire_client', (data as any).id,
      `Invitation envoyée à ${email}`)

    await insertNotification(supabase as any, company.id, 'fiduciaire_invite_sent',
      `Invitation envoyée à ${email}`, client_name ? `Client: ${client_name}` : undefined)

    return success({
      message: `Invitation envoyée à ${email}`,
      inviteLink: registerLink,
      clientId: (data as any).id,
    }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
