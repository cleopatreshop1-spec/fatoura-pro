'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

type ClientStat = {
  id: string
  name: string
  invoiceCount: number
  totalTTC: number
  unpaid: number
}

interface Props {
  clients: ClientStat[]
}

const RANK_COLORS = ['text-[#d4a843]', 'text-gray-400', 'text-amber-700', 'text-gray-600', 'text-gray-600']

export function TopClientsWidget({ clients }: Props) {
  if (!clients.length) return null

  const max = clients[0]?.totalTTC ?? 1

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={14} className="text-[#d4a843]" />
            Top clients
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">Par chiffre d'affaires TTC</p>
        </div>
        <Link href="/dashboard/clients" className="text-xs text-gray-600 hover:text-[#d4a843] transition-colors">
          Voir tous →
        </Link>
      </div>

      <div className="space-y-3">
        {clients.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3">
            <span className={`text-xs font-black w-4 text-center shrink-0 ${RANK_COLORS[i] ?? 'text-gray-600'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="text-xs font-medium text-gray-300 hover:text-[#d4a843] transition-colors truncate"
                >
                  {c.name}
                </Link>
                <span className="text-xs font-mono font-bold text-white ml-2 shrink-0">
                  {fmt(c.totalTTC)} TND
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#d4a843] to-[#f0c060] transition-all duration-500"
                  style={{ width: `${(c.totalTTC / max) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-gray-600">{c.invoiceCount} facture{c.invoiceCount > 1 ? 's' : ''}</span>
                {c.unpaid > 0 && (
                  <span className="text-[9px] text-[#f59e0b]">· {fmt(c.unpaid)} TND impayé</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
