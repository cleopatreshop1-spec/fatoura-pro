'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, ArrowRight, Loader2, ChevronDown } from 'lucide-react'

const COMPANY_TYPES = [
  { value: 'sa',          label: 'Société Anonyme (SA)',        fineMax: '50,000 TND', risk: 'ÉLEVÉ' },
  { value: 'sarl',        label: 'SARL / SUARL',                fineMax: '20,000 TND', risk: 'ÉLEVÉ' },
  { value: 'entreprise',  label: 'Entreprise individuelle',      fineMax: '5,000 TND',  risk: 'MOYEN' },
  { value: 'association', label: 'Association / ONG',            fineMax: '2,000 TND',  risk: 'FAIBLE' },
]

const CHECKLIST = [
  { id: 'ttn',      label: 'Je soumets mes factures B2B à TTN' },
  { id: 'sign',     label: 'Mes factures sont signées électroniquement (XAdES)' },
  { id: 'archive',  label: 'J\'archive mes factures depuis 10+ ans' },
  { id: 'xml',      label: 'Mes factures sont au format XML structuré' },
  { id: 'deadline', label: 'Je soumets dans les 24h après émission' },
]

function validateMF(mf: string) {
  return /^\d{7}[A-Z]{3}\d{3}$/.test(mf.toUpperCase().replace(/\s/g, ''))
}

