'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'

type InvRow = {
  id: string
  clients: { id: string; name: string } | null
  payment_status: string | null
  due_date: string | null
  paid_at?: string | null
  issue_date: string | null
}

type RiskLevel = 'high' | 'medium' | 'low' | null

type RiskResult = {
  level: RiskLevel
  label: string
  tooltip: string
}

const RISK_STYLES: Record<Exclude<RiskLevel, null>, { badge: string; dot: string }> = {
  high:   { badge: 'text-red-400 bg-red-950/30 border-red-900/40',    dot: 'bg-red-400' },
  medium: { badge: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/40', dot: 'bg-yellow-400' },
  low:    { badge: 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40', dot: 'bg-emerald-400' },
}

export function computeRisk(
  invoiceId: string,
  clientId: string | null | undefined,
  dueDate: string | null,
  allInvoices: InvRow[]
): RiskResult {
  if (!clientId || !dueDate) return { level: null, label: '', tooltip: '' }

  const now = new Date()
  const due = new Date(dueDate)
  const daysUntilDue = Math.round((due.getTime() - now.getTime()) / 86400000)

  // Already paid or too far in future — no risk
  if (daysUntilDue > 60) return { level: null, label: '', tooltip: '' }

  // Historical invoices for this client (excluding current)
  const clientHistory = allInvoices.filter(
    inv => inv.id !== invoiceId && inv.clients?.id === clientId && inv.issue_date
  )

  if (clientHistory.length === 0) {
    // No history — score based on days to due
    if (daysUntilDue < 0)  return { level: 'high',   label: 'Risque élevé',   tooltip: `Échéance dépassée de ${Math.abs(daysUntilDue)}j` }
    if (daysUntilDue < 7)  return { level: 'medium', label: 'Risque moyen',   tooltip: 'Échéance dans moins de 7 jours' }
    return { level: null, label: '', tooltip: '' }
  }

  // Calculate avg days-to-pay from historical paid invoices
  const paidHistory = clientHistory.filter(
    inv => inv.payment_status === 'paid' && inv.paid_at && inv.due_date
  )

  let avgLateDays = 0
  let lateCount = 0

  if (paidHistory.length > 0) {
    const lateDaysArr = paidHistory.map(inv => {
      const paidDate = new Date(inv.paid_at!)
      const dueDate  = new Date(inv.due_date!)
      return Math.round((paidDate.getTime() - dueDate.getTime()) / 86400000)
    })
    avgLateDays = lateDaysArr.reduce((s, d) => s + d, 0) / lateDaysArr.length
    lateCount   = lateDaysArr.filter(d => d > 0).length
  }

  const unpaidOld = clientHistory.filter(
    inv => inv.payment_status !== 'paid' && inv.due_date && new Date(inv.due_date) < now
  ).length

  // Score: weighted combo of avg late days + unpaid ratio + current due proximity
  const unpaidRatio = clientHistory.length > 0
    ? (unpaidOld / clientHistory.length)
    : 0

  const riskScore =
    (avgLateDays > 30 ? 3 : avgLateDays > 10 ? 2 : avgLateDays > 0 ? 1 : 0) +
    (unpaidRatio  > 0.5 ? 3 : unpaidRatio > 0.25 ? 2 : unpaidRatio > 0 ? 1 : 0) +
    (daysUntilDue < 0  ? 3 : daysUntilDue < 7 ? 2 : daysUntilDue < 14 ? 1 : 0) +
    (lateCount > 2 ? 2 : lateCount > 0 ? 1 : 0)

  if (riskScore >= 6) {
    const tooltip = avgLateDays > 0
      ? `Ce client paie en moyenne ${Math.round(avgLateDays)}j après échéance`
      : `${lateCount} paiement${lateCount > 1 ? 's' : ''} tardif${lateCount > 1 ? 's' : ''} détecté${lateCount > 1 ? 's' : ''}`
    return { level: 'high', label: 'Risque élevé', tooltip }
  }
  if (riskScore >= 3) {
    return { level: 'medium', label: 'Risque moyen', tooltip: `Historique de paiement instable` }
  }
  if (riskScore >= 1 && (daysUntilDue < 14 || unpaidOld > 0)) {
    return { level: 'low', label: 'À surveiller', tooltip: 'Quelques retards mineurs' }
  }

  return { level: null, label: '', tooltip: '' }
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
