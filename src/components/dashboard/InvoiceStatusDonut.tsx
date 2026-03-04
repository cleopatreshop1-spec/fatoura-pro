'use client'

import Link from 'next/link'

type Slice = { label: string; value: number; color: string; href: string }

interface Props {
  draft: number
  validated: number
  paid: number
  overdue: number
}

function Donut({ slices }: { slices: { value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return (
    <svg viewBox="0 0 36 36" className="w-full h-full">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1b22" strokeWidth="3.8" />
    </svg>
  )
  const R = 15.9
  const circ = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
      <circle cx="18" cy="18" r={R} fill="none" stroke="#1a1b22" strokeWidth="3.8" />
      {slices.filter(sl => sl.value > 0).map((sl, i) => {
        const pct = sl.value / total
        const dash = pct * circ
        const el = (
          <circle key={i} cx="18" cy="18" r={R} fill="none"
            stroke={sl.color} strokeWidth="3.8"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt" />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

export function InvoiceStatusDonut({ draft, validated, paid, overdue }: Props) {
  const total = draft + validated + paid + overdue
  const slices: Slice[] = [
    { label: 'Payées',    value: paid,      color: '#2dd4a0', href: '/dashboard/invoices?payment=paid' },
    { label: 'Validées',  value: validated,  color: '#d4a843', href: '/dashboard/invoices?status=validated' },
    { label: 'En retard', value: overdue,    color: '#ef4444', href: '/dashboard/invoices?payment=overdue' },
    { label: 'Brouillons',value: draft,      color: '#374151', href: '/dashboard/invoices?status=draft' },
  ]

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white">Statut des factures</h2>
        <Link href="/dashboard/invoices" className="text-xs text-gray-600 hover:text-[#d4a843] transition-colors">
          Voir tout →
        </Link>
      </div>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative shrink-0 w-[88px] h-[88px]">
          <Donut slices={slices.map(s => ({ value: s.value, color: s.color }))} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-white leading-none">{total}</span>
            <span className="text-[9px] text-gray-600 mt-0.5">total</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {slices.map(s => (
            <Link key={s.label} href={s.href}
              className="flex items-center gap-2 group">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-gray-500 group-hover:text-gray-200 transition-colors flex-1">{s.label}</span>
              <span className="text-xs font-mono font-bold text-gray-300">{s.value}</span>
              {total > 0 && (
                <span className="text-[10px] text-gray-600 w-8 text-right">
                  {Math.round((s.value / total) * 100)}%
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