export default function VerifierPage() {
  const [step, setStep]         = useState<'form' | 'result' | 'capture'>('form')
  const [mf, setMf]             = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [checks, setChecks]     = useState<Record<string, boolean>>({})
  const [email, setEmail]       = useState('')
  const [sending, setSending]   = useState(false)
  const [done, setDone]         = useState(false)
  const [mfError, setMfError]   = useState('')

  const typeConfig = COMPANY_TYPES.find(t => t.value === companyType)
  const checkCount = Object.values(checks).filter(Boolean).length
  const totalChecks = CHECKLIST.length
  const complianceScore = Math.round((checkCount / totalChecks) * 100)
  const riskLevel = complianceScore >= 80 ? 'FAIBLE' : complianceScore >= 60 ? 'MOYEN' : 'ÉLEVÉ'
  const riskColor = riskLevel === 'FAIBLE' ? '#2dd4a0' : riskLevel === 'MOYEN' ? '#f59e0b' : '#ef4444'

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!validateMF(mf) && mf.length > 0) {
      setMfError('Format invalide. Ex: 1234567ABC123')
      return
    }
    setMfError('')
    setStep('result')
  }

  async function handleCapture(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    await fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, matricule_fiscal: mf, company_type: companyType, company_name: companyName }),
    })
    setDone(true)
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-[#080a0f]">
      {/* Top bar */}
      <div className="border-b border-[#1a1b22] bg-[#0f1118]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center">
              <span className="text-[#d4a843] text-[10px] font-black">F</span>
            </div>
            <span className="text-[#d4a843] font-mono text-sm font-bold">FATOURA</span>
            <span className="text-gray-600 font-mono text-sm font-bold">PRO</span>
          </Link>
          <Link
            href="/register"
            className="text-xs font-bold px-3 py-1.5 bg-[#d4a843] text-black rounded-lg hover:bg-[#f0c060] transition-colors"
          >
            Essai gratuit →
          </Link>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-[#d4a843]/10 border border-[#d4a843]/30 flex items-center justify-center mx-auto mb-5">
            <Shield size={26} className="text-[#d4a843]" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">
            Vérificateur de Conformité TTN
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Évaluez votre risque fiscal en 60 secondes.<br />
            <span className="text-[#d4a843] font-semibold">Gratuit · Aucune inscription requise</span>
          </p>
        </div>

        {/* Step: Form */}
        {step === 'form' && (
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Matricule fiscal
                </label>
                <input
                  value={mf}
                  onChange={e => { setMf(e.target.value.toUpperCase()); setMfError('') }}
                  placeholder="Ex: 1234567ABC123"
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                />
                {mfError && <p className="text-red-400 text-xs mt-1">{mfError}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Nom de l'entreprise <span className="text-gray-600 font-normal">(optionnel)</span>
                </label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Votre raison sociale"
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Forme juridique
                </label>
                <div className="relative">
                  <select
                    value={companyType}
                    onChange={e => setCompanyType(e.target.value)}
                    required
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#d4a843]/50 appearance-none"
                  >
                    <option value="">Choisir...</option>
                    {COMPANY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Auto-évaluation de conformité
                </label>
                <div className="space-y-2">
                  {CHECKLIST.map(item => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checks[item.id] ?? false}
                        onChange={e => setChecks(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        className="w-4 h-4 accent-[#d4a843]"
                      />
                      <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!companyType}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Analyser mon risque TTN
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Step: Result */}
        {step === 'result' && (
          <div className="space-y-4">
            {/* Risk score */}
            <div className="bg-[#0f1118] border rounded-2xl p-6 text-center" style={{ borderColor: riskColor + '40' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: riskColor }}>
                Niveau de risque
              </p>
              <div className="text-5xl font-black mb-2" style={{ color: riskColor }}>
                {riskLevel}
              </div>
              <p className="text-gray-500 text-sm">Score de conformité : <span className="text-white font-bold">{complianceScore}%</span></p>
              <div className="mt-4 h-2 bg-[#1a1b22] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${complianceScore}%`, backgroundColor: riskColor }}
                />
              </div>
            </div>

            {/* Fine exposure */}
            {typeConfig && riskLevel !== 'FAIBLE' && (
              <div className="bg-[#1a0a0a] border border-red-900/40 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-bold text-sm mb-1">Exposition aux amendes DGI</p>
                    <p className="text-red-400 font-mono text-2xl font-black">Jusqu'à {typeConfig.fineMax}</p>
                    <p className="text-gray-500 text-xs mt-1">Par facture papier non soumise à TTN (Art. 18, loi finances 2024)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist results */}
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Détail par critère</p>
              <div className="space-y-2">
                {CHECKLIST.map(item => {
                  const ok = checks[item.id] ?? false
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      {ok
                        ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                        : <AlertTriangle size={14} className="text-red-400 shrink-0" />}
                      <span className={`text-xs ${ok ? 'text-gray-400' : 'text-gray-300'}`}>{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <button
                onClick={() => setStep('capture')}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors"
              >
                Recevoir le rapport PDF complet par email
                <ArrowRight size={15} />
              </button>
              <Link
                href="/register"
                className="w-full flex items-center justify-center gap-2 py-3 bg-transparent border border-[#1a1b22] hover:border-[#d4a843]/40 text-gray-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Régulariser maintenant — Essai 30 jours gratuit
              </Link>
              <button
                onClick={() => setStep('form')}
                className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
              >
                ← Recommencer
              </button>
            </div>
          </div>
        )}

        {/* Step: Email capture */}
        {step === 'capture' && !done && (
          <div className="space-y-4">
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6">
              <p className="text-white font-bold mb-1">Recevoir votre rapport complet</p>
              <p className="text-gray-500 text-sm mb-5">
                Nous vous enverrons un rapport PDF détaillé avec les étapes de régularisation.
              </p>
              <form onSubmit={handleCapture} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                />
                <button
                  type="submit"
                  disabled={sending || !email}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  {sending ? 'Envoi...' : 'Recevoir mon rapport'}
                </button>
              </form>
              <p className="text-[10px] text-gray-600 mt-3 text-center">
                Aucun spam · Désabonnement en 1 clic
              </p>
            </div>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-700/40 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg mb-2">Rapport envoyé !</p>
              <p className="text-gray-500 text-sm">Vérifiez votre boîte mail dans les prochaines minutes.</p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors"
            >
              Commencer gratuitement → 30 jours offerts
            </Link>
          </div>
        )}

        {/* Social proof footer */}
        <p className="text-center text-xs text-gray-700 mt-10">
          Fatoura Pro — La facturation électronique tunisienne · Conforme TTN · XAdES · DGI
        </p>
      </div>
    </div>
  )
}
