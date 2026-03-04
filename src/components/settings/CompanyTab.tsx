'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCompany } from '@/contexts/CompanyContext'
import { createClient } from '@/lib/supabase/client'
import { CreateCompanyCard } from '@/components/company/CreateCompanyCard'
import { sanitizeString } from '@/lib/utils/sanitize'

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
  invoice_footer: z.string().max(500).optional(),
  monthly_revenue_goal: z.string().optional(),
  annual_revenue_goal:  z.string().optional(),
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
  const [accentColor, setAccentColor] = useState('#1a1a2e')
  const [logoPosition, setLogoPosition] = useState<'left' | 'right'>('left')

  // Show create company card if no active company
  if (!activeCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">Créer votre entreprise</h3>
          <p className="text-sm text-gray-400 mb-4">
            Vous devez créer une entreprise pour commencer à utiliser Fatoura Pro.
          </p>
        </div>
        <CreateCompanyCard />
      </div>
    )
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!activeCompany) return
    const c = activeCompany as any
    setLogoUrl(c.logo_url ?? null)
    setAccentColor(c.invoice_accent_color ?? '#1a1a2e')
    setLogoPosition(c.invoice_logo_position ?? 'left')
    reset({
      name: c.name ?? '', matricule_fiscal: c.matricule_fiscal ?? '',
      tva_regime: c.tva_regime ?? 'reel', address: c.address ?? '',
      gouvernorat: c.gouvernorat ?? '', postal_code: c.postal_code ?? '',
      phone: c.phone ?? '', phone2: c.phone2 ?? '',
      email: c.email ?? '', website: c.website ?? '',
      bank_name: c.bank_name ?? '', bank_rib: c.bank_rib ?? '',
      invoice_prefix: c.invoice_prefix ?? 'FP',
      default_payment_terms: c.default_payment_terms ?? '',
      invoice_footer: c.invoice_footer ?? '',
      monthly_revenue_goal: c.monthly_revenue_goal != null ? String(c.monthly_revenue_goal) : '',
      annual_revenue_goal:  c.annual_revenue_goal  != null ? String(c.annual_revenue_goal)  : '',
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
      name:             sanitizeString(data.name, 200),
      matricule_fiscal: data.matricule_fiscal ? sanitizeString(data.matricule_fiscal, 50) : null,
      tva_regime:       data.tva_regime,
      address:          data.address   ? sanitizeString(data.address, 300)   : null,
      gouvernorat:      data.gouvernorat ? sanitizeString(data.gouvernorat, 100) : null,
      postal_code:      data.postal_code ? sanitizeString(data.postal_code, 20)  : null,
      phone:            data.phone     ? sanitizeString(data.phone, 30)     : null,
      email:            data.email     ? sanitizeString(data.email, 200)    : null,
      bank_name:        data.bank_name ? sanitizeString(data.bank_name, 100) : null,
      bank_rib:         data.bank_rib  ? sanitizeString(data.bank_rib, 50)  : null,
      invoice_prefix:          sanitizeString(data.invoice_prefix || 'FP', 10),
      invoice_accent_color:    accentColor,
      invoice_logo_position:   logoPosition,
      invoice_footer:          data.invoice_footer ? sanitizeString(data.invoice_footer, 500) : null,
      monthly_revenue_goal:    data.monthly_revenue_goal ? parseFloat(data.monthly_revenue_goal) : null,
      annual_revenue_goal:     data.annual_revenue_goal  ? parseFloat(data.annual_revenue_goal)  : null,
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
          <div className="col-span-2">
            <label className={LC}>Pied de page facture <span className="normal-case text-gray-600 font-normal">(max 500 car.)</span></label>
            <textarea
              {...register('invoice_footer')}
              rows={3}
              placeholder="Ex: Merci pour votre confiance. Tout retard de paiement entraine des penalites."
              className={`${IC} resize-none`}
            />
            <p className="text-[10px] text-gray-600 mt-1">Apparaitra en bas de chaque facture PDF.</p>
          </div>
        </div>
      </div>

      {/* Template customization */}
      <div>
        <div className={SH}>Apparence des factures PDF</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LC}>Couleur accent</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#1a1b22] cursor-pointer bg-transparent p-0.5"
              />
              <input
                type="text"
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                className={`${IC} font-mono flex-1`}
                maxLength={7}
                placeholder="#1a1a2e"
              />
            </div>
            <div className="mt-2 flex gap-2">
              {['#1a1a2e','#d4a843','#2dd4a0','#4a9eff','#e11d48','#7c3aed'].map(c => (
                <button key={c} type="button"
                  onClick={() => setAccentColor(c)}
                  title={c}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${accentColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className={LC}>Position du logo</label>
            <div className="flex gap-2 mt-1">
              {(['left','right'] as const).map(pos => (
                <button key={pos} type="button"
                  onClick={() => setLogoPosition(pos)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    logoPosition === pos
                      ? 'bg-[#d4a843]/10 border-[#d4a843]/50 text-[#d4a843]'
                      : 'border-[#1a1b22] text-gray-500 hover:text-white'
                  }`}>
                  {pos === 'left' ? '◀ Gauche' : 'Droite ▶'}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-[#1a1b22] bg-[#161b27] p-3 flex items-center gap-2 text-[10px] text-gray-500">
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: accentColor, opacity: 0.8 }} />
              <div className="flex-1">
                <div className="h-2 rounded bg-gray-700 w-20 mb-1" />
                <div className="h-1.5 rounded bg-gray-800 w-14" />
              </div>
              <span>Aperçu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Goals */}
      <div>
        <div className={SH}>Objectifs de chiffre d&apos;affaires</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LC}>Objectif mensuel (TND HT)</label>
            <input {...register('monthly_revenue_goal')} type="number" min="0" step="100" placeholder="ex: 10000" className={`${IC} font-mono`} />
          </div>
          <div>
            <label className={LC}>Objectif annuel (TND HT)</label>
            <input {...register('annual_revenue_goal')} type="number" min="0" step="1000" placeholder="ex: 120000" className={`${IC} font-mono`} />
          </div>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">Ces objectifs s&apos;affichent sur le tableau de bord avec une barre de progression.</p>
      </div>

      {saved && <div className="text-sm text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-xl px-4 py-3">Modifications enregistrees.</div>}
      <button type="submit" disabled={saving}
        className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </form>
  )
}
