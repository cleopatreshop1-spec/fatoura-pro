'use client'

import Link from 'next/link'
import { fmtTND } from '@/lib/utils/tva-calculator'

type ActivityItem = {
  id: string
  type: 'invoice_created' | 'invoice_paid' | 'invoice_overdue' | 'expense_added'
  label: string
  sub: string
  amount: number | null
  date: string
  href: string
}

interface Props {
  items: ActivityItem[]
}

const TYPE_ICON: Record<ActivityItem['type'], string> = {
  invoice_created: '📄',
  invoice_paid:    '✅',
  invoice_overdue: '⚠️',
  expense_added:   '💸',
}

const TYPE_COLOR: Record<ActivityItem['type'], string> = {
  invoice_created: 'border-[#d4a843]/30 bg-[#d4a843]/5',
  invoice_paid:    'border-[#2dd4a0]/30 bg-[#2dd4a0]/5',
  invoice_overdue: 'border-red-900/40 bg-red-950/10',
  expense_added:   'border-[#f59e0b]/20 bg-[#f59e0b]/5',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function RecentActivityFeed({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Activité récente</h2>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id}>
            <Link href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors hover:brightness-110 ${TYPE_COLOR[item.type]}`}>
              <span className="text-base shrink-0 leading-none">{TYPE_ICON[item.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate leading-tight">{item.label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5 truncate">{item.sub}</p>
              </div>
              <div className="text-right shrink-0">
                {item.amount !== null && (
                  <p className="text-xs font-mono font-bold text-gray-300">{fmtTND(item.amount)}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-0.5">{fmt(item.date)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type { ActivityItem }
