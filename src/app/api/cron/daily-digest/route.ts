import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
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

  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const in7days  = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
  const dayLabel  = format(today, 'EEEE d MMMM yyyy', { locale: fr })
  const dayCapital = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, email, owner_id, streak_days, total_points, level')

  let sent = 0

  for (const company of companies ?? []) {
    try {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('weekly_report_email, notification_email')
        .eq('company_id', company.id)
        .maybeSingle()

      const emailTo = (prefs as any)?.notification_email || (company as any).email
      if (!emailTo) continue

      const [
        { data: overdueInvs },
        { data: dueSoonInvs },
        { data: paidYesterday },
        { data: failedInvs },
        { data: allRecent },
      ] = await Promise.all([
        supabase.from('invoices')
          .select('id, number, ttc_amount, due_date, clients(name)')
          .eq('company_id', company.id)
          .in('status', ['valid', 'validated'])
          .neq('payment_status', 'paid')
          .lt('due_date', todayStr)
          .is('deleted_at', null)
          .order('due_date', { ascending: true })
          .limit(5),

        supabase.from('invoices')
          .select('id, number, ttc_amount, due_date, clients(name)')
          .eq('company_id', company.id)
          .in('status', ['valid', 'validated'])
          .neq('payment_status', 'paid')
          .gte('due_date', todayStr)
          .lte('due_date', in7days)
          .is('deleted_at', null)
          .order('due_date', { ascending: true })
          .limit(5),

        supabase.from('invoices')
          .select('id, ttc_amount')
          .eq('company_id', company.id)
          .eq('payment_status', 'paid')
          .gte('payment_date', yesterday)
          .lte('payment_date', todayStr)
          .is('deleted_at', null),

        supabase.from('invoices')
          .select('id, number')
          .eq('company_id', company.id)
          .eq('status', 'rejected')
          .is('deleted_at', null)
          .limit(3),

        supabase.from('invoices')
          .select('status')
          .eq('company_id', company.id)
          .is('deleted_at', null)
          .gte('issue_date', new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)),
      ])

      const overdueCount  = (overdueInvs ?? []).length
      const overdueAmount = (overdueInvs ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      const dueSoonCount  = (dueSoonInvs ?? []).length
      const paidAmount    = (paidYesterday ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      const paidCount     = (paidYesterday ?? []).length
      const failedCount   = (failedInvs ?? []).length

      const totalRecent = (allRecent ?? []).length
      const validRecent = (allRecent ?? []).filter((i: any) => i.status === 'valid').length
      const score = totalRecent > 0 ? Math.min(100, Math.round((validRecent / totalRecent) * 75 + 25)) : 50

      const streakDays  = Number((company as any).streak_days ?? 0)
      const totalPoints = Number((company as any).total_points ?? 0)
      const level       = (company as any).level ?? 'bronze'

      const hasAnything = overdueCount > 0 || dueSoonCount > 0 || paidCount > 0 || failedCount > 0
      if (!hasAnything && totalPoints === 0) continue

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fatoura.pro'
      const html = buildDailyDigestEmail({
        companyName: (company as any).name,
        dayLabel: dayCapital,
        overdueInvs: (overdueInvs ?? []) as any[],
        dueSoonInvs: (dueSoonInvs ?? []) as any[],
        paidAmount, paidCount,
        failedCount,
        score, streakDays, totalPoints, level,
        appUrl,
      })

      const overdueSubject = overdueCount > 0
        ? `⚠️ ${overdueCount} facture${overdueCount > 1 ? 's' : ''} en retard`
        : paidCount > 0
          ? `💰 ${fmtTND(paidAmount)} TND encaissés hier`
          : `📊 Votre bilan du ${format(today, 'd MMMM', { locale: fr })}`

      await sendEmail({
        to: emailTo,
        subject: `${overdueSubject} — ${dayCapital}`,
        html,
      })
      sent++
    } catch (e) {
      captureError(e, { action: 'cron_daily_digest', companyId: (company as any).id })
    }
  }

  return Response.json({ success: true, sent })
}

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(v)

