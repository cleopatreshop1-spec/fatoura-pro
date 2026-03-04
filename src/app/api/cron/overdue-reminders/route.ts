import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { differenceInDays, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { shouldSendEmail, getCompanyEmail } from '@/lib/email/should-send'
import { sendEmail } from '@/lib/email/resend'
import { overdueReminderEmail } from '@/lib/email/templates'

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n) + ' TND'

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
  const todayStr = today.toISOString().slice(0, 10)

  try {
    // Fetch all valid/validated unpaid overdue invoices with company + client data
    const { data: overdueInvoices, error } = await supabase
      .from('invoices')
      .select('id, number, ttc_amount, due_date, company_id, companies(id, name, email), clients(name)')
      .in('status', ['valid', 'validated'])
      .neq('payment_status', 'paid')
      .lt('due_date', todayStr)
      .is('deleted_at', null)

    if (error) throw error

    let sent = 0
    let skipped = 0

    // Group by company to send one summary or per-invoice (we do per-invoice, deduplicated daily)
    const grouped: Record<string, typeof overdueInvoices> = {}
    for (const inv of (overdueInvoices ?? [])) {
      const cid = inv.company_id
      if (!grouped[cid]) grouped[cid] = []
      grouped[cid]!.push(inv)
    }

    for (const [companyId, invoices] of Object.entries(grouped)) {
      if (!invoices?.length) continue

      const canSend = await shouldSendEmail(supabase as any, companyId, 'overdue_reminder_email')
      if (!canSend) { skipped += invoices.length; continue }

      const email = await getCompanyEmail(supabase as any, companyId)
      if (!email) { skipped += invoices.length; continue }

      const companyName = (invoices[0] as any).companies?.name ?? 'Votre entreprise'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.fatoura.pro'

      // Send one email per overdue invoice (cap at 5 per company per run to avoid spam)
      const toNotify = invoices.slice(0, 5)

      for (const inv of toNotify) {
        const daysOverdue = differenceInDays(today, parseISO(inv.due_date))
        // Only remind on day 1, 3, 7, 14, 30 overdue — avoid daily spam
        if (![1, 3, 7, 14, 30].includes(daysOverdue)) continue

        const html = overdueReminderEmail({
          companyName,
          clientName: (inv as any).clients?.name ?? 'Client inconnu',
          invoiceNumber: inv.number ?? '—',
          totalTtc: fmtTND(Number(inv.ttc_amount ?? 0)),
          dueDate: format(parseISO(inv.due_date), 'd MMMM yyyy', { locale: fr }),
          daysOverdue,
          invoiceUrl: `${appUrl}/dashboard/invoices/${inv.id}`,
        })

        await sendEmail({
          to: email,
          subject: `⚠ Facture ${inv.number} — retard de ${daysOverdue}j`,
          html,
        })
        sent++
      }
    }

    return Response.json({ ok: true, sent, skipped })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
