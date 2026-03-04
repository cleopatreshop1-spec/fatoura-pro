import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { calcInvoiceTotals } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'
import { format, addDays, addMonths, addQuarters, addYears } from 'date-fns'
import { invalidateUserContext } from '@/lib/ai/context-builder'

type Ctx = { params: Promise<{ id: string }> }

function nextOccurrence(frequency: string, from: Date): string {
  switch (frequency) {
    case 'weekly':    return format(addDays(from, 7), 'yyyy-MM-dd')
    case 'monthly':   return format(addMonths(from, 1), 'yyyy-MM-dd')
    case 'quarterly': return format(addQuarters(from, 1), 'yyyy-MM-dd')
    case 'yearly':    return format(addYears(from, 1), 'yyyy-MM-dd')
    default:          return format(addMonths(from, 1), 'yyyy-MM-dd')
  }
}

/** PATCH /api/recurring/[id] — toggle is_active */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const { is_active } = body as { is_active?: boolean }
    if (typeof is_active !== 'boolean') return err('is_active requis', 400)

    const { error } = await (supabase as any)
      .from('recurring_invoices')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', company.id)

    if (error) return err(error.message, 500)
    return success({ ok: true })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

/** DELETE /api/recurring/[id] — remove template */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(request)

    const { error } = await (supabase as any)
      .from('recurring_invoices')
      .delete()
      .eq('id', id)
      .eq('company_id', company.id)

    if (error) return err(error.message, 500)
    return success({ ok: true })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

/** POST /api/recurring/[id]/generate — generate invoice now from template */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(request)

    const { data: template, error: tErr } = await (supabase as any)
      .from('recurring_invoices')
      .select('*, recurring_invoice_lines(*)')
      .eq('id', id)
      .eq('company_id', company.id)
      .single()

    if (tErr || !template) return err('Modèle récurrent introuvable', 404)

    const t = template as any
    const lines = ((t.recurring_invoice_lines ?? []) as any[])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    if (!lines.length) return err('Le modèle ne contient aucune ligne', 400)

    const totals = calcInvoiceTotals(lines.map((l: any) => ({
      quantity:   Number(l.quantity),
      unit_price: Number(l.unit_price),
      tva_rate:   Number(l.tva_rate),
    })))

    const { data: invoiceNumber, error: counterErr } = await (supabase as any)
      .rpc('increment_invoice_counter', { p_company_id: company.id })
    if (counterErr || !invoiceNumber) throw new Error('Impossible de générer le numéro de facture')

    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: invoice, error: invErr } = await (supabase as any)
      .from('invoices')
      .insert({
        company_id:     company.id,
        client_id:      t.client_id ?? null,
        number:         invoiceNumber,
        issue_date:     today,
        status:         'draft',
        notes:          t.notes ?? null,
        ht_amount:      totals.total_ht,
        tva_amount:     totals.total_tva,
        stamp_amount:   totals.stamp_duty,
        ttc_amount:     totals.total_ttc,
        total_in_words: amountToWords(totals.total_ttc),
        source:         'recurring',
        created_by:     user.id,
      })
      .select('id, number')
      .single()

    if (invErr) return err(invErr.message, 500)

    await (supabase as any).from('invoice_line_items').insert(
      lines.map((l: any, idx: number) => ({
        invoice_id:  (invoice as any).id,
        sort_order:  idx,
        description: l.description,
        quantity:    Number(l.quantity),
        unit_price:  Number(l.unit_price),
        tva_rate:    Number(l.tva_rate),
      }))
    )

    // Advance next_date
    const newNextDate = nextOccurrence(t.frequency, new Date(t.next_date))
    await (supabase as any)
      .from('recurring_invoices')
      .update({ next_date: newNextDate, last_generated: today, updated_at: new Date().toISOString() })
      .eq('id', id)

    await logActivity(supabase as any, company.id, user.id, 'invoice.created_recurring', 'invoice',
      (invoice as any).id, `Facture récurrente générée: ${(invoice as any).number}`)

    invalidateUserContext(company.id)

    return success({
      invoice: { id: (invoice as any).id, number: (invoice as any).number },
      next_date: newNextDate,
    }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
