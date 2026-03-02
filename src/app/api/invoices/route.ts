import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { calcInvoiceTotals } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'
import { nextInvoiceNumber } from '@/lib/utils/invoice-number'

const lineSchema = z.object({
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unit_price:  z.number().nonnegative(),
  tva_rate:    z.union([z.literal(0), z.literal(7), z.literal(13), z.literal(19)]),
})

const createSchema = z.object({
  client_id:        z.string().uuid().optional().nullable(),
  client_name:      z.string().optional().nullable(),
  client_matricule: z.string().optional().nullable(),
  source:           z.enum(['manual', 'ai', 'scan', 'recurring']).default('manual'),
  invoice_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:            z.string().optional().nullable(),
  status:           z.enum(['draft', 'queued']).default('draft'),
  lines:            z.array(lineSchema).min(1, 'Au moins une ligne requise'),
})

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const sp = new URL(request.url).searchParams
    const status    = sp.get('status')
    const clientId  = sp.get('client_id')
    const from      = sp.get('from')
    const to        = sp.get('to')
    const page      = Math.max(1, Number(sp.get('page') ?? 1))
    const limit     = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 25)))

    let q = (supabase as any)
      .from('invoices')
      .select('*, clients(id, name, type, matricule_fiscal)', { count: 'exact' })
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status)   q = q.eq('status', status)
    if (clientId) q = q.eq('client_id', clientId)
    if (from)     q = q.gte('issue_date', from)
    if (to)       q = q.lte('issue_date', to)

    const { data: invoices, count, error } = await q
    if (error) return err(error.message, 500)
    return success({ invoices, total: count, page, limit })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const { client_id, client_name, client_matricule, source, invoice_date, due_date, notes, status, lines } = parsed.data

    // Resolve client: use client_id if provided, else resolve by name (AI flow)
    let resolvedClientId = client_id ?? null

    if (!resolvedClientId && client_name?.trim()) {
      // Try to find existing client by name (case-insensitive)
      const { data: existingClient } = await (supabase as any)
        .from('clients')
        .select('id')
        .eq('company_id', company.id)
        .ilike('name', client_name.trim())
        .single()

      if (existingClient) {
        resolvedClientId = existingClient.id
      } else {
        // Auto-create client
        const { data: newClient, error: clientErr } = await (supabase as any)
          .from('clients')
          .insert({
            company_id:       company.id,
            name:             client_name.trim(),
            matricule_fiscal: client_matricule?.trim() ?? null,
            type:             client_matricule?.trim() ? 'B2B' : 'B2C',
          })
          .select('id')
          .single()

        if (clientErr || !newClient) return err('Impossible de créer le client', 500)
        resolvedClientId = newClient.id
      }
    }

    if (!resolvedClientId) return err('Client requis', 422)

    // ── Server-side quota enforcement ──
    const { data: sub } = await (supabase as any)
      .from('subscriptions')
      .select('status, trial_ends_at, invoices_used_this_month, invoices_reset_at, plan:plans(invoice_limit)')
      .eq('company_id', company.id)
      .single()

    if (sub) {
      const isExpired = sub.status === 'canceled' || sub.status === 'paused' ||
        (sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date())
      if (isExpired) return err('Votre abonnement est expiré. Choisissez un plan pour continuer.', 403)

      const invoiceLimit = sub.plan?.invoice_limit ?? null
      if (invoiceLimit !== null) {
        // Reset counter if new month
        const resetAt = sub.invoices_reset_at ? new Date(sub.invoices_reset_at) : null
        const isNewMonth = !resetAt || resetAt.getMonth() !== new Date().getMonth() ||
          resetAt.getFullYear() !== new Date().getFullYear()
        const used = isNewMonth ? 0 : (sub.invoices_used_this_month ?? 0)
        if (used >= invoiceLimit) {
          return err(`Limite mensuelle atteinte (${invoiceLimit} factures). Passez au plan Pro pour des factures illimitées.`, 403)
        }
      }
    }

    // Server-side totals calculation — never trust client
    const totals = calcInvoiceTotals(lines)

    // Atomic invoice number generation — no race condition under concurrency (FIX 1)
    const { data: invoiceNumber, error: counterErr } = await (supabase as any)
      .rpc('increment_invoice_counter', { p_company_id: company.id })
    if (counterErr || !invoiceNumber) throw new Error('Impossible de générer le numéro de facture')
    const number = invoiceNumber as string
    const totalInWords = amountToWords(totals.total_ttc)

    const { data: invoice, error: invErr } = await (supabase as any)
      .from('invoices')
      .insert({
        company_id: company.id,
        client_id:  resolvedClientId,
        number,
        issue_date: invoice_date,
        due_date:   due_date ?? null,
        notes:      notes ?? null,
        status,
        source:       source ?? 'manual',
        ht_amount:    totals.total_ht,
        tva_amount:   totals.total_tva,
        stamp_amount: totals.stamp_duty,
        ttc_amount:   totals.total_ttc,
        total_in_words: totalInWords,
        created_by: user.id,
      })
      .select('id, number').single()

    if (invErr) return err(invErr.message, 500)

    const lineItems = lines.map((l, idx) => ({
      invoice_id:  (invoice as any).id,
      sort_order:  idx,
      description: l.description,
      quantity:    l.quantity,
      unit_price:  l.unit_price,
      tva_rate:    l.tva_rate,
    }))

    const { error: lineErr } = await (supabase as any)
      .from('invoice_line_items').insert(lineItems)

    if (lineErr) return err(lineErr.message, 500)

    const actionLabel = source === 'ai' ? 'invoice.created_by_ai' : 'invoice_created'
    await logActivity(supabase as any, company.id, user.id, actionLabel, 'invoice', (invoice as any).id, `Facture ${(invoice as any).number} creee`)

    return success({ invoice: { ...invoice, ...totals, total_in_words: totalInWords } }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
