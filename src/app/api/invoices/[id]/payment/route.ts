import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'

const schema = z.object({
  payment_status: z.enum(['unpaid', 'partial', 'paid']),
  payment_date:   z.string().optional().nullable(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const { data: invoice } = await (supabase as any)
      .from('invoices').select('id, number, company_id').eq('id', id).single()
    if (!invoice || (invoice as any).company_id !== company.id)
      return err('Facture introuvable ou accès refusé', 404)

    let { payment_status, payment_date } = parsed.data
    if (payment_status === 'paid' && !payment_date)
      payment_date = new Date().toISOString().slice(0, 10)
    if (payment_status === 'unpaid') payment_date = null

    await (supabase as any).from('invoices').update({
      payment_status, payment_date, updated_at: new Date().toISOString(),
    }).eq('id', id)

    await logActivity(supabase as any, company.id, user.id, 'invoice_payment_updated',
      'invoice', id, `Statut paiement: ${payment_status}`)

    return success({ success: true, payment_status, payment_date })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
