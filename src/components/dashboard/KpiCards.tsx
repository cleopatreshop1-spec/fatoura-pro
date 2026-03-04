'use client'

import Link from 'next/link'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

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

function AnimatedTND({ value, color }: { value: number; color: string }) {
  const anim = useAnimatedNumber(value)
  return <span className={`font-mono text-2xl font-black leading-none ${color}`}>{fmtTND(anim)}</span>
}

function AnimatedInt({ value, color }: { value: number; color: string }) {
  const anim = useAnimatedNumber(value)
  return <span className={`font-mono text-2xl font-black leading-none ${color}`}>{Math.round(anim)}</span>
}

export function KpiCards({ caHT, caTrend, validThisMonth, tvaQtr, qtr, year, unpaidTotal, avgOverdueDays }: Props) {
  const isOverdue = avgOverdueDays > 0

  const cards = [
    {
      label:  'CA ce mois (HT)',
      node:   <AnimatedTND value={caHT} color="text-[#d4a843]" />,
      suffix: 'TND',
      gradient: 'from-[#d4a843]/8 to-transparent',
      bar:    'bg-gradient-to-r from-[#d4a843] to-[#f0c060]',
      glow:   'shadow-[0_0_24px_rgba(212,168,67,0.08)]',
      sub: caTrend !== null
        ? { text: `vs mois précédent : ${caTrend >= 0 ? '+' : ''}${caTrend}%`, up: caTrend >= 0 }
        : null,
      href: '/dashboard/invoices',
    },
    {
      label:  'Factures validées TTN',
      node:   <AnimatedInt value={validThisMonth} color="text-[#2dd4a0]" />,
      suffix: 'ce mois',
      gradient: 'from-[#2dd4a0]/8 to-transparent',
      bar:    'bg-gradient-to-r from-[#2dd4a0] to-[#34d8a8]',
      glow:   'shadow-[0_0_24px_rgba(45,212,160,0.08)]',
      sub:    null,
      href:   '/dashboard/invoices?status=valid',
    },
    {
      label:  'TVA collectée',
      node:   <AnimatedTND value={tvaQtr} color="text-purple-400" />,
      suffix: 'TND',
      gradient: 'from-purple-500/8 to-transparent',
      bar:    'bg-gradient-to-r from-purple-500 to-purple-400',
      glow:   'shadow-[0_0_24px_rgba(168,85,247,0.08)]',
      sub:    { text: `À déclarer T${qtr} ${year}`, up: null },
      href:   '/dashboard/tva',
    },
    {
      label:  'Factures impayées',
      node:   <AnimatedTND value={unpaidTotal} color={isOverdue ? 'text-red-400' : 'text-[#f59e0b]'} />,
      suffix: 'TND',
      gradient: isOverdue ? 'from-red-500/8 to-transparent' : 'from-[#f59e0b]/8 to-transparent',
      bar:    isOverdue ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]',
      glow:   isOverdue ? 'shadow-[0_0_24px_rgba(239,68,68,0.08)]' : 'shadow-[0_0_24px_rgba(245,158,11,0.08)]',
      sub: isOverdue ? { text: `${avgOverdueDays}j de retard en moyenne`, up: false } : null,
      href: '/dashboard/invoices?payment_status=unpaid',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(card => (
        <Link key={card.label} href={card.href}
          className={`bg-gradient-to-br ${card.gradient} bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 relative overflow-hidden hover:border-[#252830] hover:scale-[1.01] transition-all duration-200 group ${card.glow}`}>
          {/* Animated gradient top bar */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] ${card.bar} opacity-70 group-hover:opacity-100 transition-opacity`} />
          {/* Subtle background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />

          <div className="relative">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3 font-semibold">{card.label}</p>
            {card.node}
            <p className="text-xs text-gray-600 mt-1.5">{card.suffix}</p>
            {card.sub && (
              <p className={`text-[11px] mt-2 font-semibold ${
                card.sub.up === true  ? 'text-[#2dd4a0]'
                : card.sub.up === false ? 'text-red-400'
                : 'text-gray-500'
              }`}>
                {card.sub.up === true ? '↑ ' : card.sub.up === false ? '↓ ' : ''}{card.sub.text}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}