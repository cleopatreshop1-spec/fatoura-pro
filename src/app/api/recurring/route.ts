import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

const lineSchema = z.object({
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unit_price:  z.number().nonnegative(),
  tva_rate:    z.union([z.literal(0), z.literal(7), z.literal(13), z.literal(19)]),
})

const createSchema = z.object({
  name:      z.string().min(1),
  client_id: z.string().uuid().optional().nullable(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  next_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:     z.string().optional().nullable(),
  lines:     z.array(lineSchema).min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const { data, error } = await (supabase as any)
      .from('recurring_invoices')
      .select('*, clients(id, name), recurring_invoice_lines(*)')
      .eq('company_id', company.id)
      .order('next_date', { ascending: true })
    if (error) return err(error.message, 500)
    return success({ recurring: data ?? [] })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function POST(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const { name, client_id, frequency, next_date, notes, lines } = parsed.data

    const { data: rec, error: recErr } = await (supabase as any)
      .from('recurring_invoices')
      .insert({ company_id: company.id, client_id: client_id ?? null, name, frequency, next_date, notes: notes ?? null })
      .select('id')
      .single()

    if (recErr) return err(recErr.message, 500)

    const { error: lineErr } = await (supabase as any)
      .from('recurring_invoice_lines')
      .insert(lines.map((l, i) => ({
        recurring_invoice_id: (rec as any).id,
        sort_order:  i,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tva_rate:    l.tva_rate,
      })))

    if (lineErr) return err(lineErr.message, 500)
    return success({ id: (rec as any).id }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
