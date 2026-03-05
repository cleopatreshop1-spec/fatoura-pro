import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Building2, Phone, Mail, MapPin, Globe, CheckCircle } from 'lucide-react'

type Ctx = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Ctx) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('companies').select('name, public_tagline').eq('slug', slug).eq('public_profile', true).single()
  if (!data) return { title: 'Profil introuvable' }
  return {
    title: `${data.name} — Profil professionnel`,
    description: data.public_tagline ?? `Découvrez ${data.name} sur Fatoura Pro`,
  }
}

export default async function CompanyProfilePage({ params }: Ctx) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: co } = await (supabase as any)
    .from('companies')
    .select('id, name, matricule_fiscal, address, phone, email, logo_url, website, public_tagline, public_services, created_at')
    .eq('slug', slug)
    .eq('public_profile', true)
    .single()

  if (!co) notFound()

  const memberSince = new Date(co.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const services: string[] = co.public_services ?? []

  return (
    <div className="min-h-screen bg-[#080a0f]">
      {/* Top bar */}
      <div className="border-b border-[#1a1b22] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-[#d4a843] font-black text-lg tracking-tight">Fatoura Pro</Link>
        <span className="text-xs text-gray-600">Profil vérifié</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">

        {/* Hero card */}
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-[#d4a843]/20 via-[#d4a843]/5 to-transparent" />

          <div className="px-6 pb-6 -mt-8">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#161b27] border-2 border-[#1a1b22] flex items-center justify-center mb-4 shadow-xl">
              {co.logo_url ? (
                <img src={co.logo_url} alt={co.name} className="w-full h-full object-contain rounded-2xl" />
              ) : (
                <span className="text-2xl font-black text-[#d4a843]">
                  {(co.name as string).slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-black text-white leading-tight">{co.name}</h1>
                {co.matricule_fiscal && (
                  <p className="text-xs font-mono text-gray-500 mt-0.5">MF: {co.matricule_fiscal}</p>
                )}
                {co.public_tagline && (
                  <p className="text-sm text-gray-400 mt-2 max-w-md leading-relaxed">{co.public_tagline}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-full shrink-0">
                <CheckCircle size={11} className="text-[#2dd4a0]" />
                <span className="text-[10px] font-bold text-[#2dd4a0] uppercase tracking-wider">Vérifié Fatoura Pro</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-700 mt-3">Membre depuis {memberSince}</p>
          </div>
        </div>

        {/* Contact card */}
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6">
          <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Coordonnées</h2>
          <div className="space-y-3">
            {co.address && (
              <div className="flex items-start gap-3">
                <MapPin size={14} className="text-gray-600 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300">{co.address}</span>
              </div>
            )}
            {co.phone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-gray-600 shrink-0" />
                <a href={`tel:${co.phone}`} className="text-sm text-gray-300 hover:text-[#d4a843] transition-colors">{co.phone}</a>
              </div>
            )}
            {co.email && (
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-gray-600 shrink-0" />
                <a href={`mailto:${co.email}`} className="text-sm text-gray-300 hover:text-[#d4a843] transition-colors">{co.email}</a>
              </div>
            )}
            {co.website && (
              <div className="flex items-center gap-3">
                <Globe size={14} className="text-gray-600 shrink-0" />
                <a href={co.website} target="_blank" rel="noreferrer" className="text-sm text-[#4a9eff] hover:underline">{co.website}</a>
              </div>
            )}
            {!co.address && !co.phone && !co.email && !co.website && (
              <p className="text-sm text-gray-600 italic">Aucune coordonnée publique renseignée.</p>
            )}
          </div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6">
            <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Services / Activités</h2>
            <div className="flex flex-wrap gap-2">
              {services.map((s, i) => (
                <span key={i} className="px-3 py-1.5 bg-[#161b27] border border-[#252830] text-xs text-gray-300 rounded-xl">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-700 mb-3">Profil généré par</p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold text-sm rounded-xl transition-colors">
            <Building2 size={14} />
            Créer mon profil sur Fatoura Pro
          </Link>
        </div>
      </div>
    </div>
  )
}
