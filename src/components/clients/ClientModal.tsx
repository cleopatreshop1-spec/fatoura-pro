'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const GOUVERNORATS = [
  'Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte',
  'Beja','Jendouba','Kef','Siliana','Sousse','Monastir','Mahdia','Sfax',
  'Kairouan','Kasserine','Sidi Bouzid','Gabes','Medenine','Tataouine',
  'Gafsa','Tozeur','Kebili',
]

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/

const schema = z.object({
  type:              z.enum(['B2B', 'B2C']),
  name:              z.string().min(2, 'Nom requis (min. 2 caracteres)'),
  matricule_fiscal:  z.string().optional(),
  address:           z.string().optional(),
  gouvernorat:       z.string().optional(),
  postal_code:       z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().email('Email invalide').optional().or(z.literal('')),
  bank_name:         z.string().optional(),
  bank_rib:          z.string().optional(),
  credit_limit:      z.string().optional(),
}).superRefine((data, ctx) => {
  const mf = data.matricule_fiscal?.trim()
  if (data.type === 'B2B' && mf && mf !== 'PARTICULIER' && !MF_REGEX.test(mf)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Format invalide. Ex: 1234567A/A/M/000', path: ['matricule_fiscal'] })
  }
})

type FormData = z.infer<typeof schema>

export type ClientRecord = {
  id?: string; type?: string; name?: string
  matricule_fiscal?: string | null; address?: string | null
  gouvernorat?: string | null; postal_code?: string | null
  phone?: string | null; email?: string | null
  bank_name?: string | null; bank_rib?: string | null
  credit_limit?: number | null
}

interface Props {
  open: boolean; onClose: () => void; onSaved: () => void
  companyId: string; initial?: ClientRecord
}

const IC = 'w-full bg-[#0a0b0f] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const EC = 'text-xs text-red-400 mt-1'
const SH = 'text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4'

