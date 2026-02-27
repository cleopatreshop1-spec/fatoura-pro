'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOUVERNORATS = [
  'Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte',
  'Beja','Jendouba','Kef','Siliana','Sousse','Monastir','Mahdia','Sfax',
  'Kairouan','Kasserine','Sidi Bouzid','Gabes','Medenine','Tataouine',
  'Gafsa','Tozeur','Kebili',
]

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/

const schema = z.object({
  name:              z.string().min(2, 'Nom requis'),
  matricule_fiscal:  z.string().optional().refine(v => !v || v === 'PARTICULIER' || MF_REGEX.test(v), {
    message: 'Format: 1234567A/A/M/000 ou PARTICULIER',
  }),
  address:           z.string().min(5, 'Adresse requise'),
  gouvernorat:       z.string().min(1, 'Gouvernorat requis'),
  phone:             z.string().regex(/^(\+216\s?)?[2-9]\d{7}$/, 'Format: +216 XX XXX XXX').optional().or(z.literal('')),
  email:             z.string().email('Email invalide').optional().or(z.literal('')),
  tva_regime:        z.enum(['reel','forfait','exonere']),
  bank_name:         z.string().optional(),
  bank_rib:          z.string().optional().refine(v => !v || /^\d{20}$/.test(v.replace(/\s/g,'')), {
    message: 'RIB: 20 chiffres',
  }),
  invoice_prefix:    z.string().min(1).max(10).regex(/^[A-Z0-9-]+$/).optional(),
})
type FormData = z.infer<typeof schema>

const IC = 'w-full bg-[#161b27] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors text-sm'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const EC = 'text-xs text-red-400 mt-1'

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

function RegisterCompanyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fiduciaire_token = searchParams.get('fiduciaire_token')
  const [serverError, setServerError] = useState('')
  const [showBank, setShowBank] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tva_regime: 'reel', invoice_prefix: 'FP' },
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) { setServerError('Session expiree. Reconnectez-vous.'); return }

    const { error } = await supabase.from('companies').insert({
      owner_id: user.id,
      name: data.name,
      matricule_fiscal: data.matricule_fiscal || null,
      address: `${data.address}, ${data.gouvernorat}`,
      phone: data.phone || null,
      email: data.email || null,
      tva_regime: data.tva_regime,
      bank_name: data.bank_name || null,
      bank_rib: data.bank_rib || null,
      invoice_prefix: data.invoice_prefix || 'FP',
      invoice_counter: 0,
    })

    if (error) { setServerError(error.message); return }

    // Auto-accept fiduciaire invitation if token present
    if (fiduciaire_token) {
      await fetch('/api/fiduciaire/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiduciaire_token }),
      })
    }

    router.push('/dashboard/settings/mandate')
  }

  return (
    <div className="w-full max-w-[520px] page-enter">
      <div className="text-center mb-6">
        <div className="inline-flex items-baseline">
          <span className="text-[#d4a843] font-mono text-xl font-bold tracking-wide">FATOURA</span>
          <span className="text-gray-500 font-mono text-xl font-bold">PRO</span>
        </div>
      </div>

      {fiduciaire_token && (
        <div className="mb-4 flex items-center gap-2.5 bg-[#d4a843]/10 border border-[#d4a843]/30 rounded-xl px-4 py-3">
          <span className="text-[#d4a843] text-sm">🔗</span>
          <span className="text-xs text-[#d4a843] font-medium">
            Invitation fiduciaire — votre cabinet sera lié automatiquement
          </span>
        </div>
      )}

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-8">
        <Stepper step={2} />

        <h1 className="text-sm font-bold text-white text-center mb-6">
          Votre entreprise
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={LC}>Nom de la societe / Personne *</label>
            <input {...register('name')} placeholder="Ma Societe SARL" className={IC} />
            {errors.name && <p className={EC}>{errors.name.message}</p>}
          </div>

          <div>
            <label className={LC}>Matricule fiscal</label>
            <input {...register('matricule_fiscal')} placeholder="1234567A/A/M/000 ou PARTICULIER"
              className={`${IC} font-mono`} />
            <p className="text-[10px] text-gray-600 mt-1">Laissez vide si particulier sans MF</p>
            {errors.matricule_fiscal && <p className={EC}>{errors.matricule_fiscal.message}</p>}
          </div>

          <div>
            <label className={LC}>Adresse complete *</label>
            <textarea {...register('address')} rows={2}
              placeholder="Rue, Cite, Code postal"
              className={`${IC} resize-none`} />
            {errors.address && <p className={EC}>{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Gouvernorat *</label>
              <select {...register('gouvernorat')} className={IC}>
                <option value="">-- Choisir --</option>
                {GOUVERNORATS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.gouvernorat && <p className={EC}>{errors.gouvernorat.message}</p>}
            </div>

            <div>
              <label className={LC}>Regime TVA *</label>
              <select {...register('tva_regime')} className={IC}>
                <option value="reel">Regime reel</option>
                <option value="forfait">Forfait</option>
                <option value="exonere">Exonere</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Telephone</label>
              <input {...register('phone')} placeholder="+216 XX XXX XXX" className={IC} />
              {errors.phone && <p className={EC}>{errors.phone.message}</p>}
            </div>

            <div>
              <label className={LC}>Email professionnel</label>
              <input {...register('email')} type="email" placeholder="contact@societe.tn" className={IC} />
              {errors.email && <p className={EC}>{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className={LC}>Prefixe facture</label>
            <input {...register('invoice_prefix')} placeholder="FP"
              className={`${IC} font-mono uppercase w-28`} />
            <p className="text-[10px] text-gray-600 mt-1">Ex: FP  factures FP-2026-0001</p>
            {errors.invoice_prefix && <p className={EC}>{errors.invoice_prefix.message}</p>}
          </div>

          <div>
            <button type="button" onClick={() => setShowBank(b => !b)}
              className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 transition-colors">
              <span className="text-[#d4a843]">{showBank ? '' : ''}</span>
              Coordonnees bancaires (optionnel)
            </button>

            {showBank && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={LC}>Banque</label>
                  <input {...register('bank_name')} placeholder="STB, BNA, BIAT..." className={IC} />
                </div>
                <div>
                  <label className={LC}>RIB (20 chiffres)</label>
                  <input {...register('bank_rib')} placeholder="07 XXX XXXXXXXXXXXXXXXX XX"
                    className={`${IC} font-mono`} />
                  {errors.bank_rib && <p className={EC}>{errors.bank_rib.message}</p>}
                </div>
              </div>
            )}
          </div>

          {serverError && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-sm">
            {isSubmitting ? 'Enregistrement...' : 'Creer mon espace Fatoura Pro '}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function RegisterCompanyPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-[520px] py-20 text-center text-sm text-gray-600">Chargement...</div>}>
      <RegisterCompanyForm />
    </Suspense>
  )
}
