'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { usePlan } from '@/hooks/usePlan'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import { ChevronDown, ChevronUp, Zap, Lock } from 'lucide-react'

const STEPS = [
  { icon: '', title: 'Analyse automatique', desc: 'Vos factures TTN servent de garant. Notre algorithme analyse votre historique fiscal en temps réel.' },
  { icon: '', title: 'Score en temps réel', desc: 'Attribution d\'un score de financement basé sur votre CA validé, régularité et ancienneté TTN.' },
  { icon: '', title: 'Financement en 24h', desc: 'Acceptation de l\'offre et virement direct sur votre RIB bancaire sous 24 heures ouvrées.' },
]

const PARTNERS = [
  { name: 'STB Financement', type: 'Banque publique' },
  { name: 'Biat Leasing', type: 'Etablissement financier' },
  { name: 'Tunisia Fintech', type: 'Fintech partenaire' },
  { name: 'Attijari Factor', type: 'Factoring' },
]

const FAQ = [
  {
    q: 'Quels documents sont nécessaires ?',
    a: 'Aucun document supplémentaire n\'est requis. Vos factures validées par TTN/ElFatoora constituent automatiquement votre dossier. La connexion à Fatoura Pro suffit.',
  },
  {
    q: 'Quels taux d\'intérêt sont appliqués ?',
    a: 'Les taux sont négociés avec nos partenaires financiers. Estimation : à partir de 1,5% par mois pour les profils éligibles avec un historique TTN solide. Taux définitifs communiqués lors de l\'offre.',
  },
  {
    q: 'Mes factures sont-elles utilisées comme garantie ?',
    a: 'Vos factures TTN validées servent de référence pour évaluer votre solvabilité. Elles ne sont pas cédées ni bloquées. Vous continuez à les utiliser normalement.',
  },
  {
    q: 'Quel est le montant minimum et maximum ?',
    a: 'Entre 1 000 TND et 100 000 TND selon votre profil. Le montant éligible est calculé automatiquement à partir de votre CA des 3 derniers mois validé TTN.',
  },
  {
    q: 'Quand sera disponible Flash Financing ?',
    a: 'Nous sommes en phase de négociation avec les partenaires financiers tunisiens. Inscrivez-vous en liste d\'attente pour être parmi les premiers à en bénéficier.',
  },
]

function fmtAmount(n: number) {
  return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
}

