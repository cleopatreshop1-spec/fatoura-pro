import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { sanitizeString } from '@/lib/utils/sanitize'

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/
const clientSchema = z.object({
  name:             z.string().min(2, 'Nom requis'),
  type:             z.enum(['B2B','B2C']).default('B2B'),
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
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Format MF invalide: 1234567A/A/M/000', path: ['matricule_fiscal'] })
  }
})

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const sp  = new URL(request.url).searchParams
    const q   = sp.get('q')
    const type = sp.get('type')

    let query = (supabase as any)
      .from('clients').select('*')
      .eq('company_id', company.id).order('name')

    if (type) query = query.eq('type', type)
    if (q) query = query.or(`name.ilike.%${q}%,matricule_fiscal.ilike.%${q}%,email.ilike.%${q}%`)

    const { data, error } = await query
    if (error) return err(error.message, 500)
    return success({ clients: data })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const parsed = clientSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Validation', 422)

    const d = parsed.data
    const { data, error } = await (supabase as any)
      .from('clients')
      .insert({
        company_id:       company.id,
        name:             sanitizeString(d.name, 200),
        type:             d.type,
        matricule_fiscal: d.matricule_fiscal ? sanitizeString(d.matricule_fiscal, 50) : null,
        address:          d.address          ? sanitizeString(d.address, 300)          : null,
        gouvernorat:      d.gouvernorat      ? sanitizeString(d.gouvernorat, 100)      : null,
        postal_code:      d.postal_code      ? sanitizeString(d.postal_code, 20)       : null,
        phone:            d.phone            ? sanitizeString(d.phone, 30)             : null,
        email:            d.email            ? sanitizeString(d.email, 200)            : null,
        bank_name:        d.bank_name        ? sanitizeString(d.bank_name, 100)        : null,
        bank_rib:         d.bank_rib         ? sanitizeString(d.bank_rib, 50)          : null,
      })
      .select('id, name').single()

    if (error) return err(error.message, 500)

    await logActivity(supabase as any, company.id, user.id, 'client_created', 'client', (data as any).id, `Client ${(data as any).name} ajoute`)
    return success({ client: data }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
