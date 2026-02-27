'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { usePlan } from '@/hooks/usePlan'
import {
  CreditCard, Download, AlertTriangle, CheckCircle2,
  Clock, Zap, ArrowUpRight, RefreshCw, Building2
} from 'lucide-react'

const PLAN_LABEL: Record<string, string> = {
  trialing:   'Essai gratuit',
  starter:    'Starter',
  pro:        'Pro',
  fiduciaire: 'Fiduciaire',
  enterprise: 'Enterprise',
}
const PLAN_COLOR: Record<string, string> = {
  trialing:   'text-blue-400  bg-blue-500/10  border-blue-500/30',
  starter:    'text-gray-300  bg-gray-500/10  border-gray-500/30',
  pro:        'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/30',
  fiduciaire: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  enterprise: 'text-cyan-400  bg-cyan-500/10  border-cyan-500/30',
}
const STATUS_LABEL: Record<string, string> = {
  trialing: 'En essai',
  active:   'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Annulé',
  paused:   'Suspendu',
}
const STATUS_COLOR: Record<string, string> = {
  trialing: 'text-blue-400  bg-blue-500/10  border-blue-500/30',
  active:   'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/30',
  past_due: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  canceled: 'text-red-400   bg-red-500/10   border-red-500/30',
  paused:   'text-gray-400  bg-gray-500/10  border-gray-500/30',
}

