import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addDays, differenceInDays, parseISO } from 'date-fns'
import { shouldSendEmail, getCompanyEmail } from '@/lib/email/should-send'
import { sendEmail } from '@/lib/email/resend'
import { mandateExpiringEmail } from '@/lib/email/templates'
import { captureError } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()

  try {
    const cutoff = addDays(today, 60).toISOString().slice(0, 10)
    const { data: expiringMandates } = await supabase
      .from('mandates')
      .select('*, companies(id, owner_id, name, email)')
      .eq('is_active', true)
      .lte('seal_valid_until', cutoff)

    let notified = 0

    for (const mandate of expiringMandates ?? []) {
      try {
        const daysLeft = differenceInDays(
          parseISO((mandate as any).seal_valid_until), today
        )
        if (![60, 30, 7].includes(daysLeft)) continue

        const companyId = (mandate as any).company_id
        await supabase.from('notifications').insert({
          company_id: companyId,
          type: 'mandate_expiring',
          title: `Mandat de signature expire dans ${daysLeft} jours`,
          message: `Votre mandat Fatoura Pro expire le ${(mandate as any).seal_valid_until}. Contactez-nous pour le renouveler.`,
          is_read: false,
        })

        const canSend = await shouldSendEmail(supabase as any, companyId, 'mandate_expiring_email')
        if (canSend) {
          const email = await getCompanyEmail(supabase as any, companyId)
          if (email) {
            await sendEmail({
              to: email,
              subject: `⚠️ Votre mandat Fatoura Pro expire dans ${daysLeft} jours`,
              html: mandateExpiringEmail({
                companyName: (mandate as any).companies?.name ?? 'Votre entreprise',
                expiryDate:  (mandate as any).seal_valid_until,
                daysLeft,
                settingsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=signature`,
              }),
            })
          }
        }
        notified++
      } catch (e) {
        captureError(e, { action: 'cron_check_expiry' })
      }
    }

    console.log(`[check-expiry] Mandats vérifiés: ${expiringMandates?.length ?? 0}, notifiés: ${notified}`)
    return Response.json({ success: true, checked: expiringMandates?.length ?? 0, notified })
  } catch (e: any) {
    captureError(e, { action: 'cron_check_expiry' })
    return Response.json({ error: e.message }, { status: 500 })
  }
}
