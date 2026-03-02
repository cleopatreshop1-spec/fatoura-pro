import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

const updateSchema = z.object({
  invoice_validated_email: z.boolean().optional(),
  invoice_rejected_email:  z.boolean().optional(),
  mandate_expiring_email:  z.boolean().optional(),
  cert_expiring_email:     z.boolean().optional(),
  monthly_tva_email:       z.boolean().optional(),
  weekly_report_email:     z.boolean().optional(),
  notification_email:      z.string().email().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .select('*')
      .eq('company_id', company.id)
      .maybeSingle()
    if (error) return err(error.message, 500)
    return success({ preferences: data })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function PUT(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const { error } = await (supabase as any)
      .from('notification_preferences')
      .upsert({ company_id: company.id, ...parsed.data, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' })
    if (error) return err(error.message, 500)
    return success({ success: true })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