interface Payment {
  id: string
  created_at: string
  description: string | null
  amount: number
  status: string
  invoice_url: string | null
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTND(n: number) {
  return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(n) + ' TND'
}

export function BillingTab() {
  const router = useRouter()
  const { activeCompany } = useCompany()
  const plan = usePlan()
  const supabase = createClient()

  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const fetchPayments = useCallback(async () => {
    if (!activeCompany?.id) return
    const { data } = await supabase
      .from('payments')
      .select('id, created_at, description, amount, status, invoice_url')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setPayments((data as Payment[]) ?? [])
    setLoadingPayments(false)
  }, [activeCompany?.id]) // eslint-disable-line

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const usagePct = plan.invoiceLimit
    ? Math.round((plan.invoicesUsed / plan.invoiceLimit) * 100)
    : 0
  const usageColor = usagePct >= 90 ? '#ef4444' : usagePct >= 70 ? '#f59e0b' : '#2dd4a0'

  async function handleCancel() {
    if (!activeCompany?.id) return
    setCanceling(true)
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('company_id', activeCompany.id)
    setCanceling(false)
    setCancelConfirm(false)
    plan.refresh()
    showToast('Abonnement annulé.')
  }

  async function handleCheckout(planId: string, cycle: 'monthly' | 'yearly') {
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle: cycle }),
      })
      const data = await res.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        showToast(data.error ?? 'Erreur lors de la création du paiement.')
      }
    } catch {
      showToast('Erreur réseau.')
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#d4a843]/40 text-[#d4a843] text-sm px-4 py-3 rounded-xl shadow-2xl max-w-xs">
          {toast}
        </div>
      )}

      {/* ── Section 1: Current plan ── */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Plan actuel</div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border ${PLAN_COLOR[plan.plan] ?? PLAN_COLOR.trialing}`}>
                {PLAN_LABEL[plan.plan] ?? plan.plan}
              </span>
              {plan.status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLOR[plan.status] ?? ''}`}>
                  {STATUS_LABEL[plan.status] ?? plan.status}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push('/pricing')}
            className="flex items-center gap-1.5 text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors font-semibold shrink-0"
          >
            <ArrowUpRight size={13} /> Voir les plans
          </button>
        </div>

        {/* Trial countdown */}
        {plan.isTrialing && plan.trialDaysLeft !== null && (
          <div className={`rounded-xl p-4 border ${plan.trialDaysLeft <= 3 ? 'bg-red-900/20 border-red-500/30' : 'bg-[#161b27] border-[#252830]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                <Clock size={14} className={plan.trialDaysLeft <= 3 ? 'text-red-400' : 'text-[#d4a843]'} />
                {plan.trialDaysLeft === 0
                  ? "Dernier jour d'essai gratuit"
                  : `Essai gratuit — ${plan.trialDaysLeft} jour${plan.trialDaysLeft > 1 ? 's' : ''} restant${plan.trialDaysLeft > 1 ? 's' : ''}`
                }
              </div>
              <button
                onClick={() => router.push('/pricing')}
                className="text-xs bg-[#d4a843] hover:bg-[#f0c060] text-black font-black px-3 py-1.5 rounded-lg transition-colors"
              >
                Choisir un plan
              </button>
            </div>
            {plan.trialDaysLeft <= 7 && (
              <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((plan.trialDaysLeft / 14) * 100)}%`,
                    backgroundColor: plan.trialDaysLeft <= 3 ? '#ef4444' : '#d4a843',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Active plan info */}
        {plan.status === 'active' && plan.nextRenewalDate && (
          <div className="bg-[#161b27] rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Prochain renouvellement</div>
              <div className="text-sm font-bold text-gray-200">{fmtDate(plan.nextRenewalDate)}</div>
            </div>
            {plan.lastPaymentAmount && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Montant</div>
                <div className="text-sm font-bold text-white">{fmtTND(plan.lastPaymentAmount)}</div>
              </div>
            )}
          </div>
        )}

        {/* Expired / canceled */}
        {plan.isExpired && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-red-200 mb-1">Compte suspendu</div>
              <p className="text-xs text-red-300/70">La création de factures est désactivée. Choisissez un plan pour réactiver votre compte.</p>
            </div>
          </div>
        )}

        {/* Plan actions */}
        {plan.status === 'active' && !cancelConfirm && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => router.push('/pricing')}
              className="flex-1 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold text-xs rounded-xl transition-colors"
            >
              Changer de plan
            </button>
            <button
              onClick={() => setCancelConfirm(true)}
              className="px-4 py-2.5 border border-[#1a1b22] hover:border-red-500/30 text-gray-500 hover:text-red-400 font-medium text-xs rounded-xl transition-all"
            >
              Annuler
            </button>
          </div>
        )}

        {cancelConfirm && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-200 font-medium">Confirmer l'annulation ?</p>
            <p className="text-xs text-red-300/70">Votre accès restera actif jusqu'à la fin de la période en cours.</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {canceling ? '...' : "Confirmer l'annulation"}
              </button>
              <button onClick={() => setCancelConfirm(false)} className="px-4 py-2 border border-[#252830] text-gray-400 text-xs rounded-xl hover:bg-[#161b27] transition-colors">
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Quick upgrade for trialing/expired */}
        {(plan.isTrialing || plan.isExpired) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-[#161b27] border border-[#252830] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#d4a843]">Pro — Mensuel</span>
                <span className="text-lg font-black text-white">79 <span className="text-xs text-gray-500 font-normal">TND/mois</span></span>
              </div>
              <button onClick={() => handleCheckout('pro', 'monthly')} className="w-full py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-xs rounded-lg transition-colors">
                Souscrire →
              </button>
            </div>
            <div className="bg-[#161b27] border border-[#d4a843]/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#d4a843]">Pro — Annuel</span>
                  <span className="ml-2 text-[10px] font-black text-[#2dd4a0] bg-[#2dd4a0]/10 px-1.5 py-0.5 rounded-full border border-[#2dd4a0]/20">-15%</span>
                </div>
                <span className="text-lg font-black text-white">805 <span className="text-xs text-gray-500 font-normal">TND/an</span></span>
              </div>
              <button onClick={() => handleCheckout('pro', 'yearly')} className="w-full py-2 bg-[#d4a843]/80 hover:bg-[#d4a843] text-black font-black text-xs rounded-lg transition-colors">
                Souscrire →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Usage gauge (limited plans) ── */}
      {plan.invoiceLimit !== null && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Usage ce mois</h3>

          {usagePct >= 100 ? (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-bold text-red-200 mb-1">Limite atteinte</div>
                <p className="text-xs text-red-300/70 mb-3">
                  Passez au plan Pro pour continuer à créer des factures sans limite.
                </p>
                <button
                  onClick={() => handleCheckout('pro', 'monthly')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-xs rounded-xl transition-colors"
                >
                  <Zap size={11} fill="black" /> Upgrade maintenant
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-400">
                  Factures utilisées : <strong className="text-white">{plan.invoicesUsed}/{plan.invoiceLimit}</strong> ce mois
                </span>
                <span className="font-bold" style={{ color: usageColor }}>{usagePct}%</span>
              </div>
              <div className="h-2.5 bg-[#1a1b22] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${usagePct}%`, backgroundColor: usageColor }}
                />
              </div>
              {usagePct >= 90 && (
                <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle size={12} />
                  Vous approchez de votre limite — {plan.invoicesRemaining} facture{(plan.invoicesRemaining ?? 0) > 1 ? 's' : ''} restante{(plan.invoicesRemaining ?? 0) > 1 ? 's' : ''}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Section 3: Payment method ── */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Méthode de paiement</h3>

        <div className="bg-[#161b27] border border-[#252830] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-[#252830] rounded-md flex items-center justify-center">
              <CreditCard size={14} className="text-gray-400" />
            </div>
            <div>
              <div className="text-sm text-gray-300 font-medium">Paiement via Konnect</div>
              <div className="text-xs text-gray-600">Cartes bancaires tunisiennes acceptées</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Modes acceptés</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { icon: <CreditCard size={14} />, label: 'Carte bancaire', sub: 'Via Konnect (Visa, MC, CIB)' },
              { icon: <Building2 size={14} />, label: 'Virement bancaire', sub: 'RIB : communiqué sur demande' },
              { icon: <Zap size={14} />, label: 'Espèces', sub: 'Contactez le support' },
            ].map(m => (
              <div key={m.label} className="bg-[#161b27] border border-[#252830] rounded-xl p-3 flex items-start gap-2.5">
                <span className="text-gray-500 mt-0.5 shrink-0">{m.icon}</span>
                <div>
                  <div className="text-xs font-medium text-gray-300">{m.label}</div>
                  <div className="text-[10px] text-gray-600">{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 4: Payment history ── */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Historique des paiements</h3>
          <button onClick={fetchPayments} className="text-gray-600 hover:text-gray-400 transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>

        {loadingPayments ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#161b27] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
            Aucun paiement enregistré
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1b22]">
                  <th className="text-left pb-2.5 text-gray-500 font-semibold">Date</th>
                  <th className="text-left pb-2.5 text-gray-500 font-semibold">Description</th>
                  <th className="text-right pb-2.5 text-gray-500 font-semibold">Montant</th>
                  <th className="text-center pb-2.5 text-gray-500 font-semibold">Statut</th>
                  <th className="text-right pb-2.5 text-gray-500 font-semibold">Reçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1b22]/50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-[#161b27]/40 transition-colors">
                    <td className="py-3 text-gray-400">{fmtDate(p.created_at)}</td>
                    <td className="py-3 text-gray-300">{p.description ?? '—'}</td>
                    <td className="py-3 text-right font-mono font-bold text-white">{fmtTND(p.amount)}</td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'succeeded' ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                        p.status === 'pending'   ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                        p.status === 'failed'    ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        'text-gray-400 bg-gray-500/10 border-gray-500/20'
                      }`}>
                        {p.status === 'succeeded' ? <><CheckCircle2 size={9} /> Réussi</> :
                         p.status === 'pending'   ? 'En attente' :
                         p.status === 'failed'    ? 'Échoué' :
                         p.status === 'refunded'  ? 'Remboursé' : p.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#d4a843] hover:text-[#f0c060] transition-colors"
                        >
                          <Download size={11} /> PDF
                        </a>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[10px] text-gray-700 pt-1 border-t border-[#1a1b22]">
          Note : Les factures d'abonnement Fatoura Pro sont des PDFs simples et ne transitent pas par ElFatoora/TTN (Fatoura Pro n'est pas encore assujetti en tant que plateforme SaaS).
        </div>
      </div>
    </div>
  )
}