export default function FinancingPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [validInvCount, setValidInvCount] = useState(0)
  const [last3MonthsCA, setLast3MonthsCA] = useState(0)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState(10000)
  const [duration, setDuration] = useState(6)
  const [purpose, setPurpose] = useState('bfr')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const plan = usePlan()

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)

    const [{ count }, { data: recentData }] = await Promise.all([
      supabase.from('invoices').select('id', { count: 'exact', head: true })
        .eq('company_id', activeCompany.id).eq('status', 'valid'),
      supabase.from('invoices').select('ht_amount')
        .eq('company_id', activeCompany.id).eq('status', 'valid')
        .gte('issue_date', threeMonthsAgo).lte('issue_date', today),
    ])

    setValidInvCount(count ?? 0)
    const ca = (recentData ?? []).reduce((s: number, r: any) => s + Number(r.ht_amount ?? 0), 0)
    setLast3MonthsCA(ca)
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  const isEligible = validInvCount >= 10 && last3MonthsCA > 0
  const eligibilityAmount = last3MonthsCA * 0.30
  const invNeeded = Math.max(0, 10 - validInvCount)
  const eligibilityPct = Math.min(100, (validInvCount / 10) * 100)

  // Rough monthly payment: amount / duration + flat rate
  const ratePerMonth = duration <= 1 ? 0.025 : duration <= 3 ? 0.02 : 0.015
  const totalCost = amount * (1 + ratePerMonth * duration)
  const monthlyPayment = totalCost / duration

  async function handleSubmit() {
    if (!activeCompany?.id) return
    if (!plan.canAccessFinancing) { setUpgradeOpen(true); return }
    setSubmitting(true)
    try {
      await supabase.from('financing_requests').insert({
        company_id:       activeCompany.id,
        amount_requested: amount,
        duration_months:  duration,
        purpose,
        eligible_amount:  isEligible ? eligibilityAmount : null,
        status:           'pending',
      })
      showToast('Demande reçue ! Réponse sous 48h ouvrables.')
      setSubmitted(true)
    } catch (e) {
      showToast('Erreur lors de la soumission. Réessayez.')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-10 pb-10">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        featureName="Flash Financing"
        requiredPlan="pro"
        featureBenefit="Obtenez un financement express basé sur vos factures TTN validées. Disponible dès le plan Pro."
      />
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl max-w-xs">
          {toast}
        </div>
      )}

      {/*  Header  */}
      <div className="flex flex-col items-start gap-3">
        <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25 uppercase tracking-widest">
          Bientôt disponible
        </span>
        <h1 className="text-2xl font-black text-white tracking-tight">Flash Financing</h1>
        <p className="text-gray-400 text-sm max-w-xl">
          Obtenez un financement express basé sur vos factures TTN validées. Rapide, transparent, sans paperasse.
        </p>
      </div>

      {/*  Hero  */}
      <div className="bg-gradient-to-br from-[#d4a843]/10 via-[#0f1118] to-purple-950/20 border border-[#1a1b22] rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #d4a843 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-2xl bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center animate-pulse">
              <Zap size={40} className="text-[#d4a843]" fill="#d4a843" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-white mb-3">
            Transformez vos factures en cash en <span className="text-[#d4a843]">24h</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
            Fatoura Pro analyse vos 6 derniers mois de factures validées TTN et vous connecte avec des partenaires financiers
            pour un financement instantané.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6">
            {['Sans documents', 'Réponse en 24h', 'Partenaires agréés'].map(tag => (
              <div key={tag} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="text-[#2dd4a0] font-bold"></span> {tag}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/*  Comment ça marche  */}
      <div>
        <h2 className="text-base font-bold text-white mb-5">Comment ça marche</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step, i) => (
            <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 relative">
              <div className="w-7 h-7 rounded-full bg-[#161b27] border border-[#252830] flex items-center justify-center text-[10px] font-black text-gray-400 mb-3">
                {i + 1}
              </div>
              <div className="text-2xl mb-2">{step.icon}</div>
              <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              {i < 2 && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-gray-700 text-lg"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/*  Eligibility widget  */}
      <div>
        <h2 className="text-base font-bold text-white mb-5">Votre éligibilité estimée</h2>
        {loading ? (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-8 text-center text-sm text-gray-600">Calcul en cours...</div>
        ) : isEligible ? (
          <div className="bg-[#2dd4a0]/5 border border-[#2dd4a0]/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Éligibilité estimée</div>
                <div className="text-3xl font-black text-[#2dd4a0] font-mono">{fmtAmount(eligibilityAmount)} TND</div>
                <div className="text-xs text-gray-500 mt-1">
                  Basé sur {validInvCount} factures validées TTN (3 derniers mois)
                </div>
              </div>
              <div className="w-14 h-14 rounded-xl bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 flex items-center justify-center text-2xl shrink-0">
                
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                <span>Éligibilité</span><span>100%</span>
              </div>
              <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
                <div className="h-full bg-[#2dd4a0] rounded-full w-full transition-all" />
              </div>
            </div>
            <p className="text-[10px] text-gray-600">
              Calcul indicatif : 30% du CA HT des 3 derniers mois validé TTN. Montant définitif déterminé par nos partenaires.
            </p>
          </div>
        ) : (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Progression vers l’éligibilité</div>
                <div className="text-xl font-bold text-gray-300">{validInvCount} / 10 factures validées</div>
                {invNeeded > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Encore {invNeeded} facture{invNeeded > 1 ? 's' : ''} TTN validée{invNeeded > 1 ? 's' : ''} pour débloquer
                  </div>
                )}
              </div>
              <div className="w-14 h-14 rounded-xl bg-[#161b27] border border-[#252830] flex items-center justify-center text-2xl shrink-0">
                
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
                <span>Progression</span><span>{Math.round(eligibilityPct)}%</span>
              </div>
              <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
                <div className="h-full bg-[#d4a843] rounded-full transition-all" style={{ width: `${eligibilityPct}%` }} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Continuez à soumettre des factures à TTN pour débloquer votre accès au financement.
            </p>
          </div>
        )}
      </div>

      {/*  Financing request form  */}
      <div className="bg-[#0f1118] border border-[#d4a843]/30 rounded-2xl p-6 space-y-6 relative">
        {!plan.canAccessFinancing && (
          <div className="absolute inset-0 z-10 bg-[#080a0f]/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center">
              <Lock size={22} className="text-gray-500" />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-gray-200 mb-1">Flash Financing réservé au plan Pro</div>
              <p className="text-xs text-gray-500 mb-3">Accédez au financement express sur factures TTN avec le plan Pro.</p>
              <button onClick={() => setUpgradeOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-xs rounded-xl transition-colors">
                <Zap size={12} fill="black" /> Voir le plan Pro
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={15} className="text-[#d4a843]" fill="#d4a843" />
            <h2 className="text-base font-bold text-white">Soumettre une demande de financement</h2>
          </div>
          <p className="text-xs text-gray-500">Réponse sous 48h ouvrables. Sans engagement.</p>
        </div>

        {/* Commission transparency */}
        <div className="bg-[#161b27] border border-[#252830] rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-[#2dd4a0] text-sm mt-0.5">ℹ</span>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Fatoura Pro perçoit une commission de <strong className="text-gray-300">1,5%</strong> sur le montant financé,
            versée par le partenaire financier. <strong className="text-gray-300">Aucun frais pour vous.</strong>
          </p>
        </div>

        {submitted ? (
          <div className="bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-xl p-5 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <div className="text-sm font-bold text-[#2dd4a0]">Demande soumise !</div>
            <p className="text-xs text-gray-400">Nous vous contacterons sous 48h ouvrables avec une offre personnalisée.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Amount slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Montant souhaité</label>
                <span className="font-mono text-lg font-black text-[#d4a843]">{fmtAmount(amount)} TND</span>
              </div>
              {isEligible && (
                <p className="text-[10px] text-gray-500 mb-2">
                  Estimation basée sur {fmtAmount(last3MonthsCA)} TND de CA validé TTN (3 mois) — max éligible : {fmtAmount(Math.min(eligibilityAmount, 100000))} TND
                </p>
              )}
              <input type="range" min={1000} max={isEligible ? Math.min(Math.round(eligibilityAmount), 100000) : 100000} step={1000} value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #d4a843 0%, #d4a843 ${((amount-1000)/99000)*100}%, #1a1b22 ${((amount-1000)/99000)*100}%, #1a1b22 100%)` }} />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>1 000 TND</span><span>100 000 TND</span>
              </div>
            </div>

            {/* Duration select */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Durée de remboursement</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)}
                    className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      duration === d ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:border-[#252830]'
                    }`}>
                    {d} mois
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Objet du financement</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'materiel',  label: 'Achat matériel' },
                  { id: 'stock',     label: 'Stock' },
                  { id: 'bfr',       label: 'BFR' },
                  { id: 'autre',     label: 'Autre' },
                ].map(p => (
                  <button key={p.id} type="button" onClick={() => setPurpose(p.id)}
                    className={`py-2.5 rounded-xl border text-xs font-medium transition-all text-left px-3 ${
                      purpose === p.id ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:border-[#252830]'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated monthly payment */}
            <div className="bg-[#161b27] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Mensualité estimée</div>
                <div className="text-xs text-gray-500 mt-0.5">Approximatif — taux définitif à l'offre</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-black text-white">~{fmtAmount(monthlyPayment)} TND</div>
                <div className="text-[10px] text-gray-600">x {duration} mois</div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? 'Envoi...' : <>
                <Zap size={16} fill="black" />
                Soumettre ma demande
              </>}
            </button>
            <p className="text-[10px] text-gray-600 text-center">Sans engagement. Aucune donnée transmise aux partenaires sans votre accord explicite.</p>
          </div>
        )}
      </div>

      {/*  Partners  */}
      <div>
        <h2 className="text-base font-bold text-white mb-2">Partenaires financiers</h2>
        <p className="text-xs text-gray-600 mb-4">En cours de négociation avec des établissements agréés par la BCT.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PARTNERS.map(p => (
            <div key={p.name} className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-4 flex flex-col items-center gap-2 opacity-60">
              <div className="w-10 h-10 rounded-xl bg-[#161b27] border border-[#252830] flex items-center justify-center text-gray-700 text-lg"></div>
              <div className="text-[10px] font-bold text-gray-500 text-center">{p.name}</div>
              <div className="text-[9px] text-gray-700">{p.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/*  FAQ  */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">Questions fréquentes</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-xl overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#161b27] transition-colors">
                <span className="text-sm font-medium text-gray-200 pr-4">{item.q}</span>
                {openFaq === i ? <ChevronUp size={16} className="text-[#d4a843] shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-xs text-gray-400 leading-relaxed border-t border-[#1a1b22] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/*  Legal note  */}
      <div className="text-[10px] text-gray-700 leading-relaxed border-t border-[#1a1b22] pt-4">
        Flash Financing est une fonctionnalité en cours de développement. Les montants et taux affichés sont indicatifs et ne constituent pas une offre de crédit. Toute offre de financement sera soumise à l’approbation de nos partenaires financiers agréés par la Banque Centrale de Tunisie.
      </div>
    </div>
  )
}
