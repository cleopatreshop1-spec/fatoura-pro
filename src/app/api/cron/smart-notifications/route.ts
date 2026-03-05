import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const in3days  = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, streak_days, streak_last_activity')

  let fired = 0

  for (const company of companies ?? []) {
    try {
      const companyId = (company as any).id

      // 1. Invoices due TODAY
      const { data: dueToday } = await supabase
        .from('invoices')
        .select('id, number, ttc_amount')
        .eq('company_id', companyId)
        .in('status', ['valid', 'validated'])
        .neq('payment_status', 'paid')
        .eq('due_date', todayStr)
        .is('deleted_at', null)

      for (const inv of dueToday ?? []) {
        await insertNotification(supabase, companyId,
          'invoice_due_today',
          `🔔 Facture ${inv.number} — échéance aujourd'hui`,
          `Montant : ${fmtTND(Number(inv.ttc_amount))} TND — relancez votre client maintenant.`,
          inv.id
        )
        fired++
      }

      // 2. Invoices 3 days overdue
      const { data: overdue3 } = await supabase
        .from('invoices')
        .select('id, number, ttc_amount, clients(name)')
        .eq('company_id', companyId)
        .in('status', ['valid', 'validated'])
        .neq('payment_status', 'paid')
        .eq('due_date', new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10))
        .is('deleted_at', null)

      for (const inv of overdue3 ?? []) {
        const clientName = (inv as any).clients?.name ?? 'votre client'
        await insertNotification(supabase, companyId,
          'invoice_overdue_3d',
          `⚠️ Facture ${inv.number} — 3 jours de retard`,
          `${clientName} n'a pas encore payé. Envoyez un rappel maintenant.`,
          inv.id
        )
        fired++
      }

      // 3. TTN rejection still not fixed (rejected status)
      const { data: rejected } = await supabase
        .from('invoices')
        .select('id, number')
        .eq('company_id', companyId)
        .eq('status', 'rejected')
        .is('deleted_at', null)
        .limit(1)

      if ((rejected ?? []).length > 0) {
        await insertNotification(supabase, companyId,
          'ttn_rejection_pending',
          `❌ Soumission TTN rejetée — action requise`,
          `Des factures rejetées par TTN nécessitent votre attention immédiate.`
        )
        fired++
      }

      // 4. Streak about to break (no activity in 5 days)
      const lastActivity = (company as any).streak_last_activity
      const streakDays   = Number((company as any).streak_days ?? 0)
      if (lastActivity && streakDays >= 3) {
        const daysSince = Math.floor((today.getTime() - new Date(lastActivity).getTime()) / 86400000)
        if (daysSince === 5) {
          await insertNotification(supabase, companyId,
            'streak_warning',
            `🔥 Votre série de ${streakDays} jours est en danger!`,
            `Soumettez ou validez une facture aujourd'hui pour maintenir votre série.`
          )
          fired++
        }
      }

    } catch (e) {
      captureError(e, { action: 'cron_smart_notifications', companyId: (company as any).id })
    }
  }

  return Response.json({ success: true, fired })
}

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(v)

async function insertNotification(
  supabase: any,
  companyId: string,
  type: string,
  title: string,
  message: string,
  relatedId?: string
) {
  await supabase.from('notifications').insert({
    company_id:  companyId,
    type,
    title,
    message,
    related_id:  relatedId ?? null,
    is_read:     false,
  })
}
