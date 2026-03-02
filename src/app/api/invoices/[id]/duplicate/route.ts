import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { calcInvoiceTotals } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'
import { format, addDays, differenceInDays, parseISO } from 'date-fns'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(request)

    const { data: original, error: fetchErr } = await (supabase as any)
      .from('invoices')
      .select('*, invoice_line_items(description, quantity, unit_price, tva_rate, sort_order)')
      .eq('id', id)
      .eq('company_id', company.id)
      .single()

    if (fetchErr || !original) return err('Facture introuvable ou accès refusé', 404)

    const orig = original as any
    const today = new Date()

    // Preserve due-date delta from original
    const originalDelta = orig.due_date && orig.issue_date
      ? differenceInDays(parseISO(orig.due_date), parseISO(orig.issue_date))
      : null

    const newIssueDate = format(today, 'yyyy-MM-dd')
    const newDueDate   = originalDelta !== null
      ? format(addDays(today, originalDelta), 'yyyy-MM-dd')
      : null

    // Atomic invoice number
    const { data: invoiceNumber, error: counterErr } = await (supabase as any)
      .rpc('increment_invoice_counter', { p_company_id: company.id })
    if (counterErr || !invoiceNumber) throw new Error('Impossible de générer le numéro de facture')

    const lines = ((orig.invoice_line_items ?? []) as any[])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const totals = calcInvoiceTotals(
      lines.map((l: any) => ({
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        tva_rate: Number(l.tva_rate),
      }))
    )

    const { data: newInvoice, error: invErr } = await (supabase as any)
      .from('invoices')
      .insert({
        company_id:     company.id,
        client_id:      orig.client_id ?? null,
        number:         invoiceNumber,
        status:         'draft',
        issue_date:     newIssueDate,
        due_date:       newDueDate,
        notes:          orig.notes ?? null,
        ht_amount:      totals.total_ht,
        tva_amount:     totals.total_tva,
        stamp_amount:   totals.stamp_duty,
        ttc_amount:     totals.total_ttc,
        total_in_words: amountToWords(totals.total_ttc),
        created_by:     user.id,
        payment_status: 'unpaid',
      })
      .select('id, number')
      .single()

    if (invErr) return err(invErr.message, 500)

    if (lines.length > 0) {
      await (supabase as any).from('invoice_line_items').insert(
        lines.map((l: any, idx: number) => ({
          invoice_id:  (newInvoice as any).id,
          sort_order:  idx,
          description: l.description,
          quantity:    Number(l.quantity),
          unit_price:  Number(l.unit_price),
          tva_rate:    Number(l.tva_rate),
        }))
      )
    }

    await logActivity(supabase as any, company.id, user.id, 'invoice_created', 'invoice',
      (newInvoice as any).id, `Facture dupliquée depuis ${orig.number} → ${(newInvoice as any).number}`)

    return success({
      invoice: { id: (newInvoice as any).id, number: (newInvoice as any).number },
      message: 'Brouillon créé avec la date d\'aujourd\'hui',
    }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
