import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY manquante')
    _resend = new Resend(key)
  }
  return _resend
}

type Attachment = { filename: string; content: Buffer }

export async function sendEmail({
  to, subject, html, attachments,
}: { to: string; subject: string; html: string; attachments?: Attachment[] }) {
  try {
    await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'Fatoura Pro <noreply@fatoura.pro>',
      to,
      subject,
      html,
      attachments: attachments?.map(a => ({ filename: a.filename, content: a.content })),
    })
  } catch (err) {
    console.error('[Email] Échec envoi:', err)
  }
}
