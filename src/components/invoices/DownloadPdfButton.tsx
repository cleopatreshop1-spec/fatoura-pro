'use client'

import { useMemo, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/client'
import { InvoicePdfDocument, type InvoicePdfData } from '@/lib/pdf/InvoicePdfDocument'

interface Props {
  invoiceId: string
}

export function DownloadPdfButton({ invoiceId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)

    try {
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('*, companies(*), clients(*)')
        .eq('id', invoiceId)
        .single()

      if (invErr) throw invErr

      const { data: lineItems, error: liErr } = await supabase
        .from('invoice_line_items')
        .select('description, quantity, unit_price, tva_rate')
        .eq('invoice_id', invoiceId)

      if (liErr) throw liErr

      const company = invoice.companies as any
      const client = invoice.clients as any

      const pdfData: InvoicePdfData = {
        companyName: company?.name ?? 'Ma Société',
        companyMf: company?.matricule_fiscal ?? company?.mf ?? null,
        clientName: client?.name ?? 'Client inconnu',
        clientMf: client?.matricule_fiscal ?? client?.mf ?? null,
        invoiceNumber: invoice.number ?? '—',
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        reference: invoice.reference,
        notes: invoice.notes,
        lineItems: (lineItems ?? []).map((li: any) => ({
          description: li.description ?? '',
          quantity: Number(li.quantity ?? 0),
          unit_price: Number(li.unit_price ?? 0),
          tva_rate: Number(li.tva_rate ?? 0),
        })),
        htAmount: Number(invoice.ht_amount ?? 0),
        tvaAmount: Number(invoice.tva_amount ?? 0),
        stampAmount: Number(invoice.stamp_amount ?? 0.6),
        ttcAmount: Number(invoice.ttc_amount ?? 0),
      }

      const blob = await pdf(<InvoicePdfDocument data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pdfData.invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e?.message ?? 'Erreur lors de la génération du PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
    >
      {loading ? '...' : 'PDF'}
    </button>
  )
}
