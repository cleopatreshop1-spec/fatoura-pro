import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { zipSync, strToU8 } from 'fflate'
import { createClient } from '@/lib/supabase/server'
import { err, getAuthenticatedCompany } from '@/lib/api-helpers'
import { InvoicePDFTemplate } from '@/components/invoice/InvoicePDFTemplate'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const company = await getAuthenticatedCompany(req)
    const supabase = await createClient()

    const { ids } = await req.json() as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) return err('Aucun identifiant fourni', 400)
    if (ids.length > 50) return err('Maximum 50 factures par export ZIP', 400)

    // Pre-fetch company logo once
    let logoDataUrl: string | null = null
    if ((company as any).logo_url) {
      try {
        const r = await fetch((company as any).logo_url)
        if (r.ok) {
          const buf = await r.arrayBuffer()
          const mime = r.headers.get('content-type') ?? 'image/png'
          logoDataUrl = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
        }
      } catch {}
    }

    // Fetch all invoices in one query
    const { data: invoices, error: invErr } = await (supabase as any)
      .from('invoices')
      .select('*, clients(*), invoice_line_items(*)')
      .in('id', ids)
      .eq('company_id', (company as any).id)

    if (invErr || !invoices?.length) return err('Factures introuvables', 404)

    // Build PDF for each invoice
    const zipFiles: Record<string, Uint8Array> = {}

    for (const inv of invoices as any[]) {
      const cl = inv.clients as any
      const lines = ((inv.invoice_line_items ?? []) as any[])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      let qrDataUrl: string | null = null
      if (inv.status === 'valid' && inv.ttn_id) {
        try {
          qrDataUrl = await QRCode.toDataURL(inv.ttn_id, {
            width: 120, margin: 1, color: { dark: '#0f1017', light: '#ffffff' },
          })
        } catch {}
      }

      const element = React.createElement(InvoicePDFTemplate, {
        invoice: {
          id: inv.id, number: inv.number, status: inv.status,
          issue_date: inv.issue_date, due_date: inv.due_date,
          ht_amount: inv.ht_amount, tva_amount: inv.tva_amount,
          ttc_amount: inv.ttc_amount,
          total_in_words: inv.total_in_words ?? null,
          notes: inv.notes ?? null,
          ttn_id: inv.ttn_id ?? null,
          payment_status: inv.payment_status ?? null,
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
          logo_url:              logoDataUrl ?? null,
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
      const fileName = `Facture-${(inv.number ?? inv.id).replace(/\//g, '-')}.pdf`
      zipFiles[fileName] = new Uint8Array(buffer)
    }

    const zipped = zipSync(zipFiles, { level: 1 })

    return new Response(Buffer.from(zipped), {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="factures_export.zip"`,
        'Content-Length':      String(zipped.byteLength),
        'Cache-Control':       'no-store',
      },
    })
  } catch (e: any) {
    console.error('[ZIP] Error:', e?.message)
    return err(e?.message ?? 'Erreur export ZIP', 500)
  }
}
