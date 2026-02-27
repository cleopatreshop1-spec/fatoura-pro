import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { err } from '@/lib/api-helpers'
import { InvoicePDFTemplate } from '@/components/invoice/InvoicePDFTemplate'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return err('Non authentifie', 401)

    // Get company for ownership check
    const { data: company } = await (supabase as any)
      .from('companies').select('*').eq('owner_id', user.id).limit(1).single()
    if (!company) return err('Societe introuvable', 404)

    // Fetch full invoice
    const { data: invoice, error: invErr } = await (supabase as any)
      .from('invoices')
      .select('*, clients(*), invoice_line_items(*)')
      .eq('id', id)
      .eq('company_id', (company as any).id)
      .single()

    if (invErr || !invoice) return err('Facture introuvable ou acces refuse', 404)

    const inv   = invoice as any
    const cl    = inv.clients as any
    const lines = ((inv.invoice_line_items ?? []) as any[])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // Generate QR code if validated
    let qrDataUrl: string | null = null
    if (inv.status === 'valid' && inv.ttn_id) {
      try {
        qrDataUrl = await QRCode.toDataURL(inv.ttn_id, {
          width: 120, margin: 1, color: { dark: '#0f1017', light: '#ffffff' },
        })
      } catch {}
    }

    // Build the PDF using react-pdf
    const element = React.createElement(InvoicePDFTemplate, {
      invoice: {
        id: inv.id, number: inv.number, status: inv.status,
        issue_date: inv.issue_date, due_date: inv.due_date,
        ht_amount: inv.ht_amount, tva_amount: inv.tva_amount,
        ttc_amount: inv.ttc_amount,
        total_in_words: inv.total_in_words ?? null,
        notes: inv.notes ?? null,
        ttn_id: inv.ttn_id ?? null,
      },
      company: {
        name:                  (company as any).name ?? '',
        matricule_fiscal:      (company as any).matricule_fiscal ?? null,
        address:               (company as any).address ?? null,
        phone:                 (company as any).phone ?? null,
        email:                 (company as any).email ?? null,
        website:               (company as any).website ?? null,
        bank_name:             (company as any).bank_name ?? null,
        bank_rib:              (company as any).bank_rib ?? null,
        logo_url:              (company as any).logo_url ?? null,
        default_payment_terms: (company as any).default_payment_terms ?? null,
        tva_regime:            (company as any).tva_regime ?? null,
      },
      client: cl ? {
        name: cl.name, matricule_fiscal: cl.matricule_fiscal ?? null,
        address: cl.address ?? null, phone: cl.phone ?? null,
        email: cl.email ?? null, type: cl.type ?? 'B2B',
      } : null,
      lines: lines.map((l: any) => ({
        description: l.description, quantity: Number(l.quantity),
        unit_price: Number(l.unit_price), tva_rate: Number(l.tva_rate),
        line_ht: Number(l.line_ht ?? 0), line_tva: Number(l.line_tva ?? 0),
        line_ttc: Number(l.line_ttc ?? 0),
      })),
      qrDataUrl,
    })

    const buffer = await renderToBuffer(element as any)
    const fileName = `Facture-${(inv.number ?? id).replace(/\//g, '-')}.pdf`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length':      String(buffer.byteLength),
        'Cache-Control':       'no-store',
      },
    })
  } catch (e: any) {
    console.error('[PDF] Error:', e?.message)
    return err(e?.message ?? 'Erreur generation PDF', 500)
  }
}
