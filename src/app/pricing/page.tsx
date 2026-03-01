'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, ChevronDown, ChevronUp, Zap, Building2, Phone } from 'lucide-react'
const FAQ = [
  {
    q: 'Puis-je changer de plan à tout moment ?',
    a: 'Oui, vous pouvez upgrader ou downgrader immédiatement. Le changement est effectif en temps réel avec un calcul au prorata pour les upgrades en cours de cycle.',
  },
  {
    q: "Que se passe-t-il à la fin de l'essai gratuit ?",
    a: "Si vous n'avez pas choisi de plan, votre compte passe automatiquement en mode limité (lecture seule). Vous pouvez toujours consulter vos factures mais la création est suspendue.",
  },
  {
    q: 'Acceptez-vous les cartes bancaires tunisiennes ?',
    a: 'Oui, via Konnect, la principale passerelle de paiement tunisienne. Toutes les cartes bancaires tunisiennes (Visa, MasterCard, CIB) sont acceptées. Nous acceptons aussi les virements bancaires.',
  },
  {
    q: "Y a-t-il un engagement de durée ?",
    a: "Non. Le plan mensuel est sans engagement. Le plan annuel offre 15% de remise mais peut être résilié à tout moment (remboursement au prorata de la période non consommée).",
  },
  {
    q: 'Le mandat de signature est-il inclus dans le plan Pro ?',
    a: 'Oui. Le mandat de signature électronique (obligatoire pour soumettre automatiquement à ElFatoora/TTN) est inclus dans le plan Pro, économisant ~350 TND/an vs un achat séparé.',
  },
]

interface Feature {
  label: string
  starter: boolean | string
  pro: boolean | string
  fiduciaire: boolean | string
}

const FEATURES: Feature[] = [
  { label: 'Factures par mois',          starter: '50',       pro: 'Illimité',  fiduciaire: 'Illimité' },
  { label: 'Utilisateurs',               starter: '1',        pro: '3',         fiduciaire: 'Illimité' },
  { label: 'Soumission TTN automatique', starter: true,       pro: true,        fiduciaire: true },
  { label: 'PDF professionnel',           starter: true,       pro: true,        fiduciaire: true },
  { label: 'Export TVA simplifié',        starter: true,       pro: true,        fiduciaire: true },
  { label: 'Mandat de signature',         starter: false,      pro: true,        fiduciaire: true },
  { label: 'Alertes rejet TTN',           starter: false,      pro: true,        fiduciaire: true },
  { label: 'Import ERP (CSV Sage/Ciel)',  starter: false,      pro: true,        fiduciaire: true },
  { label: 'Accès Flash Financing',       starter: false,      pro: true,        fiduciaire: true },
  { label: 'Dashboard multi-clients',     starter: false,      pro: false,       fiduciaire: true },
  { label: "Jusqu'à 50 PMEs clients",     starter: false,      pro: false,       fiduciaire: true },
  { label: 'Rapports TVA consolidés',     starter: false,      pro: false,       fiduciaire: true },
  { label: 'Account manager dédié',       starter: false,      pro: false,       fiduciaire: true },
  { label: 'Support',                     starter: 'Email',    pro: 'Prioritaire', fiduciaire: 'Account manager' },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true)  return <Check size={15} className="text-[#2dd4a0] mx-auto" strokeWidth={2.5} />
  if (value === false) return <X size={13} className="text-gray-700 mx-auto" strokeWidth={2} />
  return <span className="text-xs text-gray-300 font-medium">{value}</span>
}

