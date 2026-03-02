import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { sendEmail } from '@/lib/email/resend'
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

  const today     = new Date()
  const weekStart = format(startOfWeek(subDays(today, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(subDays(today, 1),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekLabel = `${format(startOfWeek(subDays(today, 1), { weekStartsOn: 1 }), 'd MMM', { locale: fr })} – ${format(endOfWeek(subDays(today, 1), { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}`

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, email, owner_id')

  let sent = 0

  for (const company of companies ?? []) {
    try {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('weekly_report_email, notification_email')
        .eq('company_id', company.id)
        .maybeSingle()

      if (!prefs?.weekly_report_email) continue

      const emailTo = (prefs as any).notification_email || (company as any).email
      if (!emailTo) continue

      const [
        { data: weekInvoices },
        { data: paidWeek },
        { data: pendingInvoices },
        { data: rejectedInvoices },
      ] = await Promise.all([
        supabase.from('invoices').select('id, ht_amount, status')
          .eq('company_id', company.id).eq('status', 'valid')
          .gte('issue_date', weekStart).lte('issue_date', weekEnd)
          .is('deleted_at', null),

        supabase.from('invoices').select('id, ttc_amount, client_id, clients(name)')
          .eq('company_id', company.id).eq('payment_status', 'paid')
          .gte('payment_date', weekStart).lte('payment_date', weekEnd)
          .is('deleted_at', null),

        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).in('status', ['draft', 'pending'])
          .is('deleted_at', null),

        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('status', 'rejected')
          .is('deleted_at', null),
      ])

      const caWeek      = (weekInvoices ?? []).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
      const validCount  = (weekInvoices ?? []).length
      const paidAmount  = (paidWeek ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      const paidCount   = (paidWeek ?? []).length

      // Best client this week
      const clientMap: Record<string, { name: string; total: number }> = {}
      for (const inv of paidWeek ?? []) {
        const cl = (inv as any).clients
        if (!cl?.name) continue
        if (!clientMap[cl.name]) clientMap[cl.name] = { name: cl.name, total: 0 }
        clientMap[cl.name].total += Number((inv as any).ttc_amount ?? 0)
      }
      const bestClient = Object.values(clientMap).sort((a, b) => b.total - a.total)[0] ?? null

      // Fiscal score (simplified)
      const { data: allInvs } = await supabase.from('invoices')
        .select('status, created_at, validated_at, payment_status, due_date, payment_date')
        .eq('company_id', company.id).is('deleted_at', null)
        .gte('issue_date', format(subDays(today, 90), 'yyyy-MM-dd'))
      const totalInvs = (allInvs ?? []).length
      const validInvs = (allInvs ?? []).filter((i: any) => i.status === 'valid').length
      const score = totalInvs > 0 ? Math.round((validInvs / totalInvs) * 75 + 25) : 50

      const fmtTND = (v: number) =>
        new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(v)

      const urgentCount = ((pendingInvoices as any)?.count ?? 0) + ((rejectedInvoices as any)?.count ?? 0)

      const html = buildWeeklySummaryEmail({
        companyName: (company as any).name,
        weekLabel,
        caWeek, validCount, paidAmount, paidCount,
        urgentCount, score, bestClient,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://fatoura.pro',
      })

      await sendEmail({
        to: emailTo,
        subject: `📊 Votre bilan de la semaine — Fatoura Pro (${weekLabel})`,
        html,
      })
      sent++
    } catch (e) {
      captureError(e, { action: 'cron_weekly_summary', companyId: (company as any).id })
    }
  }

  return Response.json({ success: true, sent, weekLabel })
}

function buildWeeklySummaryEmail(opts: {
  companyName: string
  weekLabel: string
  caWeek: number
  validCount: number
  paidAmount: number
  paidCount: number
  urgentCount: number
  score: number
  bestClient: { name: string; total: number } | null
  appUrl: string
}) {
  const { companyName, weekLabel, caWeek, validCount, paidAmount, paidCount,
          urgentCount, score, bestClient, appUrl } = opts

  const fmtTND = (v: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(v)

  const scoreColor = score >= 75 ? '#2dd4a0' : score >= 55 ? '#d4a843' : '#e05a5a'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bilan hebdomadaire — Fatoura Pro</title></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#e5e7eb;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <span style="color:#d4a843;font-family:monospace;font-size:22px;font-weight:900;letter-spacing:2px;">FATOURA</span>
    <span style="color:#555;font-family:monospace;font-size:22px;font-weight:900;">PRO</span>
  </div>

  <div style="background:#0f1118;border:1px solid #1a1b22;border-radius:16px;padding:28px;margin-bottom:20px;">
    <p style="color:#d4a843;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Rapport hebdomadaire</p>
    <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 4px;">${companyName}</h1>
    <p style="color:#6b7280;font-size:13px;margin:0;">Semaine du ${weekLabel}</p>
  </div>

  <!-- KPI Grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
    ${[
      { label: 'CA validé TTN', value: fmtTND(caWeek) + ' TND', sub: `${validCount} facture${validCount !== 1 ? 's' : ''}`, color: '#d4a843' },
      { label: 'Paiements reçus', value: fmtTND(paidAmount) + ' TND', sub: `${paidCount} encaissement${paidCount !== 1 ? 's' : ''}`, color: '#2dd4a0' },
      { label: 'Actions urgentes', value: String(urgentCount), sub: 'à traiter', color: urgentCount > 0 ? '#e05a5a' : '#2dd4a0' },
      { label: 'Score fiscal', value: String(score) + '/100', sub: 'santé fiscale', color: scoreColor },
    ].map(k => `
    <div style="background:#161b27;border:1px solid #1a1b22;border-radius:12px;padding:16px;">
      <p style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">${k.label}</p>
      <p style="color:${k.color};font-family:monospace;font-size:20px;font-weight:900;margin:0;">${k.value}</p>
      <p style="color:#4b5563;font-size:11px;margin:4px 0 0;">${k.sub}</p>
    </div>`).join('')}
  </div>

  ${bestClient ? `
  <div style="background:#161b27;border:1px solid #1a1b22;border-radius:12px;padding:16px;margin-bottom:20px;">
    <p style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">⭐ Meilleur client cette semaine</p>
    <p style="color:#fff;font-size:15px;font-weight:700;margin:0;">${bestClient.name}</p>
    <p style="color:#d4a843;font-family:monospace;font-size:13px;margin:4px 0 0;">${fmtTND(bestClient.total)} TND encaissés</p>
  </div>` : ''}

  ${urgentCount > 0 ? `
  <div style="background:#1a0f0f;border:1px solid #5a1e1e;border-radius:12px;padding:16px;margin-bottom:20px;">
    <p style="color:#fca5a5;font-size:13px;font-weight:600;margin:0 0 8px;">⚠️ ${urgentCount} action${urgentCount !== 1 ? 's' : ''} urgente${urgentCount !== 1 ? 's' : ''} à traiter</p>
    <p style="color:#9ca3af;font-size:12px;margin:0;">Des factures nécessitent votre attention immédiate pour éviter des pénalités TTN.</p>
  </div>` : ''}

  <!-- CTA -->
  <div style="text-align:center;margin-top:24px;">
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#d4a843;color:#000;font-size:13px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
      Ouvrir mon tableau de bord →
    </a>
  </div>

  <p style="color:#374151;font-size:11px;text-align:center;margin-top:24px;">
    Fatoura Pro · <a href="${appUrl}/dashboard/settings?tab=notifications" style="color:#4b5563;">Se désabonner</a>
  </p>
</div>
</body></html>`
}
