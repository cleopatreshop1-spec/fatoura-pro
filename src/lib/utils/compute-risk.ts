export type InvRow = {
  id: string
  clients: { id: string; name: string } | null
  payment_status: string | null
  due_date: string | null
  paid_at?: string | null
  issue_date: string | null
}

export type RiskLevel = 'high' | 'medium' | 'low' | null

export type RiskResult = {
  level: RiskLevel
  label: string
  tooltip: string
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

  if (daysUntilDue > 60) return { level: null, label: '', tooltip: '' }

  const clientHistory = allInvoices.filter(
    inv => inv.id !== invoiceId && inv.clients?.id === clientId && inv.issue_date
  )

  if (clientHistory.length === 0) {
    if (daysUntilDue < 0)  return { level: 'high',   label: 'Risque élevé', tooltip: `Échéance dépassée de ${Math.abs(daysUntilDue)}j` }
    if (daysUntilDue < 7)  return { level: 'medium', label: 'Risque moyen', tooltip: 'Échéance dans moins de 7 jours' }
    return { level: null, label: '', tooltip: '' }
  }

  const paidHistory = clientHistory.filter(
    inv => inv.payment_status === 'paid' && inv.paid_at && inv.due_date
  )

  let avgLateDays = 0
  let lateCount = 0

  if (paidHistory.length > 0) {
    const lateDaysArr = paidHistory.map(inv => {
      const paidDate = new Date(inv.paid_at!)
      const dueDateD = new Date(inv.due_date!)
      return Math.round((paidDate.getTime() - dueDateD.getTime()) / 86400000)
    })
    avgLateDays = lateDaysArr.reduce((s, d) => s + d, 0) / lateDaysArr.length
    lateCount   = lateDaysArr.filter(d => d > 0).length
  }

  const unpaidOld = clientHistory.filter(
    inv => inv.payment_status !== 'paid' && inv.due_date && new Date(inv.due_date) < now
  ).length

  const unpaidRatio = clientHistory.length > 0 ? (unpaidOld / clientHistory.length) : 0

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
