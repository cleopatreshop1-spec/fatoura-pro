'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

const STEPS = ['Compte', 'Entreprise', 'Signature']

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                done ? 'border-[#2dd4a0] bg-[#2dd4a0]/15 text-[#2dd4a0]' :
                active ? 'border-[#d4a843] bg-[#d4a843] text-black' :
                'border-[#252830] text-gray-600'
              }`}>
                {done ? '' : n}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-[#d4a843]' : done ? 'text-[#2dd4a0]' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className={`h-px w-10 mb-4 mx-1 ${done ? 'bg-[#2dd4a0]' : 'bg-[#252830]'}`} />}
          </div>
        )
      })}
    </div>
  )
}

type OptionChoice = 'A' | 'B' | null

export default function MandateOnboardingPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [choice, setChoice] = useState<OptionChoice>(null)
  const [accepting, setAccepting] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleAcceptMandate() {
    if (!activeCompany?.id) return
    setAccepting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const validUntil = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const { error: e } = await supabase.from('mandates').insert({
      company_id: activeCompany.id,
      accepted_by: user!.id,
      accepted_at: new Date().toISOString(),
      seal_identifier: 'FATOURA-PRO-SEAL-2026',
      seal_valid_until: validUntil,
      scope: 'all_invoices',
      is_active: true,
    })
    if (e) setError(e.message)
    else { setDone(true); setTimeout(() => router.push('/dashboard'), 1500) }
    setAccepting(false)
  }

  async function handleUploadCert() {
    if (!certFile || !keyFile || !activeCompany?.id) return
    setUploading(true)
    setError('')
    const toBase64 = (f: File): Promise<string> =>
      new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsText(f)
      })
    try {
      const certPem = await toBase64(certFile)
      const keyPem  = await toBase64(keyFile)
      const { error: e } = await supabase.from('companies').update({
        own_cert_pem: certPem, own_key_pem: keyPem,
      }).eq('id', activeCompany.id)
      if (e) throw e
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur upload')
    }
    setUploading(false)
  }

  if (done) {
    return (
      <div className="w-full max-w-[480px]">
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-10 text-center space-y-4">
          <div className="text-5xl"></div>
          <div className="text-lg font-bold text-white">Configuration terminee !</div>
          <p className="text-sm text-gray-400">Redirection vers votre tableau de bord...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[540px]">
      <div className="text-center mb-6">
        <div className="inline-flex items-baseline">
          <span className="text-[#d4a843] font-mono text-xl font-bold tracking-wide">FATOURA</span>
          <span className="text-gray-500 font-mono text-xl font-bold">PRO</span>
        </div>
      </div>

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-8">
        <Stepper step={3} />

        <h1 className="text-sm font-bold text-white text-center mb-2">
          Configuration de la signature electronique
        </h1>
        <p className="text-xs text-gray-500 text-center mb-6">
          Choisissez comment vos factures seront signees pour la soumission TTN
        </p>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Option A */}
          <button
            type="button"
            onClick={() => setChoice('A')}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
              choice === 'A'
                ? 'border-[#d4a843] bg-[#d4a843]/5'
                : 'border-[#1a1b22] hover:border-[#252830]'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  choice === 'A' ? 'border-[#d4a843]' : 'border-[#252830]'
                }`}>
                  {choice === 'A' && <div className="w-2 h-2 rounded-full bg-[#d4a843]" />}
                </div>
                <span className="text-sm font-bold text-white">
                  Mandat Fatoura Pro
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30">
                  RECOMMANDE
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/20 text-[#2dd4a0] border border-green-900/30">
                  Economisez 300-400 TND/an
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed ml-6">
              Fatoura Pro signe vos factures avec son sceau ANCE en votre nom.
              Aucun certificat a acheter. Valable 1 an, revocable a tout moment.
            </p>
            <ul className="mt-3 ml-6 space-y-1">
              {['Pas de certificat ANCE a acheter (300-400 TND)', 'Activation immediate', 'Signature automatique a chaque soumission'].map(i => (
                <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="text-[#2dd4a0]"></span> {i}
                </li>
              ))}
            </ul>
          </button>

          {/* Option B */}
          <button
            type="button"
            onClick={() => setChoice('B')}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
              choice === 'B'
                ? 'border-[#4a9eff] bg-[#4a9eff]/5'
                : 'border-[#1a1b22] hover:border-[#252830]'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                choice === 'B' ? 'border-[#4a9eff]' : 'border-[#252830]'
              }`}>
                {choice === 'B' && <div className="w-2 h-2 rounded-full bg-[#4a9eff]" />}
              </div>
              <span className="text-sm font-bold text-white">
                Mon propre certificat ANCE
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/20 text-[#4a9eff] border border-blue-900/30">
                AVANCE
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed ml-6">
              Vous avez deja un certificat ANCE delivre par l'Agence Nationale de Certification Electronique.
              Uploadez votre fichier .pem pour signer directement.
            </p>
          </button>
        </div>

        {/* Option A: Accept mandate */}
        {choice === 'A' && (
          <div className="mt-5 p-4 bg-[#161b27] rounded-xl border border-[#d4a843]/20">
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              En acceptant ce mandat, vous autorisez Fatoura Pro a apposer son sceau electronique
              sur vos factures pour la soumission a la plateforme ElFatoura/TTN. Ce mandat est
              revocable a tout moment depuis Parametres  Mandat.
            </p>
            <button
              onClick={handleAcceptMandate}
              disabled={accepting}
              className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {accepting ? 'Activation...' : 'Accepter le mandat de signature'}
            </button>
          </div>
        )}

        {/* Option B: Upload cert */}
        {choice === 'B' && (
          <div className="mt-5 p-4 bg-[#161b27] rounded-xl border border-[#4a9eff]/20 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Certificat (.pem ou .crt)
              </label>
              <input
                type="file"
                accept=".pem,.crt,.cer"
                onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-[#252830] file:text-gray-300 hover:file:bg-[#303540]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Cle privee (.pem ou .key)
              </label>
              <input
                type="file"
                accept=".pem,.key"
                onChange={e => setKeyFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-[#252830] file:text-gray-300 hover:file:bg-[#303540]"
              />
            </div>
            <button
              onClick={handleUploadCert}
              disabled={uploading || !certFile || !keyFile}
              className="w-full bg-[#4a9eff] hover:bg-[#6eb5ff] text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {uploading ? 'Upload...' : 'Enregistrer mon certificat'}
            </button>
          </div>
        )}

        <div className="mt-5 text-center">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            Configurer plus tard 
          </Link>
        </div>
      </div>
    </div>
  )
}
