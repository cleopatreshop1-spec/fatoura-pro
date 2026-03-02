const base = (content: string) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fatoura Pro</title></head>
<body style="margin:0;padding:0;background:#080a0f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1118;border:1px solid #1a1b22;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1a1b22;">
          <div style="font-family:monospace;font-size:20px;font-weight:bold;">
            <span style="color:#d4a843;">FATOURA</span><span style="color:#6b7280;">PRO</span>
          </div>
        </td></tr>
        <tr><td style="padding:32px 40px;">${content}</td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #1a1b22;text-align:center;">
          <p style="margin:0;font-size:11px;color:#4b5563;">
            Fatoura Pro — <a href="https://fatoura.pro" style="color:#d4a843;">www.fatoura.pro</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#d4a843;color:#000;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">${label}</a>`

export function invoiceValidatedEmail(p: {
  companyName: string; invoiceNumber: string; ttnId: string
  totalTtc: string; invoiceUrl: string
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#22c55e;font-size:18px;">✓ Facture validée par TTN</h2>
    <p style="margin:0 0 24px;color:#9ca3af;font-size:14px;">Bonjour ${p.companyName},</p>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">
      Votre facture <strong style="color:#d4a843;">${p.invoiceNumber}</strong> a été validée avec succès par le système TTN.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#161b27;border:1px solid #1a1b22;border-radius:8px;padding:16px 20px;margin:0 0 24px;width:100%;">
      <tr><td style="color:#9ca3af;font-size:13px;padding:4px 0;">TTN ID</td><td style="color:#d4a843;font-family:monospace;font-size:13px;text-align:right;">${p.ttnId}</td></tr>
      <tr><td style="color:#9ca3af;font-size:13px;padding:4px 0;">Total TTC</td><td style="color:#fff;font-weight:bold;font-size:14px;text-align:right;">${p.totalTtc}</td></tr>
    </table>
    <p style="margin:0 0 24px;">${btn(p.invoiceUrl, 'Voir la facture')}</p>`)
}

export function invoiceRejectedEmail(p: {
  companyName: string; invoiceNumber: string; rejectionReason: string; invoiceUrl: string
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#ef4444;font-size:18px;">✗ Facture rejetée par TTN</h2>
    <p style="margin:0 0 24px;color:#9ca3af;font-size:14px;">Bonjour ${p.companyName},</p>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">
      Votre facture <strong style="color:#d4a843;">${p.invoiceNumber}</strong> a été rejetée par TTN.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#1f0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px 20px;margin:0 0 24px;width:100%;">
      <tr><td style="color:#fca5a5;font-size:13px;">Motif : ${p.rejectionReason}</td></tr>
    </table>
    <p style="margin:0 0 24px;">${btn(p.invoiceUrl, 'Corriger la facture')}</p>`)
}

export function mandateExpiringEmail(p: {
  companyName: string; expiryDate: string; daysLeft: number; settingsUrl: string
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#f59e0b;font-size:18px;">⚠ Mandat de signature expirant</h2>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">
      Bonjour ${p.companyName}, votre mandat de signature Fatoura Pro expire dans <strong style="color:#d4a843;">${p.daysLeft} jours</strong> (le ${p.expiryDate}).
    </p>
    <p style="margin:0 0 24px;color:#9ca3af;font-size:13px;">
      Sans renouvellement, vous ne pourrez plus soumettre de factures à TTN.
    </p>
    <p style="margin:0 0 24px;">${btn(p.settingsUrl, 'Renouveler le mandat')}</p>`)
}

export function certExpiringEmail(p: {
  companyName: string; expiryDate: string; daysLeft: number
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#f59e0b;font-size:18px;">⚠ Certificat ANCE expirant</h2>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">
      Bonjour ${p.companyName}, votre certificat ANCE expire dans <strong style="color:#d4a843;">${p.daysLeft} jours</strong> (le ${p.expiryDate}).
    </p>
    <p style="margin:0 0 24px;color:#9ca3af;font-size:13px;">
      Contactez l'ANCE pour renouveler votre certificat avant expiration.
    </p>`)
}

export function monthlyTvaSummaryEmail(p: {
  companyName: string; period: string; totalHt: string; totalTva: string; invoiceCount: number; tvaUrl: string
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#d4a843;font-size:18px;">Récapitulatif TVA — ${p.period}</h2>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">Bonjour ${p.companyName},</p>
    <table cellpadding="0" cellspacing="0" style="background:#161b27;border:1px solid #1a1b22;border-radius:8px;padding:16px 20px;margin:0 0 24px;width:100%;">
      <tr><td style="color:#9ca3af;font-size:13px;padding:4px 0;">Factures validées</td><td style="color:#fff;text-align:right;">${p.invoiceCount}</td></tr>
      <tr><td style="color:#9ca3af;font-size:13px;padding:4px 0;">Total HT</td><td style="color:#fff;text-align:right;">${p.totalHt}</td></tr>
      <tr><td style="color:#9ca3af;font-size:13px;padding:4px 0;">Total TVA collectée</td><td style="color:#d4a843;font-weight:bold;text-align:right;">${p.totalTva}</td></tr>
    </table>
    <p style="margin:0 0 24px;">${btn(p.tvaUrl, 'Voir le détail TVA')}</p>`)
}

export function fiduciaireInvitationEmail(p: {
  fiduciaireName: string; inviteeEmail: string; signupUrl: string; personalMessage?: string
}): string {
  return base(`
    <h2 style="margin:0 0 8px;color:#d4a843;font-size:18px;">Invitation Fatoura Pro</h2>
    <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;">
      <strong>${p.fiduciaireName}</strong> vous invite à rejoindre Fatoura Pro pour gérer votre facturation électronique TTN.
    </p>
    ${p.personalMessage ? `<p style="margin:0 0 16px;color:#9ca3af;font-size:14px;font-style:italic;">"${p.personalMessage}"</p>` : ''}
    <p style="margin:0 0 24px;">${btn(p.signupUrl, "Créer mon compte")}</p>
    <p style="margin:0;color:#6b7280;font-size:12px;">Lien valable 7 jours — ${p.inviteeEmail}</p>`)
}
