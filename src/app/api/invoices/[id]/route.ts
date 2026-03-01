import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { calcInvoiceTotals } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'

type Ctx = { params: Promise<{ id: string }> }

async function getOwnedInvoice(supabase: any, invoiceId: string, companyId: string) {
  const { data, error } = await supabase
    .from('invoices').select('*').eq('id', invoiceId).eq('company_id', companyId).single()
  if (error || !data) throw Object.assign(new Error('Facture introuvable ou acces refuse'), { status: 404 })
  return data as any
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(req)
    const { data, error } = await (supabase as any)
      .from('invoices')
      .select('*, clients(*), companies(*), invoice_line_items(*)')
      .eq('id', id).eq('company_id', company.id).single()
    if (error || !data) return err('Facture introuvable', 404)
    return success({ invoice: data })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

const lineSchema = z.object({
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unit_price:  z.number().nonnegative(),
  tva_rate:    z.union([z.literal(0),z.literal(7),z.literal(13),z.literal(19)]),
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(req)
    const invoice = await getOwnedInvoice(supabase as any, id, company.id)

    if (invoice.status !== 'draft') return err('Seules les factures brouillon sont modifiables', 409)

    const body = await req.json()
    const { client_id, invoice_date, due_date, notes, lines } = body

    if (!lines?.length) return err('Au moins une ligne requise', 422)
    const parsed = z.array(lineSchema).safeParse(lines)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Lignes invalides', 422)

    const totals = calcInvoiceTotals(parsed.data)
    const totalInWords = amountToWords(totals.total_ttc)

    const { error: upErr } = await (supabase as any).from('invoices').update({
      client_id: client_id ?? null,
      issue_date: invoice_date ?? invoice.issue_date,
      due_date: due_date ?? null,
      notes: notes ?? null,
      ht_amount: totals.total_ht, tva_amount: totals.total_tva,
      stamp_amount: totals.stamp_duty, ttc_amount: totals.total_ttc,
      total_in_words: totalInWords,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (upErr) return err(upErr.message, 500)

    // Reinsert line items
    await (supabase as any).from('invoice_line_items').delete().eq('invoice_id', id)
    await (supabase as any).from('invoice_line_items').insert(
      parsed.data.map((l, idx) => ({
        invoice_id: id, sort_order: idx,
        description: l.description, quantity: l.quantity,
        unit_price: l.unit_price, tva_rate: l.tva_rate,
      }))
    )

    await logActivity(supabase as any, company.id, user.id, 'invoice_updated', 'invoice', id, `Facture ${invoice.number} modifiee`)
    return success({ message: 'Facture mise a jour', totals, total_in_words: totalInWords })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(req)
    const invoice = await getOwnedInvoice(supabase as any, id, company.id)

    if (invoice.status !== 'draft') return err('Seules les factures brouillon peuvent etre supprimees', 409)

    await (supabase as any).from('invoice_line_items').delete().eq('invoice_id', id)
    const { error } = await (supabase as any).from('invoices').delete().eq('id', id)
    if (error) return err(error.message, 500)

    await logActivity(supabase as any, company.id, user.id, 'invoice_deleted', 'invoice', id, `Facture ${invoice.number} supprimee`)
    return success({ message: 'Facture supprimee' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
