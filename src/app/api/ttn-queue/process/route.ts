import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertNotification, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = request.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: queue } = await (supabase as any)
    .from('ttn_queue').select('*, invoices(*, clients(*), companies(*))')
    .lte('next_retry_at', now).lt('attempts', 5).limit(10)

  if (!queue?.length) return Response.json({ processed: 0, succeeded: 0, failed: 0 })

  let succeeded = 0; let failed = 0

  for (const item of queue) {
    const inv     = (item as any).invoices
    const company = inv?.companies

    let getSigningStrategy: any = null
    let buildTEIF:          any = null
    let submitToTTN:        any = null
    try {
      const ms = await import('@/lib/ttn/mandate-signer' as any); getSigningStrategy = ms.getSigningStrategy
      const tb = await import('@/lib/ttn/teif-builder'    as any); buildTEIF          = tb.buildTEIF
      const gw = await import('@/lib/ttn/ttn-gateway'     as any); submitToTTN        = gw.submitToTTN
    } catch { /* TTN not yet implemented */ }

    try {
      if (!getSigningStrategy || !buildTEIF || !submitToTTN) throw new Error('TTN modules not available')
      const signer = await getSigningStrategy(company)
      const xml    = await buildTEIF(inv, company, inv?.clients)
      const { ttnId, rawResponse } = await submitToTTN(xml, signer, company)

      await (supabase as any).from('invoices').update({
        status: 'valid', ttn_id: ttnId,
        validated_at: now, ttn_xml: xml, ttn_response: rawResponse,
      }).eq('id', item.invoice_id)
      await (supabase as any).from('ttn_queue').delete().eq('id', item.id)
      await insertNotification(supabase as any, company.id, 'invoice_validated',
        `Facture ${inv?.number} validee`, `TTN_ID: ${ttnId}`)
      await logActivity(supabase as any, company.id, company.owner_id ?? '',
        'invoice_validated', 'invoice', item.invoice_id, `Valide via queue  ${ttnId}`)
      succeeded++
    } catch (e: any) {
      const attempts = (item.attempts ?? 0) + 1
      const backoffMs = Math.min(Math.pow(2, attempts) * 15 * 60 * 1000, 24 * 3600 * 1000)
      const nextRetry = new Date(Date.now() + backoffMs).toISOString()
      await (supabase as any).from('ttn_queue').update({
        attempts, last_error: e?.message ?? 'Unknown', next_retry_at: nextRetry,
      }).eq('id', item.id)
      if (attempts >= 5) {
        await (supabase as any).from('invoices').update({
          status: 'rejected', ttn_rejection_reason: e?.message,
        }).eq('id', item.invoice_id)
        await (supabase as any).from('ttn_queue').delete().eq('id', item.id)
        await insertNotification(supabase as any, company?.id, 'invoice_rejected',
          `Facture ${inv?.number} rejetee apres 5 tentatives`, e?.message)
      }
      failed++
    }
  }

  return Response.json({ processed: queue.length, succeeded, failed })
}
