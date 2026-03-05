import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity, insertNotification } from '@/lib/api-helpers'
import { awardPoints } from '@/lib/gamification/award-points'
import { captureError, captureMessage } from '@/lib/monitoring/sentry'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { sendEmail } from '@/lib/email/resend'
import { invoiceValidatedEmail, invoiceRejectedEmail } from '@/lib/email/templates'
import { shouldSendEmail, getCompanyEmail } from '@/lib/email/should-send'
import { getTTNRejectionMessage } from '@/lib/ttn/rejection-messages'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  return Sentry.startSpan({ name: 'ttn.submit', op: 'ttn' }, async (span) => {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const invoiceId: string = body.invoiceId ?? body.invoice_id

    if (!invoiceId) return err('invoiceId requis', 400)

    const rlLimited = await applyRateLimit(rateLimiters.ttnSubmit, `${company.id}:${getClientIp(request)}`)
    if (rlLimited) return rlLimited

    span.setAttribute('invoice.id', invoiceId)

    // Fetch full invoice with relations
    const { data: invoice, error: fetchErr } = await (supabase as any)
      .from('invoices')
      .select('*, clients(*), invoice_line_items(*)')
      .eq('id', invoiceId)
      .eq('company_id', company.id)
      .single()

    if (fetchErr || !invoice) return err('Facture introuvable ou acces refuse', 404)

    const allowedStatuses = ['draft', 'validated', 'rejected', 'queued']
    if (!allowedStatuses.includes((invoice as any).status)) {
      return err(`Statut "${(invoice as any).status}" ne permet pas la soumission`, 409)
    }

    // Update to pending immediately
    await (supabase as any).from('invoices').update({
      status: 'pending',
      submitted_at: new Date().toISOString(),
    }).eq('id', invoiceId)

    // Try to load TTN modules (they may not be implemented yet)
    let getSigningStrategy: ((company: any) => Promise<any>) | null = null
    let buildTEIF: ((invoice: any, company: any, client: any) => Promise<string>) | null = null
    let submitToTTN: ((xml: string, signer: any, company: any) => Promise<{ ttnId: string; rawResponse: string }>) | null = null

    try {
      const mandateSigner = await import('@/lib/ttn/mandate-signer' as any)
      getSigningStrategy = mandateSigner.getSigningStrategy
      const teifBuilder = await import('@/lib/ttn/teif-builder' as any)
      buildTEIF = teifBuilder.buildTEIF
      const ttnGateway = await import('@/lib/ttn/ttn-gateway' as any)
      submitToTTN = ttnGateway.submitToTTN
    } catch {
      // TTN modules not yet implemented  queue for later
      const nextRetry = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      await (supabase as any).from('ttn_queue').upsert(
        { invoice_id: invoiceId, attempts: 0, max_attempts: 5, next_retry_at: nextRetry, last_error: 'TTN modules not implemented' },
        { onConflict: 'invoice_id' }
      )
      await (supabase as any).from('invoices').update({ status: 'queued' }).eq('id', invoiceId)
      return success({ success: true, status: 'queued', message: 'Facture mise en file d\'attente TTN' })
    }

    try {
      // Build TEIF XML
      const signer = await getSigningStrategy!(company)
      const xml = await buildTEIF!(invoice, company, (invoice as any).clients)
      const { ttnId, rawResponse } = await submitToTTN!(xml, signer, company)

      // TTN success
      await (supabase as any).from('invoices').update({
        status: 'valid',
        ttn_id: ttnId,
        validated_at: new Date().toISOString(),
        ttn_xml: xml,
        ttn_response: rawResponse,
        ttn_rejection_reason: null,
      }).eq('id', invoiceId)

      // Remove from queue if present
      await (supabase as any).from('ttn_queue').delete().eq('invoice_id', invoiceId)

      await insertNotification(supabase as any, company.id, 'invoice_validated',
        `Facture ${(invoice as any).number} validée par TTN`, `TTN_ID: ${ttnId}`)
      await logActivity(supabase as any, company.id, user.id,
        'invoice_validated', 'invoice', invoiceId,
        `Facture ${(invoice as any).number} validée — TTN_ID: ${ttnId}`)
      awardPoints(supabase as any, company.id, 'invoice_validated', `Facture ${(invoice as any).number} validée TTN`).catch(() => {})

      // Email notification
      if (await shouldSendEmail(supabase as any, company.id, 'invoice_validated_email')) {
        const email = await getCompanyEmail(supabase as any, company.id)
        if (email) await sendEmail({
          to: email,
          subject: `✓ Facture ${(invoice as any).number} validée par TTN`,
          html: invoiceValidatedEmail({
            companyName:   (company as any).name ?? '',
            invoiceNumber: (invoice as any).number,
            ttnId,
            totalTtc:      `${Number((invoice as any).ttc_amount ?? 0).toFixed(3)} TND`,
            invoiceUrl:    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/invoices/${invoiceId}`,
          }),
        })
      }

      return success({ success: true, status: 'valid', ttnId })

    } catch (ttnError: any) {
      const message = ttnError?.message ?? 'Erreur TTN inconnue'
      const isTimeout = message.toLowerCase().includes('timeout') || message.toLowerCase().includes('network')

      if (isTimeout) {
        // Network / timeout  queue with backoff
        const nextRetry = new Date(Date.now() + 15 * 60 * 1000).toISOString()
        await (supabase as any).from('invoices').update({ status: 'queued' }).eq('id', invoiceId)
        await (supabase as any).from('ttn_queue').upsert(
          { invoice_id: invoiceId, attempts: 1, max_attempts: 5, next_retry_at: nextRetry, last_error: message },
          { onConflict: 'invoice_id' }
        )
        captureError(ttnError, { action: 'ttn_submit', invoiceId, companyId: company.id, extra: { type: 'timeout' } })
        return success({ success: false, status: 'queued', error: message })
      } else {
        // TTN rejection — business rejection, not an exception
        const humanReason = getTTNRejectionMessage(message)
        captureMessage('TTN invoice rejected', 'warning', {
          invoiceId, invoiceNumber: (invoice as any).number,
          rejectionReason: message, companyId: company.id,
        })
        await (supabase as any).from('invoices').update({
          status: 'rejected',
          ttn_rejection_reason: humanReason,
        }).eq('id', invoiceId)

        await insertNotification(supabase as any, company.id, 'invoice_rejected',
          `Facture ${(invoice as any).number} rejetée par TTN`, humanReason)
        await logActivity(supabase as any, company.id, user.id,
          'invoice_rejected', 'invoice', invoiceId,
          `Facture ${(invoice as any).number} rejetée : ${humanReason}`)

        // Email notification
        if (await shouldSendEmail(supabase as any, company.id, 'invoice_rejected_email')) {
          const email = await getCompanyEmail(supabase as any, company.id)
          if (email) await sendEmail({
            to: email,
            subject: `✗ Facture ${(invoice as any).number} rejetée par TTN`,
            html: invoiceRejectedEmail({
              companyName:   (company as any).name ?? '',
              invoiceNumber: (invoice as any).number,
              rejectionReason: humanReason,
              invoiceUrl:    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/invoices/${invoiceId}`,
            }),
          })
        }

        return success({ success: false, status: 'rejected', error: humanReason }, 200)
      }
    }
  } catch (e: any) {
    captureError(e, { action: 'ttn_submit', companyId: undefined })
    return err(e.message, e.status ?? 500)
  }
  }) // end Sentry.startSpan
}
