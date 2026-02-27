// src/components/financing/FlashFinancingWidget.tsx

type InvoiceRow = {
  status?: string | null
  ht_amount?: number | string | null
}

export function FlashFinancingWidget({
  invoices,
  companyId,
}: {
  invoices: InvoiceRow[]
  companyId: string
}) {
  const eligibleCount = invoices.filter(i => i.status === 'valid').length
  const eligibleAmount = invoices
    .filter(i => i.status === 'valid')
    .reduce((s, i) => s + Number(i.ht_amount ?? 0), 0)

  return (
    <div className="bg-[#111318] border border-[#252830] rounded-xl p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
        Flash financing
      </div>
      <div className="text-sm text-gray-200">Entreprise: {companyId || '—'}</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="border border-[#252830] rounded-lg px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase">Factures éligibles</div>
          <div className="text-lg font-mono font-bold text-white">{eligibleCount}</div>
        </div>
        <div className="border border-[#252830] rounded-lg px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase">Montant HT</div>
          <div className="text-lg font-mono font-bold text-white">
            {new Intl.NumberFormat('fr-TN', {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }).format(eligibleAmount)}
          </div>
        </div>
      </div>
    </div>
  )
}
