export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDetailPanel } from '@/components/invoice/InvoiceDetailPanel'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { PrintButton } from '@/components/invoice/PrintButton'
import { fmtTND, STAMP_DUTY } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'
import Link from 'next/link'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('*, clients(*), companies(*), invoice_line_items(id, sort_order, description, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc)')
    .eq('id', id).single()

  const lines = inv
    ? ((inv as any).invoice_line_items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []

  if (!inv) notFound()

  const i = inv as any
  const c = i.companies as any
  const cl = i.clients as any
  const ls = (lines ?? []) as any[]

  const tvaGroups: Record<number, { base: number; tva: number }> = {}
  for (const l of ls) {
    const r = Number(l.tva_rate ?? 19)
    if (!tvaGroups[r]) tvaGroups[r] = { base: 0, tva: 0 }
    tvaGroups[r].base += Number(l.line_ht ?? 0)
    tvaGroups[r].tva  += Number(l.line_tva ?? 0)
  }
  const totalInWords = i.total_in_words || amountToWords(Number(i.ttc_amount ?? 0))
  const companyPrefix = c?.invoice_prefix ?? 'FP'

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; overflow: auto; }
          #invoice-print-root .print\\:hidden { display: none !important; }
          #invoice-print-root .xl\\:col-span-2 { display: none !important; }
          #invoice-print-root .xl\\:col-span-3 { grid-column: span 5 / span 5 !important; }
          #invoice-print-root .grid { display: block !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/invoices" className="text-gray-500 hover:text-gray-300 transition-colors">Factures</Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[#d4a843]">{i.number ?? 'Brouillon'}</span>
          <InvoiceStatusBadge status={i.status ?? 'draft'} />
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

        {/*  LEFT: Paper Invoice (3/5)  */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden text-gray-900 print:shadow-none">

            {/* Invoice Header */}
            <div className="px-8 py-7 flex justify-between items-start border-b border-gray-200">
              <div>
                <div className="text-xl font-black text-gray-900 tracking-tight mb-1">
                  {c?.name ?? 'Votre Société'}
                </div>
                {c?.matricule_fiscal && (
                  <div className="text-xs font-mono text-gray-500">MF: {c.matricule_fiscal}</div>
                )}
                {c?.address && <div className="text-xs text-gray-500 mt-1 max-w-[200px]">{c.address}</div>}
                {c?.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                {c?.email && <div className="text-xs text-gray-500">{c.email}</div>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-gray-900 tracking-widest uppercase">FACTURE</div>
                <div className="font-mono text-lg font-bold text-gray-700 mt-1">{i.number ?? ''}</div>
                <div className="mt-3 space-y-0.5 text-xs text-gray-500">
                  <div><span className="text-gray-400">Date:</span> {i.issue_date ? new Date(i.issue_date).toLocaleDateString('fr-FR') : ''}</div>
                  {i.due_date && <div><span className="text-gray-400">Echeance:</span> {new Date(i.due_date).toLocaleDateString('fr-FR')}</div>}
                </div>
              </div>
            </div>

            {/* Client Block */}
            <div className="px-8 py-5 border-b border-gray-100 bg-gray-50">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Facturer a</div>
              {cl ? (
                <div>
                  <div className="font-bold text-gray-900 text-sm">{cl.name}</div>
                  {cl.matricule_fiscal && <div className="text-xs font-mono text-gray-500 mt-0.5">MF: {cl.matricule_fiscal}</div>}
                  {cl.address && <div className="text-xs text-gray-500 mt-0.5">{cl.address}</div>}
                  {cl.phone && <div className="text-xs text-gray-500">{cl.phone}</div>}
                  {cl.email && <div className="text-xs text-gray-500">{cl.email}</div>}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">Particulier</div>
              )}
            </div>

            {/* Lines Table */}
            <div className="px-8 py-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {['Description', 'Qte', 'PU HT', 'TVA', 'HT', 'TTC'].map(h => (
                      <th key={h} className={`py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h==='Description'?'text-left':'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ls.map((l: any, idx: number) => (
                    <tr key={l.id ?? idx} className={idx%2===0?'bg-white':'bg-gray-50/50'}>
                      <td className="py-2.5 pr-4 text-gray-800 font-medium">{l.description}</td>
                      <td className="py-2.5 text-right text-gray-600 font-mono">{Number(l.quantity).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:3})}</td>
                      <td className="py-2.5 text-right text-gray-600 font-mono">{fmtTND(Number(l.unit_price??0))}</td>
                      <td className="py-2.5 text-right text-gray-500">{l.tva_rate}%</td>
                      <td className="py-2.5 text-right text-gray-700 font-mono">{fmtTND(Number(l.line_ht??0))}</td>
                      <td className="py-2.5 text-right text-gray-900 font-bold font-mono">{fmtTND(Number(l.line_ttc??0))}</td>
                    </tr>
                  ))}
                  {ls.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-xs italic">Aucune ligne</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-8 pb-6">
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Total HT</span>
                    <span className="font-mono">{fmtTND(Number(i.ht_amount??0))} TND</span>
                  </div>
                  {Object.entries(tvaGroups).filter(([,v])=>v.base>0).map(([rate,v])=>(
                    <div key={rate} className="flex justify-between text-xs text-gray-500">
                      <span>TVA {rate}% <span className="text-gray-400">(base: {fmtTND(v.base)})</span></span>
                      <span className="font-mono">{Number(rate)===0?'':fmtTND(v.tva)} TND</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Droit de timbre</span>
                    <span className="font-mono">{fmtTND(STAMP_DUTY)} TND</span>
                  </div>
                  <div className="border-t-2 border-gray-800 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-black text-gray-900 uppercase tracking-wide">Total TTC</span>
                      <span className="text-sm font-black text-gray-900 font-mono">{fmtTND(Number(i.ttc_amount??0))} TND</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic leading-relaxed pt-1">{totalInWords}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 space-y-2">
              {i.status === 'valid' && i.ttn_id && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Facture validee TTN</span>
                  <span className="text-[10px] font-mono text-green-600">ID: {i.ttn_id}</span>
                </div>
              )}
              {c?.bank_name && c?.bank_rib && (
                <div className="text-[10px] text-gray-500">
                  <span className="font-semibold">Banque:</span> {c.bank_name}  <span className="font-semibold">RIB:</span> <span className="font-mono">{c.bank_rib}</span>
                </div>
              )}
              {i.notes && (
                <div className="text-[10px] text-gray-500 border-t border-gray-200 pt-2">{i.notes}</div>
              )}
            </div>
          </div>
        </div>

        {/*  RIGHT: Status Panel (2/5)  */}
        <div className="xl:col-span-2">
          <InvoiceDetailPanel
            invoice={{
              id: i.id, number: i.number, status: i.status ?? 'draft',
              issue_date: i.issue_date, due_date: i.due_date,
              ttn_id: i.ttn_id, ttn_rejection_reason: i.ttn_rejection_reason,
              payment_status: i.payment_status, paid_at: i.paid_at,
              created_at: i.created_at, submitted_at: i.submitted_at,
              validated_at: i.validated_at, company_id: i.company_id,
              ttc_amount: i.ttc_amount,
              client_name:  cl?.name  ?? null,
              client_email: cl?.email ?? null,
              client_phone: cl?.phone ?? null,
              share_token:          i.share_token          ?? null,
              share_view_count:     i.share_view_count     ?? 0,
              share_last_viewed_at: i.share_last_viewed_at ?? null,
            }}
            companyPrefix={companyPrefix}
          />
        </div>
      </div>
    </div>
  )
}