const LEVEL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  platine: { label: 'Champion TTN', icon: '🏆', color: '#e0c4ff' },
  or:      { label: 'Expert',       icon: '🥇', color: '#d4a843' },
  argent:  { label: 'Actif',        icon: '🥈', color: '#a0aec0' },
  bronze:  { label: 'Débutant',     icon: '🥉', color: '#cd7f32' },
}

function buildDailyDigestEmail(opts: {
  companyName: string
  dayLabel: string
  overdueInvs: any[]
  dueSoonInvs: any[]
  paidAmount: number
  paidCount: number
  failedCount: number
  score: number
  streakDays: number
  totalPoints: number
  level: string
  appUrl: string
}) {
  const {
    companyName, dayLabel, overdueInvs, dueSoonInvs,
    paidAmount, paidCount, failedCount, score, streakDays, totalPoints, level, appUrl,
  } = opts

  const lvl = LEVEL_LABELS[level] ?? LEVEL_LABELS.bronze!
  const scoreColor = score >= 80 ? '#2dd4a0' : score >= 60 ? '#d4a843' : '#e05a5a'

  const overdueRows = overdueInvs.slice(0, 3).map((inv: any) => {
    const days = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
    const client = inv.clients?.name ?? 'Client'
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#fff;font-size:12px;">${inv.number}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#9ca3af;font-size:12px;">${client}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#d4a843;font-family:monospace;font-size:12px;text-align:right;">${fmtTND(Number(inv.ttc_amount ?? 0))} TND</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#f87171;font-size:11px;text-align:right;">${days}j</td>
    </tr>`
  }).join('')

  const dueSoonRows = dueSoonInvs.slice(0, 3).map((inv: any) => {
    const days = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000)
    const client = inv.clients?.name ?? 'Client'
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#fff;font-size:12px;">${inv.number}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#9ca3af;font-size:12px;">${client}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#d4a843;font-family:monospace;font-size:12px;text-align:right;">${fmtTND(Number(inv.ttc_amount ?? 0))} TND</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1b22;color:#fbbf24;font-size:11px;text-align:right;">dans ${days}j</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Digest quotidien — Fatoura Pro</title></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#e5e7eb;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px;">
    <span style="color:#d4a843;font-family:monospace;font-size:20px;font-weight:900;letter-spacing:2px;">FATOURA</span>
    <span style="color:#555;font-family:monospace;font-size:20px;font-weight:900;">PRO</span>
  </div>

  <!-- Greeting -->
  <div style="background:#0f1118;border:1px solid #1a1b22;border-radius:16px;padding:24px;margin-bottom:16px;">
    <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Bonjour 👋</p>
    <h1 style="color:#fff;font-size:18px;font-weight:800;margin:0 0 4px;">${companyName}</h1>
    <p style="color:#4b5563;font-size:12px;margin:0;">${dayLabel}</p>
  </div>

  ${overdueInvs.length > 0 ? `
  <!-- Overdue -->
  <div style="background:#1a0a0a;border:1px solid #5a1e1e;border-radius:14px;padding:20px;margin-bottom:14px;">
    <p style="color:#fca5a5;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">
      ⚠️ ${overdueInvs.length} facture${overdueInvs.length > 1 ? 's' : ''} en retard
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">N°</th>
          <th style="text-align:left;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Client</th>
          <th style="text-align:right;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Montant</th>
          <th style="text-align:right;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Retard</th>
        </tr>
      </thead>
      <tbody>${overdueRows}</tbody>
    </table>
    <a href="${appUrl}/dashboard/invoices?filter=overdue" style="display:inline-block;margin-top:14px;background:#e05a5a;color:#fff;font-size:12px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">
      Gérer les retards →
    </a>
  </div>` : ''}

  ${dueSoonInvs.length > 0 ? `
  <!-- Due Soon -->
  <div style="background:#1a150a;border:1px solid #5a3e1e;border-radius:14px;padding:20px;margin-bottom:14px;">
    <p style="color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">
      📅 ${dueSoonInvs.length} facture${dueSoonInvs.length > 1 ? 's' : ''} à encaisser cette semaine
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">N°</th>
          <th style="text-align:left;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Client</th>
          <th style="text-align:right;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Montant</th>
          <th style="text-align:right;color:#6b7280;font-size:10px;text-transform:uppercase;padding-bottom:8px;">Échéance</th>
        </tr>
      </thead>
      <tbody>${dueSoonRows}</tbody>
    </table>
  </div>` : ''}

  ${paidCount > 0 ? `
  <!-- Paid -->
  <div style="background:#0a1a12;border:1px solid #1e5a3e;border-radius:14px;padding:20px;margin-bottom:14px;">
    <p style="color:#6ee7b7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">
      💰 Paiements reçus hier
    </p>
    <p style="color:#2dd4a0;font-family:monospace;font-size:22px;font-weight:900;margin:0;">${fmtTND(paidAmount)} TND</p>
    <p style="color:#4b5563;font-size:11px;margin:4px 0 0;">${paidCount} encaissement${paidCount > 1 ? 's' : ''} enregistré${paidCount > 1 ? 's' : ''}</p>
  </div>` : ''}

  ${failedCount > 0 ? `
  <!-- Failed TTN -->
  <div style="background:#1a0f1a;border:1px solid #5a1e5a;border-radius:14px;padding:20px;margin-bottom:14px;">
    <p style="color:#e879f9;font-size:12px;font-weight:700;margin:0 0 6px;">❌ ${failedCount} soumission${failedCount > 1 ? 's' : ''} TTN rejetée${failedCount > 1 ? 's' : ''}</p>
    <a href="${appUrl}/dashboard/invoices?filter=rejected" style="display:inline-block;margin-top:8px;color:#e879f9;font-size:12px;text-decoration:underline;">Voir et corriger →</a>
  </div>` : ''}

  <!-- Stats row -->
  <div style="display:flex;gap:12px;margin-bottom:14px;">
    <div style="flex:1;background:#0f1118;border:1px solid #1a1b22;border-radius:12px;padding:16px;text-align:center;">
      <p style="color:#6b7280;font-size:10px;text-transform:uppercase;margin:0 0 6px;">Score fiscal</p>
      <p style="color:${scoreColor};font-family:monospace;font-size:22px;font-weight:900;margin:0;">${score}<span style="font-size:13px;color:#4b5563;">/100</span></p>
    </div>
    <div style="flex:1;background:#0f1118;border:1px solid #1a1b22;border-radius:12px;padding:16px;text-align:center;">
      <p style="color:#6b7280;font-size:10px;text-transform:uppercase;margin:0 0 6px;">Série active</p>
      <p style="color:#f59e0b;font-size:22px;font-weight:900;margin:0;">🔥 ${streakDays}<span style="font-size:13px;color:#4b5563;font-weight:400;"> j</span></p>
    </div>
    <div style="flex:1;background:#0f1118;border:1px solid #1a1b22;border-radius:12px;padding:16px;text-align:center;">
      <p style="color:#6b7280;font-size:10px;text-transform:uppercase;margin:0 0 6px;">Niveau</p>
      <p style="color:${lvl.color};font-size:18px;font-weight:900;margin:0;">${lvl.icon} ${lvl.label}</p>
    </div>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin:24px 0;">
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#d4a843;color:#000;font-size:13px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
      Voir mon tableau de bord →
    </a>
  </div>

  <p style="color:#374151;font-size:11px;text-align:center;margin-top:16px;">
    Fatoura Pro · <a href="${appUrl}/dashboard/settings?tab=notifications" style="color:#4b5563;">Se désabonner</a>
  </p>
</div>
</body></html>`
}
