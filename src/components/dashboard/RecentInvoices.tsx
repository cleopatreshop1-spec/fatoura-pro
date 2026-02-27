// src/components/dashboard/RecentInvoices.tsx

type InvoiceRow = {
  id?: string
  number?: string | null
  issue_date?: string | null
  client_id?: string | null
  status?: string | null
  ht_amount?: number | string | null
  tva_amount?: number | string | null
  ttc_amount?: number | string | null
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n)

export function RecentInvoices({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <div className="bg-[#111318] border border-[#252830] rounded-xl p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
        Factures récentes
      </div>
      {invoices.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune facture.</div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv, idx) => (
            <div
              key={inv.id ?? idx}
              className="flex items-center justify-between border border-[#252830] rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-gray-200 font-mono truncate">
                  {inv.number ?? 'Sans numéro'}
                </div>
                <div className="text-xs text-gray-500">
                  {inv.issue_date ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-200 font-mono">
                  {fmtTND(Number(inv.ttc_amount ?? 0))}
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${
                  inv.status === 'valid'
                    ? 'bg-green-900/30 text-green-400'
                    : inv.status === 'draft'
                    ? 'bg-yellow-900/30 text-yellow-400'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {inv.status ?? '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
