import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { err, getAuthenticatedCompany } from '@/lib/api-helpers'
import { ClientStatementPDF } from '@/components/invoice/ClientStatementPDF'
import { sendEmail } from '@/lib/email/resend'
import { fmtTND } from '@/lib/utils/tva-calculator'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id: clientId } = await params
    const { email: toEmail, clientName: displayName } = await req.json()
    if (!toEmail) return err('Email requis', 400)

    const { company, supabase } = await getAuthenticatedCompany()

    const { data: client, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('id, name, matricule_fiscal, email, phone, address')
      .eq('id', clientId)
      .eq('company_id', company.id)
      .single()

    if (clientErr || !client) return err('Client introuvable', 404)

    const { data: invoices } = await (supabase as any)
      .from('invoices')
      .select('id, number, issue_date, due_date, ttc_amount, ht_amount, tva_amount, status, payment_status, paid_at')
      .eq('client_id', clientId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })

    const invs      = (invoices ?? []) as any[]
    const unpaidInvs = invs.filter((i: any) => i.payment_status !== 'paid' && i.status !== 'draft')
    const totalUnpaid = unpaidInvs.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
    const totalCA     = invs.filter((i: any) => i.status !== 'draft').reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)

    const todayLabel = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const pdfBuffer = await renderToBuffer(
      React.createElement(ClientStatementPDF, {
        company: company as any,
        client:  client  as any,
        invoices: invs   as any,
        generatedAt: new Date().toISOString(),
        periodLabel: `Relevé au ${todayLabel}`,
      }) as any
    )

    const clientDisplayName = displayName ?? client.name ?? 'Client'
    const companyName = (company as any).name ?? 'Votre fournisseur'
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    await sendEmail({
      to:      toEmail,
      subject: `Relevé de compte — ${companyName} — ${dateStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
          <p>Bonjour${clientDisplayName ? ' ' + clientDisplayName : ''},</p>
          <p>Veuillez trouver ci-joint votre relevé de compte au <strong>${dateStr}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:6px 0;color:#555">CA total</td><td style="padding:6px 0;text-align:right;font-weight:bold">${fmtTND(totalCA)} TND</td></tr>
            <tr><td style="padding:6px 0;color:#555">Solde dû</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:${totalUnpaid > 0 ? '#d97706' : '#16a34a'}">${fmtTND(totalUnpaid)} TND</td></tr>
            <tr><td style="padding:6px 0;color:#555">Factures impayées</td><td style="padding:6px 0;text-align:right">${unpaidInvs.length}</td></tr>
          </table>
          <p style="font-size:13px;color:#666">Pour toute question, n'hésitez pas à nous contacter.</p>
          <p style="font-size:13px;color:#666">Cordialement,<br/><strong>${companyName}</strong></p>
        </div>
      `,
      attachments: [{
        filename: `releve_${(client.name ?? 'client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        content:  Buffer.from(pdfBuffer),
      }],
    })

    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[statement/email]', e)
    return err(e.message ?? 'Erreur serveur', 500)
  }
}
