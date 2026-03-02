import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters } from '@/lib/rate-limiter'
import { InvoicePDFTemplate } from '@/components/invoice/InvoicePDFTemplate'

export async function POST(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const limited = await applyRateLimit(rateLimiters.export, company.id)
    if (limited) return limited

    const body = await request.json()
    const invoiceIds: string[] = body.invoiceIds ?? []
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0)
      return err('invoiceIds requis', 400)
    if (invoiceIds.length > 50)
      return err('Maximum 50 factures par export', 400)

    const zip = new JSZip()

    for (const id of invoiceIds) {
      const { data: invoice } = await (supabase as any)
        .from('invoices')
        .select('*, clients(*), invoice_line_items(id, sort_order, description, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc)')
        .eq('id', id)
        .eq('company_id', company.id)
        .single()

      if (!invoice) continue

      const inv   = invoice as any
      const cl    = inv.clients as any
      const lines = ((inv.invoice_line_items ?? []) as any[])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      const element = React.createElement(InvoicePDFTemplate, {
        invoice: {
          id: inv.id, number: inv.number, status: inv.status,
          issue_date: inv.issue_date, due_date: inv.due_date,
          ht_amount: inv.ht_amount, tva_amount: inv.tva_amount,
          ttc_amount: inv.ttc_amount, total_in_words: inv.total_in_words ?? null,
          notes: inv.notes ?? null, ttn_id: inv.ttn_id ?? null,
        },
        company: {
          name: (company as any).name ?? '', matricule_fiscal: (company as any).matricule_fiscal ?? null,
          address: (company as any).address ?? null, phone: (company as any).phone ?? null,
          email: (company as any).email ?? null, website: (company as any).website ?? null,
          bank_name: (company as any).bank_name ?? null, bank_rib: (company as any).bank_rib ?? null,
          logo_url: (company as any).logo_url ?? null,
          default_payment_terms: (company as any).default_payment_terms ?? null,
          tva_regime: (company as any).tva_regime ?? null,
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
        qrDataUrl: null,
      })

      const buffer = await renderToBuffer(element as any)
      const fileName = `Facture-${(inv.number ?? id).replace(/\//g, '-')}.pdf`
      zip.file(fileName, buffer)
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': 'attachment; filename="factures.zip"',
      },
    })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