export function ClientModal({ open, onClose, onSaved, companyId, initial }: Props) {
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showBank, setShowBank] = useState(false)

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'B2B', name: '', matricule_fiscal: '', address: '', gouvernorat: '', postal_code: '', phone: '', email: '', bank_name: '', bank_rib: '', credit_limit: '' },
  })

  const clientType = watch('type')

  useEffect(() => {
    if (!open) return
    reset({
      type:             (initial?.type as 'B2B' | 'B2C') ?? 'B2B',
      name:             initial?.name ?? '',
      matricule_fiscal: initial?.matricule_fiscal ?? '',
      address:          initial?.address ?? '',
      gouvernorat:      initial?.gouvernorat ?? '',
      postal_code:      initial?.postal_code ?? '',
      phone:            initial?.phone ?? '',
      email:            initial?.email ?? '',
      bank_name:        initial?.bank_name ?? '',
      bank_rib:         initial?.bank_rib ?? '',
      credit_limit:     initial?.credit_limit != null ? String(initial.credit_limit) : '',
    })
    setServerError('')
    setShowBank(!!(initial?.bank_name || initial?.bank_rib))
  }, [open, initial, reset])

  async function onSubmit(data: FormData) {
    setSaving(true)
    setServerError('')
    const supabase = createClient()
    const payload = {
      company_id: companyId, type: data.type, name: data.name,
      matricule_fiscal: data.matricule_fiscal || null,
      address: data.address || null, gouvernorat: data.gouvernorat || null,
      postal_code: data.postal_code || null, phone: data.phone || null,
      email: data.email || null, bank_name: data.bank_name || null,
      bank_rib: data.bank_rib || null,
      credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : null,
    }
    const { error } = isEdit
      ? await supabase.from('clients').update(payload).eq('id', initial!.id!)
      : await supabase.from('clients').insert(payload)
    if (error) { setServerError(error.message); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[520px] bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1b22] shrink-0">
          <h2 className="text-sm font-bold text-white">{isEdit ? 'Modifier le client' : 'Ajouter un client'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="overflow-y-auto max-h-[calc(90vh-130px)] px-6 py-5 space-y-6">

            {/* Identification */}
            <section>
              <div className={SH}>Identification</div>
              <div className="mb-4">
                <label className={LC}>Type de client</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['B2B', 'B2C'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setValue('type', t)}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                        clientType === t
                          ? t === 'B2B' ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843]' : 'border-[#4a9eff] bg-[#4a9eff]/10 text-[#4a9eff]'
                          : 'border-[#1a1b22] text-gray-500 hover:border-[#252830]'
                      }`}>
                      {t === 'B2B' ? ' B2B  Société' : ' B2C  Particulier'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={LC}>{clientType === 'B2B' ? 'Raison sociale *' : 'Nom complet *'}</label>
                  <input {...register('name')} placeholder={clientType === 'B2B' ? 'Ma Société SARL' : 'Mohamed Ben Ali'} className={IC} />
                  {errors.name && <p className={EC}>{errors.name.message}</p>}
                </div>
                <div>
                  <label className={LC}>Matricule fiscal {clientType === 'B2B' ? '' : '(optionnel)'}</label>
                  <input {...register('matricule_fiscal')} placeholder="1234567A/A/M/000 ou PARTICULIER" className={`${IC} font-mono`} />
                  <p className="text-[10px] text-gray-600 mt-1">Format: 1234567A/A/M/000  laisser vide ou &quot;PARTICULIER&quot; pour les B2C</p>
                  {errors.matricule_fiscal && <p className={EC}>{errors.matricule_fiscal.message}</p>}
                </div>
              </div>
            </section>

            {/* Coordonnées */}
            <section>
              <div className={SH}>Coordonnées</div>
              <div className="space-y-3">
                <div>
                  <label className={LC}>Adresse</label>
                  <textarea {...register('address')} rows={2} placeholder="Rue, Cité, Code postal..." className={`${IC} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Gouvernorat</label>
                    <select {...register('gouvernorat')} className={IC}>
                      <option value="">-- Choisir --</option>
                      {GOUVERNORATS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LC}>Code postal</label>
                    <input {...register('postal_code')} placeholder="1000" className={`${IC} font-mono`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Telephone</label>
                    <input {...register('phone')} placeholder="+216 XX XXX XXX" className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Email</label>
                    <input {...register('email')} type="email" placeholder="contact@societe.tn" className={IC} />
                    {errors.email && <p className={EC}>{errors.email.message}</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Banque (collapsible) */}
            <section>
              <button type="button" onClick={() => setShowBank(b => !b)}
                className="flex items-center gap-2 text-xs hover:text-gray-200 transition-colors">
                <ChevronDown size={14} className={`text-[#d4a843] transition-transform ${showBank ? '' : '-rotate-90'}`} />
                <span className="font-bold text-[#d4a843] uppercase tracking-wider">Banque</span>
                <span className="text-gray-600">(optionnel)</span>
              </button>
              {showBank && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Nom de la banque</label>
                    <input {...register('bank_name')} placeholder="STB, BNA, BIAT..." className={IC} />
                  </div>
                  <div>
                    <label className={LC}>RIB (20 chiffres)</label>
                    <input {...register('bank_rib')} placeholder="07 XXX..." className={`${IC} font-mono`} />
                  </div>
                </div>
              )}
            </section>

            {/* Credit limit */}
            <section>
              <div className={SH}>Plafond de crédit <span className="normal-case text-gray-600 font-normal">(optionnel)</span></div>
              <div>
                <label className={LC}>Plafond TTC (TND)</label>
                <input {...register('credit_limit')} type="number" step="0.001" min="0" placeholder="ex: 5000.000" className={`${IC} font-mono`} />
                <p className="text-[10px] text-gray-600 mt-1">Un avertissement s&apos;affichera si l&apos;encours dépasse ce montant.</p>
              </div>
            </section>

            {serverError && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">{serverError}</div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[#1a1b22] flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300 hover:bg-white/5 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
