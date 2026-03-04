import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { fmtTND } from '@/lib/utils/tva-calculator'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'
import { computeRisk } from '@/components/invoice/LatePaymentRisk'
import { ClientStatementButton } from '@/components/clients/ClientStatementButton'

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
        <div className="ml-auto">
          <ClientStatementButton clientId={id} clientName={c.name ?? 'client'} />
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

        {/* Right: invoice history */}
        <div className="xl:col-span-3">
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
                      {['N° Facture','Date','Montant TTC','Statut TTN','Paiement'].map(h => (
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
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
