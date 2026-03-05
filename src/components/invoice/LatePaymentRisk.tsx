'use client'

import { useMemo } from 'react'
import { computeRisk } from '@/lib/utils/compute-risk'
import type { InvRow, RiskLevel } from '@/lib/utils/compute-risk'

export { computeRisk } from '@/lib/utils/compute-risk'
export type { InvRow, RiskLevel, RiskResult } from '@/lib/utils/compute-risk'

const RISK_STYLES: Record<Exclude<RiskLevel, null>, { badge: string; dot: string }> = {
  high:   { badge: 'text-red-400 bg-red-950/30 border-red-900/40',    dot: 'bg-red-400' },
  medium: { badge: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/40', dot: 'bg-yellow-400' },
  low:    { badge: 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40', dot: 'bg-emerald-400' },
}

type Props = {
  invoiceId: string
  clientId: string | null | undefined
  dueDate: string | null
  allInvoices: InvRow[]
}

export function LatePaymentRisk({ invoiceId, clientId, dueDate, allInvoices }: Props) {
  const risk = useMemo(
    () => computeRisk(invoiceId, clientId, dueDate, allInvoices),
    [invoiceId, clientId, dueDate, allInvoices]
  )

  if (!risk.level) return null

  const style = RISK_STYLES[risk.level]

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ml-1.5 ${style.badge}`}
      title={risk.tooltip}
    >
      <span className={`w-1 h-1 rounded-full ${style.dot} shrink-0`} />
      {risk.label}
    </span>
  )
}
