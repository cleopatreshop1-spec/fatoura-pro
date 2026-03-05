import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, matricule_fiscal, company_type, company_name } = body

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email invalide' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('leads').insert({
      email,
      matricule_fiscal: matricule_fiscal ?? null,
      company_type:     company_type ?? null,
      company_name:     company_name ?? null,
      source:           'compliance_checker',
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fatoura.pro'
    const mf = matricule_fiscal ?? '—'

    const fineEstimate = company_type === 'sa' ? '50,000' : company_type === 'sarl' ? '20,000' : '5,000'
    const typeLabel    = company_type === 'sa' ? 'Société Anonyme' : company_type === 'sarl' ? 'SARL' : company_type === 'suarl' ? 'SUARL' : 'Entreprise individuelle'

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rapport de conformité TTN — Fatoura Pro</title></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#e5e7eb;">
<div style="max-width:580px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="color:#d4a843;font-family:monospace;font-size:20px;font-weight:900;letter-spacing:2px;">FATOURA</span>
    <span style="color:#555;font-family:monospace;font-size:20px;font-weight:900;">PRO</span>
  </div>

  <div style="background:#0f1118;border:1px solid #1a1b22;border-radius:16px;padding:28px;margin-bottom:20px;">
    <p style="color:#d4a843;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Rapport de Conformité TTN</p>
    <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 4px;">${company_name ?? 'Votre entreprise'}</h1>
    <p style="color:#6b7280;font-size:12px;margin:0;">MF: ${mf} · ${typeLabel}</p>
  </div>

  <div style="background:#1a0a0a;border:1px solid #5a1e1e;border-radius:14px;padding:20px;margin-bottom:16px;">
    <p style="color:#fca5a5;font-size:13px;font-weight:700;margin:0 0 10px;">⚠️ Exposition aux amendes DGI</p>
    <p style="color:#fff;font-family:monospace;font-size:28px;font-weight:900;margin:0;">Jusqu'à ${fineEstimate} TND</p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;">Par facture papier non soumise à TTN (Art. 18, loi finances 2024)</p>
  </div>

  <div style="background:#0f1118;border:1px solid #1a1b22;border-radius:14px;padding:20px;margin-bottom:20px;">
    <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Checklist de conformité</p>
    ${[
      'Soumission TTN obligatoire pour toutes factures B2B',
      'Signature électronique XAdES requise',
      'Archivage 10 ans minimum',
      'Format XML structuré imposé',
      'Délai soumission : 24h après émission',
    ].map(item => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a1b22;">
      <span style="color:#e05a5a;font-size:14px;">✗</span>
      <span style="color:#9ca3af;font-size:12px;">${item}</span>
    </div>`).join('')}
  </div>

  <div style="text-align:center;margin-top:24px;">
    <p style="color:#9ca3af;font-size:13px;margin-bottom:16px;">Régularisez votre situation en moins de 60 secondes</p>
    <a href="${appUrl}/register?mf=${encodeURIComponent(mf)}&ref=compliance" style="display:inline-block;background:#d4a843;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
      Commencer gratuitement →
    </a>
    <p style="color:#374151;font-size:11px;margin-top:16px;">30 jours gratuits · Aucune carte requise</p>
  </div>
</div>
</body></html>`

    await sendEmail({
      to: email,
      subject: `Votre rapport de conformité TTN — ${company_name ?? mf}`,
      html,
    })

    if (process.env.LEADS_NOTIFICATION_EMAIL) {
      await sendEmail({
        to: process.env.LEADS_NOTIFICATION_EMAIL,
        subject: `Nouveau lead: ${email} (${company_name ?? mf})`,
        html: `<p>Email: ${email}<br>MF: ${mf}<br>Type: ${typeLabel}<br>Société: ${company_name ?? '—'}</p>`,
      })
    }

    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
