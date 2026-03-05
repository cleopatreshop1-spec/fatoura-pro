import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity, insertNotification } from '@/lib/api-helpers'
import { captureError, captureMessage } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)

    // Deactivate any existing mandates
    await (supabase as any).from('mandates').update({ is_active: false })
      .eq('company_id', company.id).eq('is_active', true)

    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const ua = request.headers.get('user-agent') ?? null
    const sealSerial  = process.env.FATOURA_SEAL_SERIAL  ?? 'FATOURA-PRO-SEAL-2026'
    const sealExpiry  = process.env.FATOURA_SEAL_EXPIRY  ?? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const { data, error } = await (supabase as any).from('mandates').insert({
      company_id:       company.id,
      accepted_by:      user.id,
      accepted_at:      new Date().toISOString(),
      ip_address:       ip,
      user_agent:       ua,
      seal_identifier:  sealSerial,
      seal_valid_until: sealExpiry,
      scope:            'all_invoices',
      is_active:        true,
    }).select('id').single()

    if (error) return err(error.message, 500)

    await logActivity(supabase as any, company.id, user.id, 'mandate_accepted', 'mandate', (data as any).id,
      `Mandat de signature accepté depuis ${ip ?? 'IP inconnue'}`)
    await insertNotification(supabase as any, company.id, 'mandate_accepted',
      'Mandat de signature activé', `Valide jusqu'au ${new Date(sealExpiry).toLocaleDateString('fr-FR')}`)

    captureMessage('Mandate accepted', 'info', {
      companyId: company.id,
      sealIdentifier: process.env.FATOURA_SEAL_SERIAL ?? 'FATOURA-PRO-SEAL-2026',
    })
    return success({ message: 'Mandat accepté', mandateId: (data as any).id, sealValidUntil: sealExpiry }, 201)
  } catch (e: any) {
    captureError(e, { action: 'mandate_accept' })
    return err(e.message, e.status ?? 500)
  }
}
