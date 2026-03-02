import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertNotification, logActivity } from '@/lib/api-helpers'
import { captureError, captureMessage } from '@/lib/monitoring/sentry'
import { getSigningStrategy } from '@/lib/ttn/mandate-signer'
import { buildTEIF } from '@/lib/teif/teif-builder'
import { submitToTTN } from '@/lib/ttn/ttn-gateway'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = request.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: queue } = await (supabase as any)
    .from('ttn_queue')
    .select('*, invoices(*, clients(*), invoice_line_items(*), companies(*))')
    .lte('next_retry_at', now)
    .lt('attempts', 5)
    .limit(10)

  if (!queue?.length) return Response.json({ processed: 0, succeeded: 0, failed: 0 })

  let succeeded = 0; let failed = 0; let maxRetriesReached = 0

  for (const item of queue) {
    const inv     = (item as any).invoices
    const company = inv?.companies

    try {
      // 1. Build TEIF XML
      const xml = buildTEIF(inv, company, inv?.clients)

      // 2. Get signing strategy (mandate or own cert) and sign
      const strategy = await getSigningStrategy(company)
      const { signedXml } = await strategy.sign(xml)

      // 3. Submit to TTN
      const { ttnId, rawResponse, reference } = await submitToTTN(signedXml, strategy, company)

      // 4. Update invoice
      await (supabase as any).from('invoices').update({
        status:       'valid',
        ttn_id:       ttnId,
        ttn_reference: reference ?? ttnId,
        ttn_signed_at: now,
        validated_at:  now,
        ttn_xml:       signedXml,
        ttn_response:  rawResponse,
        ttn_rejection_reason: null,
      }).eq('id', item.invoice_id)

      // 5. Log to ttn_submissions audit table
      await (supabase as any).from('ttn_submissions').insert({
        invoice_id:   item.invoice_id,
        company_id:   company?.id,
        ttn_reference: reference ?? ttnId,
        ttn_status:   'accepted',
        ttn_response:  { raw: rawResponse },
        signed_xml:    signedXml,
        signing_mode:  strategy.mode,
      })

      // 6. Clean up queue entry
      await (supabase as any).from('ttn_queue').delete().eq('id', item.id)

      await insertNotification(supabase as any, company.id, 'invoice_validated',
        `Facture ${inv?.number} validée par TTN`, `TTN_ID: ${ttnId}`)
      await logActivity(supabase as any, company.id, company.owner_id ?? '',
        'invoice_validated', 'invoice', item.invoice_id,
        `Validée via queue — TTN_ID: ${ttnId} — mode: ${strategy.mode}`)

      succeeded++
    } catch (e: any) {
      const attempts  = (item.attempts ?? 0) + 1
      const backoffMs = Math.min(Math.pow(2, attempts) * 15 * 60 * 1000, 24 * 3600 * 1000)
      const nextRetry = new Date(Date.now() + backoffMs).toISOString()

      await (supabase as any).from('ttn_queue').update({
        attempts,
        last_error:    e?.message ?? 'Unknown',
        next_retry_at: nextRetry,
      }).eq('id', item.id)

      // Log failed attempt to ttn_submissions
      await (supabase as any).from('ttn_submissions').insert({
        invoice_id:    item.invoice_id,
        company_id:    company?.id,
        ttn_status:    'rejected',
        error_message: e?.message ?? 'Unknown',
        retry_count:   attempts,
      }).catch(() => {})

      if (attempts >= 5) {
        await (supabase as any).from('invoices').update({
          status: 'rejected',
          ttn_rejection_reason: e?.message,
        }).eq('id', item.invoice_id)
        await (supabase as any).from('ttn_queue').delete().eq('id', item.id)
        await insertNotification(supabase as any, company?.id, 'invoice_rejected',
          `Facture ${inv?.number} rejetée après 5 tentatives`, e?.message)
        captureMessage('Invoice permanently failed TTN submission', 'error', {
          invoiceId: item.invoice_id, attempts: item.attempts, lastError: e?.message,
        })
        maxRetriesReached++
      } else {
        captureError(e, { action: 'ttn_queue_process', invoiceId: item.invoice_id, extra: { attempt: attempts } })
      }

      failed++
    }
  }

  captureMessage('TTN queue processed', 'info', { total: queue.length, succeeded, failed, maxRetriesReached })

  return Response.json({ processed: queue.length, succeeded, failed, maxRetriesReached })
}
