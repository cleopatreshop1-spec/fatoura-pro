import Link from 'next/link'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { fmtTND } from '@/lib/utils/tva-calculator'

export type InvoiceTableRow = {
  id: string
  number: string | null
  clientName: string | null
  date: string | null
  ttc: number
  status: string
}

export function RecentInvoicesTable({ invoices }: { invoices: InvoiceTableRow[] }) {
  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22] shrink-0">
        <h2 className="text-sm font-bold text-gray-200">Dernieres factures</h2>
        <span className="text-xs text-gray-600">{invoices.length} facture{invoices.length !== 1 ? 's' : ''}</span>
      </div>

      {invoices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12 text-sm text-gray-600">
          Aucune facture pour le moment
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1b22]">
                  {['N Facture', 'Client', 'Date', 'Montant TTC', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1b22]">
                {invoices.map(inv => (
                  <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} legacyBehavior>
                    <tr className="hover:bg-[#161b27] transition-colors cursor-pointer group">
                      <td className="px-4 py-3 font-mono text-xs text-[#d4a843] group-hover:text-[#f0c060] whitespace-nowrap">
                        {inv.number ?? ''}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[140px] truncate">
                        {inv.clientName ?? <span className="text-gray-600 italic">Particulier</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-200 whitespace-nowrap text-xs">
                        {fmtTND(inv.ttc)} TND
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#1a1b22] mt-auto">
            <Link href="/dashboard/invoices" className="text-xs text-gray-500 hover:text-[#d4a843] transition-colors">
              Voir toutes les factures 
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
