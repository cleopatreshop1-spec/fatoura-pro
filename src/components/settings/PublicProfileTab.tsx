'use client'

import { useEffect, useState } from 'react'
import { Globe, Copy, ExternalLink, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function PublicProfileTab() {
  const { activeCompany } = useCompany()
  const supabase = createClient()

  const [slug,         setSlug]         = useState('')
  const [tagline,      setTagline]       = useState('')
  const [services,     setServices]      = useState<string[]>([])
  const [newService,   setNewService]    = useState('')
  const [enabled,      setEnabled]       = useState(false)
  const [saving,       setSaving]        = useState(false)
  const [toast,        setToast]         = useState('')
  const [slugError,    setSlugError]     = useState('')
  const [copied,       setCopied]        = useState(false)
  const [loading,      setLoading]       = useState(true)

  useEffect(() => {
    if (!activeCompany?.id) return
    ;(async () => {
      const { data } = await (supabase as any)
        .from('companies')
        .select('slug, public_tagline, public_services, public_profile, name')
        .eq('id', activeCompany.id)
        .single()
      if (data) {
        setSlug(data.slug ?? slugify(data.name ?? ''))
        setTagline(data.public_tagline ?? '')
        setServices(data.public_services ?? [])
        setEnabled(data.public_profile ?? false)
      }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function checkSlug(val: string) {
    setSlug(val)
    setSlugError('')
    if (!val) return
    const safe = slugify(val)
    if (safe !== val) { setSlugError(`Sera normalisé en: ${safe}`); return }
    const { data } = await (supabase as any)
      .from('companies').select('id').eq('slug', val).neq('id', activeCompany!.id).maybeSingle()
    if (data) setSlugError('Ce slug est déjà utilisé')
  }

  async function handleSave() {
    if (!activeCompany?.id) return
    if (slugError) return
    const safeSlug = slugify(slug)
    if (!safeSlug) { setSlugError('Slug invalide'); return }
    setSaving(true)
    const { error } = await (supabase as any)
      .from('companies')
      .update({
        slug:            safeSlug,
        public_tagline:  tagline || null,
        public_services: services.length > 0 ? services : null,
        public_profile:  enabled,
      })
      .eq('id', activeCompany.id)
    setSaving(false)
    if (error) { showToast('Erreur sauvegarde'); return }
    setSlug(safeSlug)
    showToast('Profil public mis à jour')
  }

  function addService() {
    const s = newService.trim()
    if (!s || services.includes(s)) return
    setServices(p => [...p, s])
    setNewService('')
  }

  const profileUrl = slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${slug}` : null

  async function copyUrl() {
    if (!profileUrl) return
    await navigator.clipboard.writeText(profileUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="animate-pulse h-64 bg-[#161b27] rounded-2xl" />

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-20 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-2xl border bg-[#0f1118] border-[#2dd4a0]/40 text-[#2dd4a0]">
          {toast}
        </div>
      )}

      {/* Toggle */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Profil public</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              Publiez une page de profil professionnelle consultable par vos clients et partenaires.
              Affiche votre nom, coordonnées et services — aucune donnée financière n'est partagée.
            </p>
          </div>
          <button
            onClick={() => setEnabled(e => !e)}
            className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-[#d4a843]' : 'bg-[#252830]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Slug */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Adresse du profil</h3>
        <div>
          <label className={LC}>Identifiant URL (slug)</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 shrink-0">fatoura.pro/c/</span>
            <input
              value={slug}
              onChange={e => checkSlug(e.target.value)}
              placeholder="mon-entreprise"
              className={`${IC} flex-1`}
            />
          </div>
          {slugError && <p className="text-xs text-[#f59e0b] mt-1">{slugError}</p>}
        </div>

        {profileUrl && enabled && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#161b27] border border-[#252830] rounded-xl">
            <Globe size={12} className="text-[#4a9eff] shrink-0" />
            <span className="text-xs text-gray-400 font-mono truncate flex-1">{profileUrl}</span>
            <button onClick={copyUrl} className="text-xs text-[#4a9eff] hover:text-white shrink-0 transition-colors">
              {copied ? '✓' : <Copy size={11} />}
            </button>
            <a href={profileUrl} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-white transition-colors">
              <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Tagline */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">À propos</h3>
        <div>
          <label className={LC}>Accroche / Description courte</label>
          <textarea
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            rows={2}
            maxLength={160}
            placeholder="Ex: Expert-comptable agréé basé à Tunis, spécialisé en PME industrielles."
            className={`${IC} resize-none`}
          />
          <p className="text-[10px] text-gray-700 mt-1 text-right">{tagline.length}/160</p>
        </div>
      </div>

      {/* Services */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Services / Activités</h3>
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {services.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b27] border border-[#252830] text-xs text-gray-300 rounded-xl">
              {s}
              <button onClick={() => setServices(p => p.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
          {services.length === 0 && <p className="text-xs text-gray-600 italic">Aucun service ajouté</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newService}
            onChange={e => setNewService(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addService()}
            placeholder="Ajouter un service..."
            className={`${IC} flex-1`}
          />
          <button onClick={addService}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] border border-[#252830] rounded-xl text-xs text-gray-400 hover:text-white hover:border-[#d4a843]/30 transition-colors">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !!slugError}
        className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors"
      >
        {saving ? 'Sauvegarde...' : 'Enregistrer le profil public'}
      </button>
    </div>
  )
}
