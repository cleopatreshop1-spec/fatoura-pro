'use client'

import Link from 'next/link'

type Props = {
  caHT: number
  caTrend: number | null
  validThisMonth: number
  tvaQtr: number
  qtr: number
  year: number
  unpaidTotal: number
  avgOverdueDays: number
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

export function KpiCards({ caHT, caTrend, validThisMonth, tvaQtr, qtr, year, unpaidTotal, avgOverdueDays }: Props) {
  const cards = [
    {
      label: 'CA ce mois (HT)',
      value: fmtTND(caHT),
      suffix: 'TND',
      color: 'text-[#d4a843]',
      accent: 'bg-[#d4a843]',
      sub: caTrend !== null
        ? { text: `vs mois précédent : ${caTrend >= 0 ? '+' : ''}${caTrend}%`, up: caTrend >= 0 }
        : null,
      href: '/dashboard/invoices',
    },
    {
      label: 'Factures validées TTN',
      value: String(validThisMonth),
      suffix: 'ce mois',
      color: 'text-[#2dd4a0]',
      accent: 'bg-[#2dd4a0]',
      sub: null,
      href: '/dashboard/invoices?status=valid',
    },
    {
      label: 'TVA collectée',
      value: fmtTND(tvaQtr),
      suffix: 'TND',
      color: 'text-purple-400',
      accent: 'bg-purple-500',
      sub: { text: `À déclarer T${qtr} ${year}`, up: null },
      href: '/dashboard/tva',
    },
    {
      label: 'Factures impayées',
      value: fmtTND(unpaidTotal),
      suffix: 'TND',
      color: avgOverdueDays > 0 ? 'text-red-400' : 'text-[#f59e0b]',
      accent: avgOverdueDays > 0 ? 'bg-red-500' : 'bg-[#f59e0b]',
      sub: avgOverdueDays > 0
        ? { text: `${avgOverdueDays}j de retard en moyenne`, up: false }
        : null,
      href: '/dashboard/invoices?payment_status=unpaid',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(card => (
        <Link key={card.label} href={card.href}
          className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 relative overflow-hidden hover:border-[#252830] transition-colors group">
          <div className={`absolute top-0 left-0 right-0 h-0.5 ${card.accent} opacity-60`} />
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{card.label}</p>
          <p className={`font-mono text-2xl font-black leading-none ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-600 mt-1">{card.suffix}</p>
          {card.sub && (
            <p className={`text-[11px] mt-2 font-medium ${
              card.sub.up === true ? 'text-[#2dd4a0]' : card.sub.up === false ? 'text-red-400' : 'text-gray-500'
            }`}>
              {card.sub.up === true ? '↑ ' : card.sub.up === false ? '↓ ' : ''}{card.sub.text}
            </p>
          )}
        </Link>
      ))}
    </div>
  )
}