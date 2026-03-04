import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { err, getAuthenticatedCompany } from '@/lib/api-helpers'
import { ClientStatementPDF } from '@/components/invoice/ClientStatementPDF'
import { captureError } from '@/lib/monitoring/sentry'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id: clientId } = await params
    const { company, supabase } = await getAuthenticatedCompany()

    // Verify client belongs to company
    const { data: client, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('id, name, matricule_fiscal, email, phone, address')
      .eq('id', clientId)
      .eq('company_id', company.id)
      .single()

    if (clientErr || !client) return err('Client introuvable', 404)

    // Fetch all non-deleted invoices for this client
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to   = url.searchParams.get('to')

    let query = (supabase as any)
      .from('invoices')
      .select('number, issue_date, due_date, ht_amount, tva_amount, ttc_amount, payment_status, status')
      .eq('company_id', company.id)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .in('status', ['draft', 'validated', 'valid', 'rejected', 'pending', 'queued'])
      .order('issue_date', { ascending: true })

    if (from) query = query.gte('issue_date', from)
    if (to)   query = query.lte('issue_date', to)

    const { data: invoices, error: invErr } = await query
    if (invErr) return err('Erreur récupération factures', 500)

    const c = company as any
    const companyData = {
      name:               c.name ?? '',
      matricule_fiscal:   c.matricule_fiscal ?? undefined,
      address:            c.address ?? undefined,
      phone:              c.phone ?? undefined,
      email:              c.email ?? undefined,
    }

    const clientData = {
      name:               (client as any).name ?? '',
      matricule_fiscal:   (client as any).matricule_fiscal ?? undefined,
      email:              (client as any).email ?? undefined,
      phone:              (client as any).phone ?? undefined,
      address:            (client as any).address ?? undefined,
    }

    const periodLabel = from && to
      ? `Période: ${new Date(from).toLocaleDateString('fr-FR')} – ${new Date(to).toLocaleDateString('fr-FR')}`
      : 'Toutes les factures'

    const generatedAt = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const element = React.createElement(ClientStatementPDF, {
      company:     companyData,
      client:      clientData,
      invoices:    (invoices ?? []) as any[],
      generatedAt,
      periodLabel,
    })

    const buffer = await renderToBuffer(element as any)

    const safeClientName = ((client as any).name ?? 'client').replace(/[^a-zA-Z0-9-_]/g, '_')

    return new Response(Buffer.from(buffer) as any, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="releve_${safeClientName}_${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (e) {
    captureError(e)
    return err('Erreur génération relevé', 500)
  }
}
