import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { sanitizeString } from '@/lib/utils/sanitize'

type Ctx = { params: Promise<{ id: string }> }

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/
const schema = z.object({
  name:             z.string().min(2).optional(),
  type:             z.enum(['B2B','B2C']).optional(),
  matricule_fiscal: z.string().optional().nullable(),
  address:          z.string().optional().nullable(),
  gouvernorat:      z.string().optional().nullable(),
  postal_code:      z.string().optional().nullable(),
  phone:            z.string().optional().nullable(),
  email:            z.string().email('Email invalide').optional().nullable().or(z.literal('')),
  bank_name:        z.string().optional().nullable(),
  bank_rib:         z.string().optional().nullable(),
}).superRefine((d, ctx) => {
  const mf = d.matricule_fiscal?.trim()
  if (d.type === 'B2B' && mf && mf !== 'PARTICULIER' && !MF_REGEX.test(mf)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Format MF invalide', path: ['matricule_fiscal'] })
  }
})

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(req)
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    // Verify ownership
    const { data: existing } = await (supabase as any)
      .from('clients').select('id, name').eq('id', id).eq('company_id', company.id).single()
    if (!existing) return err('Client introuvable ou acces refuse', 404)

    const d = parsed.data
    const { error } = await (supabase as any)
      .from('clients')
      .update({
        ...(d.name             !== undefined && { name:             sanitizeString(d.name, 200) }),
        ...(d.type             !== undefined && { type:             d.type }),
        ...(d.matricule_fiscal !== undefined && { matricule_fiscal: d.matricule_fiscal ? sanitizeString(d.matricule_fiscal, 50) : null }),
        ...(d.address          !== undefined && { address:          d.address ? sanitizeString(d.address, 300) : null }),
        ...(d.gouvernorat      !== undefined && { gouvernorat:      d.gouvernorat ? sanitizeString(d.gouvernorat, 100) : null }),
        ...(d.postal_code      !== undefined && { postal_code:      d.postal_code ? sanitizeString(d.postal_code, 20) : null }),
        ...(d.phone            !== undefined && { phone:            d.phone ? sanitizeString(d.phone, 30) : null }),
        ...(d.email            !== undefined && { email:            d.email ? sanitizeString(d.email, 200) : null }),
        ...(d.bank_name        !== undefined && { bank_name:        d.bank_name ? sanitizeString(d.bank_name, 100) : null }),
        ...(d.bank_rib         !== undefined && { bank_rib:         d.bank_rib ? sanitizeString(d.bank_rib, 50) : null }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return err(error.message, 500)
    await logActivity(supabase as any, company.id, user.id, 'client_updated', 'client', id, `Client ${(existing as any).name} modifié`)
    return success({ message: 'Client mis à jour' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(req)

    const { data: existing } = await (supabase as any)
      .from('clients').select('id, name').eq('id', id).eq('company_id', company.id).single()
    if (!existing) return err('Client introuvable ou acces refuse', 404)

    // Check for existing invoices
    const { count } = await (supabase as any)
      .from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', id)

    if ((count ?? 0) > 0) {
      return err(`Ce client a ${count} facture(s). Supprimez-les d'abord ou dissociez-les.`, 409)
    }

    const { error } = await (supabase as any).from('clients').delete().eq('id', id)
    if (error) return err(error.message, 500)
    await logActivity(supabase as any, company.id, user.id, 'client_deleted', 'client', id, `Client ${(existing as any).name} supprimé`)
    return success({ message: 'Client supprimé' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