export default function PricingPage() {
  const router = useRouter()
  const [yearly, setYearly] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const starterPrice = yearly ? '295' : '29'
  const proPrice     = yearly ? '805' : '79'
  const fidPrice     = yearly ? '2 030' : '199'

  return (
    <div className="min-h-screen bg-[#080a0f] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a1b22] px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <button onClick={() => router.push('/')} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#d4a843] flex items-center justify-center">
            <Zap size={14} className="text-black" fill="black" />
          </div>
          <span className="font-black text-sm tracking-tight">Fatoura Pro</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/login')} className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
            Connexion
          </button>
          <button onClick={() => router.push('/register')} className="text-sm bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold px-4 py-2 rounded-xl transition-colors">
            Essai gratuit 14 jours
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-20">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d4a843]/10 border border-[#d4a843]/20 text-[#d4a843] text-xs font-bold tracking-wider uppercase">
            <Zap size={11} fill="#d4a843" /> Tarification simple
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Tarifs simples et <span className="text-[#d4a843]">transparents</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            14 jours d'essai gratuit, sans carte bancaire. Passez au plan adapté à votre activité.
          </p>

          {/* Monthly / Yearly toggle */}
          <div className="inline-flex items-center gap-3 bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-1.5">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                !yearly ? 'bg-[#161b27] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                yearly ? 'bg-[#161b27] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Annuel
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#2dd4a0]/15 text-[#2dd4a0] border border-[#2dd4a0]/20">
                -15%
              </span>
            </button>
          </div>
        </div>

        {/* 3 plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* STARTER */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-3xl p-8 flex flex-col">
            <div className="space-y-1 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Starter</div>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-black text-white">{starterPrice}</span>
                <span className="text-gray-500 text-sm mb-1.5">TND/{yearly ? 'an' : 'mois'}</span>
              </div>
              <p className="text-xs text-gray-500">Parfait pour démarrer</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                '50 factures par mois',
                '1 utilisateur',
                'Soumission TTN automatique',
                'PDF professionnel',
                'Export TVA simplifié',
                'Support email',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <Check size={13} className="text-[#2dd4a0] shrink-0" strokeWidth={2.5} /> {f}
                </li>
              ))}
              {[
                'Mandat de signature',
                'Factures illimitées',
                'Multi-utilisateurs',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <X size={12} className="text-gray-700 shrink-0" strokeWidth={2} /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push('/register')}
              className="w-full py-3 border border-[#1a1b22] hover:border-[#252830] text-gray-200 font-bold text-sm rounded-xl transition-all hover:bg-[#161b27]"
            >
              Commencer l'essai gratuit
            </button>
          </div>

          {/* PRO — highlighted */}
          <div className="bg-[#0f1118] border-2 border-[#d4a843]/50 rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-[#d4a843]/5">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-[#d4a843] text-black tracking-widest uppercase shadow-lg">
                LE PLUS POPULAIRE
              </span>
            </div>

            <div className="space-y-1 mb-6">
              <div className="text-xs text-[#d4a843] uppercase tracking-widest font-bold">Pro</div>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-black text-white">{proPrice}</span>
                <span className="text-gray-500 text-sm mb-1.5">TND/{yearly ? 'an' : 'mois'}</span>
              </div>
              <p className="text-xs text-gray-500">La solution complète</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Factures illimitées',
                '3 utilisateurs',
                'Mandat de signature inclus (économisez ~350 TND/an)',
                'Export TVA complet pour DGI',
                'Alertes rejet TTN',
                'Import ERP (CSV Sage/Ciel)',
                'Support prioritaire',
                'Accès Flash Financing',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check size={13} className="text-[#d4a843] shrink-0 mt-0.5" strokeWidth={2.5} /> {f}
                </li>
              ))}
              {[
                'Dashboard fiduciaire',
                'API ERP',
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <X size={12} className="text-gray-700 shrink-0" strokeWidth={2} /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push('/register')}
              className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-sm rounded-xl transition-colors"
            >
              Commencer l'essai gratuit
            </button>
          </div>

          {/* FIDUCIAIRE */}
          <div className="bg-[#0f1118] border border-purple-500/30 rounded-3xl p-8 flex flex-col">
            <div className="space-y-1 mb-6">
              <div className="text-xs text-purple-400 uppercase tracking-widest font-bold">Fiduciaire</div>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-black text-white">{fidPrice}</span>
                <span className="text-gray-500 text-sm mb-1.5">TND/{yearly ? 'an' : 'mois'}</span>
              </div>
              <p className="text-xs text-gray-500">Pour les cabinets comptables</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Tout le plan Pro',
                "Jusqu'à 50 PMEs clients",
                'Dashboard consolidé multi-clients',
                'Mandat signature pour tous vos clients',
                'Rapports TVA consolidés',
                'Invitations clients par email',
                'Account manager dédié',
                'Facturation groupée',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check size={13} className="text-purple-400 shrink-0 mt-0.5" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push('/register')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-sm rounded-xl transition-colors"
            >
              Nous contacter
            </button>
          </div>
        </div>

        {/* ENTERPRISE — full width horizontal */}
        <div className="bg-gradient-to-r from-[#0f1118] via-[#0d1020] to-[#0f1118] border border-[#252830] rounded-3xl p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Building2 size={22} className="text-cyan-400" />
              </div>
              <div>
                <div className="text-xs text-cyan-400 uppercase tracking-widest font-bold mb-1">Enterprise</div>
                <h3 className="text-xl font-black text-white mb-1">Sur devis</h3>
                <p className="text-sm text-gray-400 max-w-lg">
                  Pour les grandes structures et intégrations ERP. SLA garanti, connecteurs officiels, formation équipe.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 md:gap-2 text-xs text-gray-400 md:flex-col md:items-end">
              {['API complète', 'SLA 99.9%', 'Formation équipe', 'Connecteurs ERP officiels', 'Audit trail complet'].map(f => (
                <span key={f} className="flex items-center gap-1.5">
                  <Check size={11} className="text-cyan-400" strokeWidth={2.5} /> {f}
                </span>
              ))}
            </div>

            <button className="shrink-0 flex items-center gap-2 px-6 py-3 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 font-bold text-sm rounded-xl transition-all hover:bg-cyan-500/5">
              <Phone size={14} /> Planifier un appel
            </button>
          </div>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-xl font-black text-white mb-6 text-center">Comparaison détaillée</h2>
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1b22]">
                  <th className="text-left px-6 py-4 text-gray-500 font-semibold w-1/2">Fonctionnalité</th>
                  <th className="text-center px-4 py-4 text-gray-300 font-bold">Starter</th>
                  <th className="text-center px-4 py-4 text-[#d4a843] font-bold">Pro</th>
                  <th className="text-center px-4 py-4 text-purple-400 font-bold">Fiduciaire</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr key={row.label} className={`border-b border-[#1a1b22]/50 ${i % 2 === 0 ? '' : 'bg-[#161b27]/30'}`}>
                    <td className="px-6 py-3 text-gray-400 text-xs">{row.label}</td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={row.starter} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={row.pro} /></td>
                    <td className="px-4 py-3 text-center"><FeatureValue value={row.fiduciaire} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-white mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#161b27] transition-colors"
                >
                  <span className="text-sm font-medium text-gray-200 pr-4">{item.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={15} className="text-[#d4a843] shrink-0" />
                    : <ChevronDown size={15} className="text-gray-500 shrink-0" />
                  }
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

        {/* CTA bottom */}
        <div className="text-center bg-gradient-to-br from-[#d4a843]/10 via-[#0f1118] to-[#0f1118] border border-[#d4a843]/20 rounded-3xl p-12 space-y-4">
          <h2 className="text-2xl font-black text-white">Prêt à commencer ?</h2>
          <p className="text-gray-400 text-sm">14 jours gratuits, sans engagement, sans carte bancaire.</p>
          <button
            onClick={() => router.push('/register')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-sm rounded-xl transition-colors shadow-lg shadow-[#d4a843]/20"
          >
            <Zap size={15} fill="black" /> Démarrer l'essai gratuit →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a1b22] py-8 text-center">
        <p className="text-xs text-gray-700">© 2025 Fatoura Pro. Tous droits réservés. Conforme ElFatoora / DGI Tunisie.</p>
      </footer>
    </div>
  )
}
