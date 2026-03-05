import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { fmtTND } from '@/lib/utils/tva-calculator'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'
import { computeRisk } from '@/components/invoice/LatePaymentRisk'
import { ClientStatementButton } from '@/components/clients/ClientStatementButton'
import { PaymentReminderButton } from '@/components/invoice/PaymentReminderButton'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: invoices }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('invoices')
      .select('id, number, status, issue_date, due_date, ttc_amount, ht_amount, payment_status, paid_at')
      .eq('client_id', id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false }),
  ])

  if (!client) notFound()

  const { data: companyInvs } = client?.company_id
    ? await (supabase as any).from('invoices').select('ttc_amount').eq('company_id', (client as any).company_id).neq('status', 'draft').is('deleted_at', null)
    : { data: [] }

  const c    = client as any
  const invs = (invoices ?? []) as any[]

  // ── Stats ──────────────────────────────────────────────────────────────
  const validInvs  = invs.filter(i => i.status !== 'draft')
  const paidInvs   = validInvs.filter(i => i.payment_status === 'paid')
  const unpaidInvs = validInvs.filter(i => i.payment_status !== 'paid')

  const totalTTC     = validInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
  const totalHT      = validInvs.reduce((s, i) => s + Number(i.ht_amount  ?? 0), 0)
  const paidTTC      = paidInvs.reduce((s, i)  => s + Number(i.ttc_amount ?? 0), 0)
  const unpaidTTC    = unpaidInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
  const paymentRate  = validInvs.length > 0 ? Math.round((paidInvs.length / validInvs.length) * 100) : 0
  const lastInv      = invs[0]

  const now = new Date()
  const overdueInvs = unpaidInvs.filter(i => i.due_date && new Date(i.due_date) < now)

  // Avg days late (from paid invoices with due_date)
  const paidWithDue = paidInvs.filter(i => i.paid_at && i.due_date)
  const avgDaysLate = paidWithDue.length > 0
    ? Math.round(paidWithDue.reduce((s, i) => {
        const diff = (new Date(i.paid_at).getTime() - new Date(i.due_date).getTime()) / 86400000
        return s + diff
      }, 0) / paidWithDue.length)
    : 0

  // Avg days from issue_date to paid_at (payment velocity)
  const paidWithIssue = paidInvs.filter(i => i.paid_at && i.issue_date)
  const avgPayVelocity = paidWithIssue.length > 0
    ? Math.round(paidWithIssue.reduce((s, i) => {
        const diff = (new Date(i.paid_at).getTime() - new Date(i.issue_date).getTime()) / 86400000
        return s + diff
      }, 0) / paidWithIssue.length)
    : null

  // ── Next invoice prediction (avg gap between issue dates) ────────────
  const nextInvoicePrediction = (() => {
    const dates = validInvs.map((i: any) => i.issue_date).filter(Boolean).sort()
    if (dates.length < 3) return null
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push(Math.round((new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / 86400000))
    }
    const avgGap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
    if (avgGap <= 0) return null
    const lastDate = new Date(dates[dates.length - 1])
    const predictedDate = new Date(lastDate.getTime() + avgGap * 86400000)
    const daysUntil = Math.round((predictedDate.getTime() - now.getTime()) / 86400000)
    return { predictedDate, avgGap, daysUntil }
  })()

  // ── Invoice gap alert (last gap vs avg gap) ───────────────────────────
  const invoiceGapAlert = (() => {
    if (!nextInvoicePrediction) return null
    const { avgGap, daysUntil } = nextInvoicePrediction
    const overdue = -daysUntil
    if (overdue <= 0) return null
    const overduePct = Math.round((overdue / avgGap) * 100)
    return { overdue, avgGap, overduePct }
  })()

  // ── Payment reliability score (% paid on time) ───────────────────────
  const reliabilityScore = (() => {
    const paidOnTime = paidInvs.filter((i: any) => i.paid_at && i.due_date && i.paid_at <= i.due_date).length
    const total = validInvs.filter((i: any) => i.status !== 'draft').length
    if (total < 2) return null
    return { score: Math.round((paidOnTime / total) * 100), paidOnTime, total }
  })()

  // ── Aging buckets (unpaid invoices by days overdue) ────────────────────
  const agingBuckets = (() => {
    const buckets = [
      { label: 'Courant (0–30j)',  min: 0,  max: 30,  color: '#f59e0b', bg: 'bg-[#f59e0b]' },
      { label: '31–60 jours',      min: 31, max: 60,  color: '#f97316', bg: 'bg-[#f97316]' },
      { label: '61–90 jours',      min: 61, max: 90,  color: '#ef4444', bg: 'bg-[#ef4444]' },
      { label: '> 90 jours',       min: 91, max: Infinity, color: '#7f1d1d', bg: 'bg-red-900' },
    ]
    return buckets.map(b => {
      const matching = unpaidInvs.filter(i => {
        if (!i.due_date) return false
        const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000)
        return days >= b.min && days <= b.max
      })
      return {
        ...b,
        count: matching.length,
        amount: matching.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      }
    }).filter(b => b.count > 0)
  })()

  // Risk score for most recent unpaid invoice
  const latestUnpaid = unpaidInvs[0]
  const riskResult = latestUnpaid
    ? computeRisk(latestUnpaid.id, id, latestUnpaid.due_date, invs.map(i => ({ ...i, clients: { id } })))
    : null

  // Risk breakdown factors
  const paidWithDue2   = paidInvs.filter(i => i.paid_at && i.due_date)
  const lateDaysArr    = paidWithDue2.map(i => Math.round((new Date(i.paid_at).getTime() - new Date(i.due_date).getTime()) / 86400000))
  const avgLateDays2   = lateDaysArr.length > 0 ? lateDaysArr.reduce((s, d) => s + d, 0) / lateDaysArr.length : 0
  const lateCount2     = lateDaysArr.filter(d => d > 0).length
  const unpaidOldCount = unpaidInvs.filter(i => i.due_date && new Date(i.due_date) < now).length
  const unpaidRatio2   = validInvs.length > 0 ? unpaidOldCount / validInvs.length : 0
  const riskBreakdown  = [
    { label: 'Retard moyen',    value: avgLateDays2 > 0 ? `+${Math.round(avgLateDays2)}j` : 'Aucun',           ok: avgLateDays2 <= 0 },
    { label: 'Paiements tardifs', value: `${lateCount2} / ${paidWithDue2.length}`,                             ok: lateCount2 === 0 },
    { label: 'Impayés échus',   value: unpaidOldCount > 0 ? `${unpaidOldCount} facture${unpaidOldCount > 1 ? 's' : ''}` : 'Aucun', ok: unpaidOldCount === 0 },
    { label: 'Taux impayé',     value: `${Math.round(unpaidRatio2 * 100)}%`,                                   ok: unpaidRatio2 < 0.25 },
  ]

  const RISK_STYLE = {
    high:   'text-red-400 bg-red-950/30 border-red-900/40',
    medium: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/40',
    low:    'text-emerald-400 bg-emerald-950/30 border-emerald-900/40',
  }

  const typeColor = c.type === 'B2B'
    ? 'bg-[#d4a843]/10 text-[#d4a843] border-[#d4a843]/20'
    : 'bg-[#4a9eff]/10 text-[#4a9eff] border-[#4a9eff]/20'

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/clients" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Clients</Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-lg font-bold text-white truncate">{c.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/dashboard/invoices/new?client_id=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d4a843]/30 bg-[#d4a843]/10 text-xs font-bold text-[#d4a843] hover:bg-[#d4a843]/20 transition-colors">
            + Facture
          </Link>
          <Link href={`/dashboard/expenses?client=${encodeURIComponent(c.name ?? '')}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1a1b22] text-xs text-gray-400 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30 transition-colors">
            Dépenses →
          </Link>
          <ClientStatementButton clientId={id} clientName={c.name ?? 'client'} clientEmail={c.email ?? null} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>{c.type ?? 'B2B'}</span>
        {riskResult?.level && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_STYLE[riskResult.level]}`}
            title={riskResult.tooltip}>
            ⚡ {riskResult.label}
          </span>
        )}
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'CA Total (TTC)',   value: fmtTND(totalTTC)  + ' TND', color: 'text-[#d4a843]', bar: 'bg-[#d4a843]' },
          { label: 'Encaissé (TTC)',   value: fmtTND(paidTTC)   + ' TND', color: 'text-[#2dd4a0]', bar: 'bg-[#2dd4a0]' },
          { label: 'En attente (TTC)', value: fmtTND(unpaidTTC) + ' TND', color: unpaidTTC > 0 ? 'text-[#f59e0b]' : 'text-gray-500', bar: 'bg-[#f59e0b]' },
          { label: 'Taux de paiement', value: paymentRate + '%',           color: paymentRate >= 80 ? 'text-[#2dd4a0]' : paymentRate >= 50 ? 'text-[#f59e0b]' : 'text-red-400', bar: 'bg-purple-500' },
        ].map(k => (
          <div key={k.label} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${k.bar} opacity-60`} />
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">{k.label}</p>
            <p className={`text-xl font-mono font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Paid vs unpaid pie summary */}
      {totalTTC > 0 && validInvs.length >= 2 && (() => {
        const paidPct  = Math.round((paidTTC  / totalTTC) * 100)
        const unpaidPct = 100 - paidPct
        const r = 18, circ = 2 * Math.PI * r
        const paidDash  = (paidPct  / 100) * circ
        const unpaidDash = (unpaidPct / 100) * circ
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center gap-5">
            <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90">
              <circle cx="26" cy="26" r={r} fill="none" stroke="#1a1b22" strokeWidth="7" />
              <circle cx="26" cy="26" r={r} fill="none" stroke="#2dd4a0" strokeWidth="7"
                strokeDasharray={`${paidDash} ${circ - paidDash}`} strokeLinecap="round" />
              <circle cx="26" cy="26" r={r} fill="none" stroke="#f59e0b" strokeWidth="7"
                strokeDasharray={`${unpaidDash} ${circ - unpaidDash}`}
                strokeDashoffset={-paidDash} strokeLinecap="round" />
            </svg>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2dd4a0] shrink-0" />
                  <span className="text-[10px] text-gray-500">Encaissé</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-[#2dd4a0]">{paidPct}% · {fmtTND(paidTTC)} TND</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="text-[10px] text-gray-500">En attente</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-[#f59e0b]">{unpaidPct}% · {fmtTND(unpaidTTC)} TND</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Overdue amount highlight card */}
      {overdueInvs.length > 0 && (() => {
        const overdueAmt = overdueInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
        const maxDays = overdueInvs.reduce((max, i) => {
          const d = Math.floor((now.getTime() - new Date(i.due_date!).getTime()) / 86400000)
          return d > max ? d : max
        }, 0)
        const col = maxDays > 90 ? 'border-red-800/50 bg-red-950/20' : maxDays > 30 ? 'border-orange-900/50 bg-orange-950/20' : 'border-amber-900/50 bg-amber-950/20'
        const textCol = maxDays > 90 ? 'text-red-400' : maxDays > 30 ? 'text-orange-400' : 'text-amber-400'
        return (
          <div className={`border rounded-2xl px-4 py-3 flex items-center justify-between ${col}`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${textCol}`}>
                ⚠ {overdueInvs.length} facture{overdueInvs.length > 1 ? 's' : ''} en retard
              </p>
              <p className="text-[9px] text-gray-600">Retard max : {maxDays}j</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-mono font-black ${textCol}`}>{fmtTND(overdueAmt)} TND</p>
              <p className="text-[9px] text-gray-600">à encaisser</p>
            </div>
          </div>
        )
      })()}

      {/* Revenue share of total badge */}
      {totalTTC > 0 && (() => {
        const companyTotal = ((companyInvs ?? []) as any[]).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
        if (companyTotal <= 0) return null
        const share = Math.round((totalTTC / companyTotal) * 100)
        const r = 16, circ = 2 * Math.PI * r
        const filled = (share / 100) * circ
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center gap-4">
            <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
              <circle cx="22" cy="22" r={r} fill="none" stroke="#1a1b22" strokeWidth="6" />
              <circle cx="22" cy="22" r={r} fill="none" stroke="#d4a843" strokeWidth="6"
                strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
            </svg>
            <div className="flex-1">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Part du CA total</p>
              <p className="text-xl font-mono font-black text-[#d4a843]">{share}%</p>
              <p className="text-[9px] text-gray-600">{fmtTND(totalTTC)} / {fmtTND(companyTotal)} TND</p>
            </div>
            {share >= 30 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20 shrink-0">Client clé</span>}
          </div>
        )
      })()}

      {/* Payment velocity badge */}
      {avgPayVelocity !== null && paidWithIssue.length >= 2 && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Vitesse de paiement</p>
            <p className={`text-xl font-mono font-black ${
              avgPayVelocity <= 30 ? 'text-[#2dd4a0]' : avgPayVelocity <= 60 ? 'text-[#d4a843]' : 'text-red-400'
            }`}>{avgPayVelocity}j</p>
            <p className="text-[9px] text-gray-600">moy. émission → paiement</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
            avgPayVelocity <= 30 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
            avgPayVelocity <= 60 ? 'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20' :
            'text-red-400 bg-red-950/30 border-red-900/30'
          }`}>
            {avgPayVelocity <= 30 ? 'Rapide' : avgPayVelocity <= 60 ? 'Correct' : 'Lent'}
          </span>
        </div>
      )}

      {/* Next invoice prediction badge */}
      {nextInvoicePrediction && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Prochaine facture estimée</p>
            <p className="text-sm font-mono font-bold text-[#4a9eff]">
              {nextInvoicePrediction.predictedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-[9px] text-gray-600 mt-0.5">Intervalle moyen : {nextInvoicePrediction.avgGap}j</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
            nextInvoicePrediction.daysUntil < 0 ? 'text-red-400 bg-red-950/30 border-red-900/30' :
            nextInvoicePrediction.daysUntil <= 7 ? 'text-amber-400 bg-amber-950/20 border-amber-900/30' :
            'text-[#4a9eff] bg-blue-950/20 border-blue-900/30'
          }`}>
            {nextInvoicePrediction.daysUntil < 0 ? `${Math.abs(nextInvoicePrediction.daysUntil)}j dépassé` : `dans ${nextInvoicePrediction.daysUntil}j`}
          </span>
        </div>
      )}

      {/* Invoice gap alert badge */}
      {invoiceGapAlert && invoiceGapAlert.overdue >= 7 && (
        <div className="bg-[#0f1118] border border-orange-900/30 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-orange-400 uppercase tracking-wider font-bold mb-0.5">Facture en retard</p>
            <p className="text-sm font-mono font-black text-orange-300">{invoiceGapAlert.overdue}j de retard</p>
            <p className="text-[9px] text-gray-600 mt-0.5">Intervalle habituel : {invoiceGapAlert.avgGap}j</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
            invoiceGapAlert.overduePct >= 100 ? 'text-red-400 bg-red-950/30 border-red-900/30' :
            'text-orange-400 bg-orange-950/20 border-orange-900/30'
          }`}>+{invoiceGapAlert.overduePct}% du cycle</span>
        </div>
      )}

      {/* Payment reliability score badge */}
      {reliabilityScore && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Fiabilité paiement</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-mono font-black ${
                reliabilityScore.score >= 80 ? 'text-[#2dd4a0]' :
                reliabilityScore.score >= 50 ? 'text-[#d4a843]' : 'text-red-400'
              }`}>{reliabilityScore.score}%</span>
              <span className="text-xs text-gray-600">à temps</span>
            </div>
            <p className="text-[9px] text-gray-600 mt-0.5">{reliabilityScore.paidOnTime} / {reliabilityScore.total} factures payées avant échéance</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
            reliabilityScore.score >= 80 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
            reliabilityScore.score >= 50 ? 'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20' :
            'text-red-400 bg-red-950/30 border-red-900/30'
          }`}>
            {reliabilityScore.score >= 80 ? 'Excellent' : reliabilityScore.score >= 50 ? 'Moyen' : 'Faible'}
          </span>
        </div>
      )}

      {/* Lifetime value badge */}
      {totalTTC > 0 && validInvs.length >= 2 && (() => {
        const firstDate = validInvs.map((i: any) => i.issue_date).filter(Boolean).sort()[0]
        const monthsSince = firstDate ? Math.max(1, Math.round((now.getTime() - new Date(firstDate).getTime()) / (86400000 * 30))) : null
        const ltv = totalTTC
        const monthly = monthsSince ? Math.round((ltv / monthsSince) * 1000) / 1000 : null
        return (
          <div className="bg-[#0f1118] border border-[#d4a843]/20 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Valeur client à vie (LTV)</p>
              <p className="text-xl font-mono font-black text-[#d4a843]">{fmtTND(ltv)} <span className="text-sm font-normal text-gray-500">TND</span></p>
            </div>
            {monthly !== null && (
              <div className="text-right">
                <p className="text-[10px] text-gray-600 mb-0.5">CA moyen / mois</p>
                <p className="text-sm font-mono font-bold text-[#d4a843]/70">{fmtTND(monthly)} TND</p>
                <p className="text-[9px] text-gray-600">sur {monthsSince} mois</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Risk score breakdown */}
      {riskResult?.level && validInvs.length >= 2 && (
        <div className={`bg-[#0f1118] border rounded-2xl p-4 ${
          riskResult.level === 'high' ? 'border-red-900/40' : riskResult.level === 'medium' ? 'border-yellow-900/40' : 'border-emerald-900/40'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Analyse risque paiement</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_STYLE[riskResult.level]}`}>
              ⚡ {riskResult.label}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {riskBreakdown.map(f => (
              <div key={f.label} className="bg-[#0a0b0f] border border-[#1a1b22] rounded-xl p-3">
                <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">{f.label}</p>
                <p className={`text-sm font-mono font-bold ${f.ok ? 'text-[#2dd4a0]' : 'text-red-400'}`}>{f.value}</p>
              </div>
            ))}
          </div>
          {riskResult.tooltip && (
            <p className="text-[10px] text-gray-500 mt-2.5 italic">{riskResult.tooltip}</p>
          )}
        </div>
      )}

      {/* Invoice trend sparkline — last 6 months */}
      {validInvs.length > 0 && (() => {
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const label = d.toLocaleDateString('fr-FR', { month: 'short' })
          const amt = validInvs.filter(inv => (inv.issue_date ?? '').startsWith(key)).reduce((s: number, inv: any) => s + Number(inv.ttc_amount ?? 0), 0)
          return { label, amt }
        })
        const maxAmt = Math.max(...months.map(m => m.amt), 1)
        const hasData = months.some(m => m.amt > 0)
        if (!hasData) return null
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Tendance CA (6 mois)</p>
            <div className="flex items-end gap-1.5 h-14">
              {months.map((m, idx) => {
                const h = Math.max(3, Math.round((m.amt / maxAmt) * 52))
                const isLast = idx === 5
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1" title={`${m.label}: ${fmtTND(m.amt)} TND`}>
                    <div className="w-full flex items-end justify-center" style={{ height: 52 }}>
                      <div className={`w-full rounded-t-sm ${isLast ? 'bg-[#d4a843]' : m.amt > 0 ? 'bg-[#d4a843]/40' : 'bg-[#1a1b22]'}`} style={{ height: h }} />
                    </div>
                    <span className="text-[9px] text-gray-600">{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

        {/* Left: contact card */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            {/* Avatar + name */}
            <div className="px-5 py-5 border-b border-[#1a1b22] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4a843]/20 to-[#d4a843]/5 border border-[#d4a843]/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-black text-[#d4a843]">{c.name?.slice(0,1).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{c.name}</h2>
                {c.matricule_fiscal && <p className="text-xs font-mono text-gray-500 mt-0.5">{c.matricule_fiscal}</p>}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {([
                { label: 'Type',     value: c.type ?? 'B2B' },
                { label: 'Adresse',  value: [c.address, c.gouvernorat, c.postal_code].filter(Boolean).join(', ') || null },
                { label: 'Téléphone', value: c.phone },
                { label: 'Email',    value: c.email },
                { label: 'Banque',   value: c.bank_name },
                { label: 'RIB',      value: c.bank_rib, mono: true },
              ] as { label: string; value: string | null; mono?: boolean }[]).map(({ label, value, mono }) => value ? (
                <div key={label}>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</div>
                  <div className={`text-sm text-gray-300 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</div>
                </div>
              ) : null)}
            </div>

            <div className="px-5 pb-5 flex flex-col gap-2">
              <ClientDetailActions clientId={c.id} client={c} companyId={c.company_id} />
              <Link href={`/dashboard/invoices/new?client_id=${c.id}`}
                className="w-full text-center px-4 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors">
                + Nouvelle facture
              </Link>
            </div>
          </div>

          {/* Payment behaviour panel */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
            <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Comportement paiement</div>
            <div className="space-y-3">
              {[
                { label: 'Factures émises',    value: String(validInvs.length) },
                { label: 'Factures payées',    value: String(paidInvs.length) },
                { label: 'En retard actuel',   value: String(overdueInvs.length), warn: overdueInvs.length > 0 },
                { label: 'Délai moyen paiement', value: avgDaysLate > 0 ? `+${avgDaysLate}j après échéance` : avgDaysLate < 0 ? `${avgDaysLate}j avant échéance` : 'Dans les délais', warn: avgDaysLate > 14 },
                { label: 'Dernière facture',   value: lastInv?.issue_date ? new Date(lastInv.issue_date).toLocaleDateString('fr-FR') : 'Aucune' },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm font-mono font-medium ${warn ? 'text-red-400' : 'text-gray-200'}`}>{value}</span>
                </div>
              ))}

              {/* Payment rate bar */}
              <div className="pt-2">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Taux de paiement</span>
                  <span className={`text-xs font-bold ${paymentRate >= 80 ? 'text-[#2dd4a0]' : paymentRate >= 50 ? 'text-[#f59e0b]' : 'text-red-400'}`}>{paymentRate}%</span>
                </div>
                <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${paymentRate >= 80 ? 'bg-[#2dd4a0]' : paymentRate >= 50 ? 'bg-[#f59e0b]' : 'bg-red-500'}`}
                    style={{ width: `${paymentRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Credit limit card */}
          {c.credit_limit && (
            <div className={`bg-[#0f1118] border rounded-2xl p-5 ${unpaidTTC > Number(c.credit_limit) ? 'border-red-900/50' : 'border-[#1a1b22]'}`}>
              <div className={`text-xs font-bold uppercase tracking-wider mb-4 ${unpaidTTC > Number(c.credit_limit) ? 'text-red-400' : 'text-[#d4a843]'}`}>
                Plafond de crédit
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Encours actuel</span>
                  <span className={`font-mono font-bold ${unpaidTTC > Number(c.credit_limit) ? 'text-red-400' : 'text-gray-200'}`}>{fmtTND(unpaidTTC)} TND</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Plafond autorisé</span>
                  <span className="font-mono text-gray-400">{fmtTND(Number(c.credit_limit))} TND</span>
                </div>
                <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
                  {(() => {
                    const pct = Math.min(100, Math.round((unpaidTTC / Number(c.credit_limit)) * 100))
                    const col = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-[#2dd4a0]'
                    return <div className={`h-full rounded-full transition-all duration-700 ${col}`} style={{ width: `${pct}%` }} />
                  })()}
                </div>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>{Math.round((unpaidTTC / Number(c.credit_limit)) * 100)}% utilisé</span>
                  {unpaidTTC > Number(c.credit_limit) ? (
                    <span className="text-red-400 font-bold">⚠ Dépassement</span>
                  ) : (
                    <span>{fmtTND(Number(c.credit_limit) - unpaidTTC)} TND disponible</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aging buckets card */}
          {agingBuckets.length > 0 && (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4">Créances en retard</div>
              <div className="space-y-3">
                {agingBuckets.map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">{b.label}</span>
                      <span className="text-xs font-mono font-bold text-gray-200">
                        {fmtTND(b.amount)} TND
                        <span className="ml-1.5 text-[10px] text-gray-600">({b.count} fact.)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#161b27] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${b.bg}`}
                        style={{ width: `${Math.min(100, (b.amount / (unpaidTTC || 1)) * 100)}%`, opacity: 0.85 }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-1 border-t border-[#1a1b22] flex justify-between">
                  <span className="text-xs text-gray-600">Total en retard</span>
                  <span className="text-xs font-mono font-bold text-red-400">
                    {fmtTND(agingBuckets.reduce((s, b) => s + b.amount, 0))} TND
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: invoice history + timeline */}
        <div className="xl:col-span-3 space-y-5">
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <h2 className="text-sm font-bold text-gray-200">
                Historique <span className="text-gray-600 font-normal">({invs.length})</span>
              </h2>
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2dd4a0] inline-block" />{paidInvs.length} payées</span>
                {overdueInvs.length > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{overdueInvs.length} en retard</span>}
              </div>
            </div>

            {invs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center">
                  <span className="text-2xl">📄</span>
                </div>
                <p className="text-sm text-gray-500">Aucune facture pour ce client.</p>
                <Link href={`/dashboard/invoices/new?client_id=${c.id}`}
                  className="text-xs text-[#d4a843] hover:underline">
                  Créer la première facture →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a1b22]">
                      {['N° Facture','Date','Montant TTC','Statut TTN','Paiement',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b22]">
                    {invs.map((inv: any) => {
                      const isOverdue = inv.due_date && new Date(inv.due_date) < now && inv.payment_status !== 'paid'
                      return (
                        <tr key={inv.id} className="hover:bg-[#161b27] transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-[#d4a843] hover:text-[#f0c060]">
                              {inv.number ?? <span className="text-gray-600 italic">Brouillon</span>}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                            {fmtTND(Number(inv.ttc_amount ?? 0))} TND
                          </td>
                          <td className="px-4 py-3">
                            <InvoiceStatusBadge status={inv.status ?? 'draft'} />
                          </td>
                          <td className="px-4 py-3">
                            {inv.payment_status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 px-2 py-0.5 rounded-full">
                                ✓ Payée
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/30 border border-red-900/40 px-2 py-0.5 rounded-full">
                                ⚠ Retard
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-600">En attente</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isOverdue && (
                              <PaymentReminderButton
                                invoiceId={inv.id}
                                invoiceNumber={inv.number ?? 'Brouillon'}
                                clientName={c.name}
                                clientEmail={c.email}
                                clientPhone={c.phone}
                                amount={Number(inv.ttc_amount ?? 0)}
                                dueDate={inv.due_date}
                                daysOverdue={inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : 0}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity timeline */}
          {invs.length > 0 && (() => {
            type Event = { date: string; label: string; sub: string; dot: string }
            const events: Event[] = []
            for (const inv of invs) {
              const num = inv.number ? `N°\u00a0${inv.number}` : 'Brouillon'
              if (inv.issue_date) {
                events.push({
                  date: inv.issue_date,
                  label: `Facture créée — ${num}`,
                  sub: fmtTND(Number(inv.ttc_amount ?? 0)) + ' TND',
                  dot: 'bg-[#d4a843]',
                })
              }
              if (inv.status === 'validated' || inv.status === 'valid') {
                events.push({
                  date: inv.issue_date ?? inv.created_at,
                  label: `Facture validée — ${num}`,
                  sub: inv.status,
                  dot: 'bg-blue-400',
                })
              }
              if (inv.payment_status === 'paid' && inv.paid_at) {
                events.push({
                  date: inv.paid_at.slice(0, 10),
                  label: `Paiement reçu — ${num}`,
                  sub: fmtTND(Number(inv.ttc_amount ?? 0)) + ' TND',
                  dot: 'bg-[#2dd4a0]',
                })
              }
              if (inv.due_date && new Date(inv.due_date) < now && inv.payment_status !== 'paid') {
                events.push({
                  date: inv.due_date,
                  label: `Échéance dépassée — ${num}`,
                  sub: fmtTND(Number(inv.ttc_amount ?? 0)) + ' TND impayé',
                  dot: 'bg-red-500',
                })
              }
            }
            events.sort((a, b) => b.date.localeCompare(a.date))
            const shown = events.slice(0, 12)
            return (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
                <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Activité récente</h3>
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#1a1b22]" />
                  <ul className="space-y-4">
                    {shown.map((ev, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className={`shrink-0 w-3.5 h-3.5 rounded-full mt-0.5 border-2 border-[#0f1118] ${ev.dot}`} />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-200 font-medium leading-snug">{ev.label}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {ev.sub && <span className="ml-2 text-gray-700">{ev.sub}</span>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })()}
          {/* Avg days between invoices */}
          {validInvs.length >= 3 && (() => {
            const sorted = [...validInvs].filter(i => i.issue_date).sort((a: any, b: any) => a.issue_date.localeCompare(b.issue_date))
            const gaps: number[] = []
            for (let i = 1; i < sorted.length; i++) {
              const days = Math.round((new Date(sorted[i].issue_date).getTime() - new Date(sorted[i-1].issue_date).getTime()) / 86400000)
              if (days > 0) gaps.push(days)
            }
            if (gaps.length === 0) return null
            const avgGap = Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length)
            return (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Fréquence de facturation</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-black text-[#d4a843]">{avgGap}</span>
                  <span className="text-xs text-gray-500">jours entre factures (moy.)</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">
                  {avgGap <= 14 ? '⚡ Activité hebdomadaire' : avgGap <= 31 ? '📅 Activité mensuelle' : avgGap <= 90 ? '📆 Activité trimestrielle' : '🔔 Activité irrégulière'}
                </p>
              </div>
            )
          })()}

          {/* Invoice gap alert */}
          {validInvs.length >= 3 && (() => {
            const sorted = [...validInvs].filter(i => i.issue_date).sort((a: any, b: any) => a.issue_date.localeCompare(b.issue_date))
            const gaps: number[] = []
            for (let i = 1; i < sorted.length; i++) {
              const d = Math.round((new Date(sorted[i].issue_date).getTime() - new Date(sorted[i-1].issue_date).getTime()) / 86400000)
              if (d > 0) gaps.push(d)
            }
            if (!gaps.length) return null
            const avgGapAlert = Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length)
            const lastDate = new Date(sorted[sorted.length - 1].issue_date)
            const daysSinceLast = Math.round((now.getTime() - lastDate.getTime()) / 86400000)
            const isLate = daysSinceLast > avgGapAlert * 1.5
            if (!isLate) return null
            const overBy = daysSinceLast - avgGapAlert
            return (
              <div className="bg-[#0f1118] border border-amber-900/40 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-amber-400 text-lg shrink-0">⚠</span>
                <div>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Silence inhabituel</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {daysSinceLast}j depuis la dernière facture
                    <span className="text-amber-500 font-bold ml-1">(+{overBy}j vs moy. {avgGapAlert}j)</span>
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Next expected invoice prediction */}
          {validInvs.length >= 3 && (() => {
            const sorted = [...validInvs].filter(i => i.issue_date).sort((a: any, b: any) => a.issue_date.localeCompare(b.issue_date))
            const gaps: number[] = []
            for (let i = 1; i < sorted.length; i++) {
              const d = Math.round((new Date(sorted[i].issue_date).getTime() - new Date(sorted[i-1].issue_date).getTime()) / 86400000)
              if (d > 0) gaps.push(d)
            }
            if (!gaps.length) return null
            const avgGap = Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length)
            const lastDate = new Date(sorted[sorted.length - 1].issue_date)
            const predictedDate = new Date(lastDate.getTime() + avgGap * 86400000)
            const daysUntil = Math.round((predictedDate.getTime() - now.getTime()) / 86400000)
            const isPast = daysUntil < 0
            return (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prochaine facture estimée</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold text-white">
                    {predictedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isPast
                      ? 'text-amber-400 bg-amber-950/30 border-amber-900/30'
                      : daysUntil <= 7
                      ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20'
                      : 'text-gray-400 bg-[#1a1b22] border-[#252830]'
                  }`}>
                    {isPast ? `En retard de ${-daysUntil}j` : `dans ${daysUntil}j`}
                  </span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Basé sur un cycle moyen de {avgGap} jours</p>
              </div>
            )
          })()}

          {/* Best month for invoicing */}
          {validInvs.length >= 4 && (() => {
            const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
            const byMonth = Array(12).fill(0)
            for (const inv of validInvs) {
              if (inv.issue_date) byMonth[new Date(inv.issue_date).getMonth()] += Number((inv as any).ttc_amount ?? 0)
            }
            const bestIdx = byMonth.indexOf(Math.max(...byMonth))
            if (byMonth[bestIdx] === 0) return null
            const maxAmt = Math.max(...byMonth, 1)
            return (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Meilleur mois de facturation</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20">{MONTHS[bestIdx]}</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  {byMonth.map((amt, i) => {
                    const h = Math.max(2, Math.round((amt / maxAmt) * 28))
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${MONTHS[i]}: ${fmtTND(amt)} TND`}>
                        <div className="w-full flex items-end justify-center" style={{ height: 28 }}>
                          <div className={`w-full rounded-t-sm ${i === bestIdx ? 'bg-[#d4a843]' : amt > 0 ? 'bg-[#d4a843]/30' : 'bg-[#1a1b22]'}`} style={{ height: h }} />
                        </div>
                        <span className="text-[7px] text-gray-700">{MONTHS[i].slice(0,1)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Day-of-week invoice heatmap */}
          {validInvs.length >= 3 && (() => {
            const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
            const counts = [0, 0, 0, 0, 0, 0, 0]
            for (const inv of validInvs) {
              const d = inv.issue_date ? new Date(inv.issue_date).getDay() : null
              if (d !== null) counts[d] += 1
            }
            const max = Math.max(...counts, 1)
            return (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Répartition factures par jour</p>
                <div className="flex items-end gap-1.5 h-12">
                  {counts.map((cnt, i) => {
                    const h = Math.max(4, Math.round((cnt / max) * 40))
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${DOW_LABELS[i]} : ${cnt} facture${cnt !== 1 ? 's' : ''}`}>
                        <div className="w-full flex items-end justify-center" style={{ height: 40 }}>
                          <div className="w-full rounded-sm bg-[#d4a843]/70 transition-all" style={{ height: h }} />
                        </div>
                        <span className="text-[8px] text-gray-600">{DOW_LABELS[i]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
