import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(req)

    const { data: inv } = await (supabase as any)
      .from('invoices')
      .select('id, share_token')
      .eq('id', id)
      .eq('company_id', company.id)
      .single()

    if (!inv) return err('Facture introuvable', 404)

    if (inv.share_token) {
      return success({ token: inv.share_token })
    }

    const token = crypto.randomUUID()
    await (supabase as any)
      .from('invoices')
      .update({ share_token: token })
      .eq('id', id)

    return success({ token })
  } catch (e: any) {
    return err(e.message, e.status ?? 500)
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { company, supabase } = await getAuthenticatedCompany(req)

    await (supabase as any)
      .from('invoices')
      .update({ share_token: null })
      .eq('id', id)
      .eq('company_id', company.id)

    return success({ message: 'Lien supprimé' })
  } catch (e: any) {
    return err(e.message, e.status ?? 500)
  }
}
