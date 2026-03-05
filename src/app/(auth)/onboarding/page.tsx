'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight, Loader2, Building2, Users, FileText, Trophy } from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Votre entreprise', icon: Building2, seconds: 10 },
  { id: 2, label: 'Premier client',   icon: Users,     seconds: 15 },
  { id: 3, label: 'Première facture', icon: FileText,  seconds: 20 },
  { id: 4, label: 'Félicitations',    icon: Trophy,    seconds: 15 },
]

function validateMF(mf: string) {
  return mf.length === 0 || /^\d{7}[A-Z]{3}\d{3}$/i.test(mf.replace(/\s/g, ''))
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1
  const [companyName, setCompanyName] = useState('')
  const [mf, setMf]                   = useState('')
  const [mfError, setMfError]         = useState('')

  // Step 2
  const [clientName, setClientName] = useState('')
  const [clientMf, setClientMf]     = useState('')

  // Step 3
  const [description, setDescription] = useState('Prestation de service')
  const [amount, setAmount]           = useState('500')
  const [tva, setTva]                 = useState('19')
  const [submitting, setSubmitting]   = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [submitError, setSubmitError]     = useState('')

  // Step 4
  const [confetti, setConfetti] = useState(false)

  const htAmount  = parseFloat(amount || '0')
  const tvaAmount = htAmount * (parseFloat(tva) / 100)
  const ttcAmount = htAmount + tvaAmount

  const fmtTND = (v: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(v)

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!validateMF(mf)) { setMfError('Format invalide. Ex: 1234567ABC123'); return }
    setMfError('')
    setStep(2)
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setStep(3)
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      // Save company name if first time
      await fetch('/api/companies/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName, matricule_fiscal: mf }),
      }).catch(() => {})

      // Create client if provided
      let clientId: string | null = null
      if (clientName) {
        const cr = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: clientName, matricule_fiscal: clientMf || null }),
        })
        const cd = await cr.json()
        clientId = cd.id ?? null
      }

      // Create invoice
      const ir = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:  clientId,
          issue_date: new Date().toISOString().slice(0, 10),
          line_items: [{
            description,
            quantity:   1,
            unit_price: htAmount,
            tva_rate:   parseFloat(tva),
          }],
          notes: null,
        }),
      })
      const id = await ir.json()
      setInvoiceNumber(id?.number ?? 'FP-2026-0001')
      setConfetti(true)
      setStep(4)
    } catch (e: any) {
      setSubmitError('Erreur création facture. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0f] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a1b22] bg-[#0f1118]">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center">
              <span className="text-[#d4a843] text-[10px] font-black">F</span>
            </div>
            <span className="text-[#d4a843] font-mono text-sm font-bold">FATOURA PRO</span>
          </div>
          <span className="text-xs text-gray-600">Configuration initiale</span>
        </div>
      </div>

      {/* Progress */}
      <div className="border-b border-[#1a1b22]">
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const Icon   = s.icon
              const active = step === s.id
              const done   = step > s.id
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 ${i > 0 ? 'flex-1 justify-center' : ''}`}>
                    {i > 0 && (
                      <div className={`flex-1 h-px mx-1 ${done || active ? 'bg-[#d4a843]/40' : 'bg-[#1a1b22]'}`} />
                    )}
                    <div className={`flex items-center gap-1.5 shrink-0 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-30'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? 'bg-[#d4a843]' : active ? 'bg-[#d4a843]/20 border border-[#d4a843]/50' : 'bg-[#1a1b22]'}`}>
                        {done
                          ? <CheckCircle size={12} className="text-black" />
                          : <Icon size={11} className={active ? 'text-[#d4a843]' : 'text-gray-600'} />}
                      </div>
                      <span className={`text-[10px] font-semibold hidden sm:block ${active ? 'text-[#d4a843]' : done ? 'text-gray-400' : 'text-gray-700'}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center pt-10 px-4 pb-10">
        <div className="w-full max-w-md">

          {/* STEP 1 — Company */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <p className="text-[10px] text-[#d4a843] font-bold uppercase tracking-widest mb-1">Étape 1/4 · ~10 secondes</p>
                <h2 className="text-xl font-black text-white mb-1">Votre entreprise</h2>
                <p className="text-sm text-gray-500">3 informations suffisent pour commencer.</p>
              </div>
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom de la société *</label>
                  <input
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                    placeholder="Ex: ALPHA SARL"
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Matricule fiscal *</label>
                  <input
                    value={mf}
                    onChange={e => { setMf(e.target.value.toUpperCase()); setMfError('') }}
                    required
                    placeholder="Ex: 1234567ABC123"
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                  />
                  {mfError && <p className="text-red-400 text-xs mt-1">{mfError}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={!companyName || !mf}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Continuer <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* STEP 2 — First Client */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <div>
                <p className="text-[10px] text-[#d4a843] font-bold uppercase tracking-widest mb-1">Étape 2/4 · ~15 secondes</p>
                <h2 className="text-xl font-black text-white mb-1">Votre premier client</h2>
                <p className="text-sm text-gray-500">Ajoutez le client pour cette première facture.</p>
              </div>
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom du client *</label>
                  <input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    required
                    placeholder="Ex: BETA SA"
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Matricule fiscal <span className="text-gray-600 font-normal">(optionnel)</span></label>
                  <input
                    value={clientMf}
                    onChange={e => setClientMf(e.target.value.toUpperCase())}
                    placeholder="Ex: 9876543XYZ456"
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-3 border border-[#1a1b22] text-gray-500 text-sm rounded-xl hover:text-gray-300 transition-colors">
                  ←
                </button>
                <button type="submit" disabled={!clientName}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  Continuer <ArrowRight size={16} />
                </button>
              </div>
              <button type="button" onClick={() => setStep(3)}
                className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors">
                Passer cette étape →
              </button>
            </form>
          )}

          {/* STEP 3 — First Invoice */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-5">
              <div>
                <p className="text-[10px] text-[#d4a843] font-bold uppercase tracking-widest mb-1">Étape 3/4 · ~20 secondes</p>
                <h2 className="text-xl font-black text-white mb-1">Votre première facture</h2>
                <p className="text-sm text-gray-500">Ajustez les montants et créez en un clic.</p>
              </div>
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description *</label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Montant HT (TND) *</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="0"
                      step="0.001"
                      required
                      className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#d4a843]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">TVA (%)</label>
                    <select
                      value={tva}
                      onChange={e => setTva(e.target.value)}
                      className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#d4a843]/50"
                    >
                      <option value="0">0%</option>
                      <option value="7">7%</option>
                      <option value="13">13%</option>
                      <option value="19">19%</option>
                    </select>
                  </div>
                </div>
                {/* Live total */}
                <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Total TTC</span>
                  <span className="text-[#d4a843] font-mono font-bold text-lg">{fmtTND(ttcAmount)} TND</span>
                </div>
                {submitError && <p className="text-red-400 text-xs">{submitError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)}
                  className="px-4 py-3 border border-[#1a1b22] text-gray-500 text-sm rounded-xl hover:text-gray-300 transition-colors">
                  ←
                </button>
                <button type="submit" disabled={submitting || !description || !amount}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {submitting
                    ? <><Loader2 size={15} className="animate-spin" /> Création...</>
                    : <><CheckCircle size={15} /> Créer ma première facture</>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4 — Celebration */}
          {step === 4 && (
            <div className="text-center space-y-6">
              {/* Animated celebration */}
              <div className="relative">
                {confetti && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-sm animate-bounce"
                        style={{
                          left:            `${5 + (i * 4.7) % 90}%`,
                          top:             `${10 + (i * 7.3) % 60}%`,
                          backgroundColor: ['#d4a843','#2dd4a0','#4a9eff','#f472b6','#a78bfa'][i % 5],
                          animationDelay:  `${(i * 0.1) % 0.8}s`,
                          animationDuration: `${0.5 + (i * 0.13) % 0.7}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="bg-gradient-to-br from-[#0f1118] to-[#161b27] border border-[#d4a843]/30 rounded-2xl p-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <p className="text-[10px] text-[#d4a843] font-bold uppercase tracking-widest mb-2">Félicitations!</p>
                  <h2 className="text-xl font-black text-white mb-2">Vous êtes prêt!</h2>
                  {invoiceNumber && (
                    <div className="bg-[#1a1b22] rounded-xl px-4 py-2.5 inline-block mt-2 mb-3">
                      <p className="text-xs text-gray-500 mb-0.5">Facture créée</p>
                      <p className="text-[#d4a843] font-mono font-bold">{invoiceNumber}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-[#1a1b22] rounded-xl p-3">
                      <p className="text-lg font-black text-[#2dd4a0]">85</p>
                      <p className="text-[10px] text-gray-500">Score fiscal</p>
                    </div>
                    <div className="bg-[#1a1b22] rounded-xl p-3">
                      <p className="text-lg font-black text-[#d4a843]">5</p>
                      <p className="text-[10px] text-gray-500">Points gagnés</p>
                    </div>
                    <div className="bg-[#1a1b22] rounded-xl p-3">
                      <p className="text-lg font-black text-white">🔥 1</p>
                      <p className="text-[10px] text-gray-500">Jour de série</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors"
                >
                  Voir mon tableau de bord <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => {
                    const text = `Je viens de créer ma première facture électronique certifiée sur Fatoura Pro 🇹🇳✅\n\nhttps://fatoura.pro`
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold rounded-xl transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Partager sur WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
