'use client'

import Link from 'next/link'

type AgingBucket = {
  label: string
  count: number
  amount: number
  color: string
  bg: string
  bar: string
  href: string
}

type Props = {
  buckets: AgingBucket[]
  totalUnpaid: number
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

export function InvoiceAgingReport({ buckets, totalUnpaid }: Props) {
  const max = Math.max(...buckets.map(b => b.amount), 1)

  if (totalUnpaid === 0) return null

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a1b22] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Analyse des créances</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">Répartition des factures impayées par ancienneté</p>
        </div>
        <span className="text-xs font-mono font-bold text-[#f59e0b]">{fmtTND(totalUnpaid)} TND</span>
      </div>

      <div className="p-5 space-y-3">
        {buckets.map(b => (
          <Link key={b.label} href={b.href}
            className="block group hover:bg-[#161b27] rounded-xl p-3 -mx-3 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.bg}`}>{b.label}</span>
                <span className="text-xs text-gray-500">{b.count} facture{b.count !== 1 ? 's' : ''}</span>
              </div>
              <span className={`text-xs font-mono font-bold ${b.color}`}>{fmtTND(b.amount)} TND</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${b.bar}`}
                style={{ width: `${Math.round((b.amount / max) * 100)}%` }}
              />
            </div>
            {totalUnpaid > 0 && (
              <p className="text-[10px] text-gray-700 mt-1">
                {Math.round((b.amount / totalUnpaid) * 100)}% du total impayé
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
