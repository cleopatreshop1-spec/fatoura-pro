import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { user, company, supabase } = await getAuthenticatedCompany(req)

    const { data: key } = await (supabase as any)
      .from('api_keys').select('id, name').eq('id', id).eq('company_id', company.id).single()
    if (!key) return err('Cle introuvable ou acces refuse', 404)

    const { error } = await (supabase as any)
      .from('api_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) return err(error.message, 500)

    await logActivity(supabase as any, company.id, user.id, 'api_key_revoked', 'api_key', id, `Cle API "${(key as any).name}" revoquee`)
    return success({ message: 'Cle revoquee' })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
