import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

const schema = z.object({
  requested_amount: z.number().positive(),
  duration_months:  z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
})

export async function POST(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const { requested_amount, duration_months } = parsed.data

    const { data: existing } = await (supabase as any)
      .from('waitlist')
      .select('id')
      .eq('company_id', company.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) return err('Une demande est déjà en cours de traitement', 409)

    const { error } = await (supabase as any).from('waitlist').insert({
      company_id: company.id,
      requested_amount,
      duration_months,
    })

    if (error) return err(error.message, 500)

    return success({ success: true }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
