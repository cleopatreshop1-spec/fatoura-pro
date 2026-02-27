'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCompany } from '@/contexts/CompanyContext'
import { createClient } from '@/lib/supabase/client'

const GOUVERNORATS = ['Tunis','Ariana','Ben Arous','Manouba','Nabeul','Zaghouan','Bizerte','Beja','Jendouba','Kef','Siliana','Sousse','Monastir','Mahdia','Sfax','Kairouan','Kasserine','Sidi Bouzid','Gabes','Medenine','Tataouine','Gafsa','Tozeur','Kebili']

const schema = z.object({
  name: z.string().min(2,'Nom requis'),
  matricule_fiscal: z.string().optional(),
  tva_regime: z.enum(['reel','forfait','exonere']).optional(),
  address: z.string().optional(),
  gouvernorat: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  bank_name: z.string().optional(),
  bank_rib: z.string().optional(),
  invoice_prefix: z.string().min(1).max(5).regex(/^[A-Z0-9-]+$/).optional(),
  default_payment_terms: z.string().optional(),
})
type F = z.infer<typeof schema>
const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const SH = 'text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4 pt-2'

export function CompanyTab() {
  const { activeCompany, refreshCompanies } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!activeCompany) return
    const c = activeCompany as any
    setLogoUrl(c.logo_url ?? null)
    reset({
      name: c.name ?? '', matricule_fiscal: c.matricule_fiscal ?? '',
      tva_regime: c.tva_regime ?? 'reel', address: c.address ?? '',
      gouvernorat: c.gouvernorat ?? '', postal_code: c.postal_code ?? '',
      phone: c.phone ?? '', phone2: c.phone2 ?? '',
      email: c.email ?? '', website: c.website ?? '',
      bank_name: c.bank_name ?? '', bank_rib: c.bank_rib ?? '',
      invoice_prefix: c.invoice_prefix ?? 'FP',
      default_payment_terms: c.default_payment_terms ?? '',
    })
  }, [activeCompany, reset])

  async function handleLogoFile(file: File) {
    if (!activeCompany?.id) return
    if (file.size > 2 * 1024 * 1024) { alert('Fichier trop lourd (max 2 Mo)'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${activeCompany.id}/logo.${ext}`
    await supabase.storage.from('logos').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', activeCompany.id)
    setLogoUrl(publicUrl)
    setUploading(false)
  }

  async function onSubmit(data: F) {
    if (!activeCompany?.id) return
    setSaving(true); setSaved(false)
    await supabase.from('companies').update({
      name: data.name, matricule_fiscal: data.matricule_fiscal || null,
      tva_regime: data.tva_regime, address: data.address || null,
      gouvernorat: data.gouvernorat || null, postal_code: data.postal_code || null,
      phone: data.phone || null, email: data.email || null,
      bank_name: data.bank_name || null, bank_rib: data.bank_rib || null,
      invoice_prefix: data.invoice_prefix || 'FP',
    }).eq('id', activeCompany.id)
    await refreshCompanies()
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Logo */}
      <div>
        <div className={SH}>Logo</div>
        <div className="flex items-center gap-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-[#252830] hover:border-[#d4a843] flex items-center justify-center cursor-pointer overflow-hidden transition-colors bg-[#161b27]"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-gray-700">{uploading ? '...' : ''}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>JPG, PNG ou SVG  max 2 Mo</p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-[#d4a843] hover:underline text-xs">
              {logoUrl ? 'Remplacer' : 'Telecharger'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
        </div>
      </div>

      {/* Identity */}
      <div>
        <div className={SH}>Identite</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={LC}>Raison sociale *</label>
            <input {...register('name')} className={IC} />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className={LC}>Matricule fiscal</label>
            <input {...register('matricule_fiscal')} placeholder="1234567A/A/M/000" className={`${IC} font-mono`} />
          </div>
          <div>
            <label className={LC}>Regime TVA</label>
            <select {...register('tva_regime')} className={IC}>
              <option value="reel">Regime reel</option>
              <option value="forfait">Forfait</option>
              <option value="exonere">Exonere</option>
            </select>
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <div className={SH}>Adresse</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={LC}>Adresse</label>
            <textarea {...register('address')} rows={2} className={`${IC} resize-none`} />
          </div>
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
      </div>

      {/* Contact */}
      <div>
        <div className={SH}>Contact</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LC}>Telephone principal</label>
            <input {...register('phone')} placeholder="+216 XX XXX XXX" className={IC} />
          </div>
          <div>
            <label className={LC}>Telephone secondaire</label>
            <input {...register('phone2')} placeholder="Optionnel" className={IC} />
          </div>
          <div>
            <label className={LC}>Email professionnel</label>
            <input {...register('email')} type="email" className={IC} />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className={LC}>Site web</label>
            <input {...register('website')} placeholder="https://..." className={IC} />
          </div>
        </div>
      </div>

      {/* Bank */}
      <div>
        <div className={SH}>Banque</div>
        <p className="text-[10px] text-gray-600 mb-3">Apparaitra sur vos factures PDF</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LC}>Nom de la banque</label>
            <input {...register('bank_name')} placeholder="STB, BNA, BIAT..." className={IC} />
          </div>
          <div>
            <label className={LC}>RIB complet</label>
            <input {...register('bank_rib')} placeholder="07 XXX..." className={`${IC} font-mono`} />
          </div>
        </div>
      </div>

      {/* Invoice preferences */}
      <div>
        <div className={SH}>Preferences de facturation</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LC}>Prefixe facture (max 5 car.)</label>
            <input {...register('invoice_prefix')} placeholder="FP" className={`${IC} font-mono uppercase`} />
          </div>
          <div className="col-span-2">
            <label className={LC}>Conditions de paiement par defaut</label>
            <input {...register('default_payment_terms')} placeholder="Paiement a 30 jours." className={IC} />
          </div>
        </div>
      </div>

      {saved && <div className="text-sm text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-xl px-4 py-3">Modifications enregistrees.</div>}
      <button type="submit" disabled={saving}
        className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </form>
  )
}
