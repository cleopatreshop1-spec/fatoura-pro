import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  if (!token || token.length < 10) {
    return Response.json({ error: 'Lien invalide' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('invoices')
    .select(`
      id, number, status, issue_date, due_date,
      ht_amount, tva_amount, stamp_amount, ttc_amount,
      total_in_words, notes, payment_status,
      clients(name, address, matricule_fiscal, email, phone),
      companies(name, address, matricule_fiscal, phone, email, logo_url, bank_name, bank_rib, invoice_prefix),
      invoice_line_items(id, sort_order, description, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc)
    `)
    .eq('share_token', token)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  return Response.json({ invoice: data })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const supabase = await createClient()

  const { data: inv } = await (supabase as any)
    .from('invoices')
    .select('id, payment_status, status')
    .eq('share_token', token)
    .is('deleted_at', null)
    .single()

  if (!inv) return Response.json({ error: 'Facture introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as string | undefined

  if (action === 'confirm_receipt') {
    await (supabase as any)
      .from('invoices')
      .update({ client_confirmed_at: new Date().toISOString() })
      .eq('id', inv.id)
    return Response.json({ success: true, message: 'Réception confirmée' })
  }

  return Response.json({ error: 'Action inconnue' }, { status: 400 })
}
