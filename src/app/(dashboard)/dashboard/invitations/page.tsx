'use client'

import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type PendingInvite = {
  id: string
  company_id: string
  role: string | null
  invited_at: string | null
  company_name?: string
}

export default function InvitationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [active, setActive] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) { setLoading(false); return }

      // Find invitations by email (not yet accepted)
      const { data: pendingLinks } = await supabase
        .from('accountant_links')
        .select('id, company_id, role, invited_at')
        .eq('invited_email', user.email.toLowerCase())
        .is('accepted_at', null)

      // Find already accepted links for this user
      const { data: activeLinks } = await supabase
        .from('accountant_links')
        .select('id, company_id, role, invited_at')
        .eq('accountant_id', user.id)
        .not('accepted_at', 'is', null)

      // Enrich with company names
      const allLinks = [...(pendingLinks ?? []), ...(activeLinks ?? [])]
      const companyIds = [...new Set(allLinks.map((l: any) => l.company_id).filter(Boolean))]

      const companyNames: Record<string, string> = {}
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds)
        for (const c of companies ?? []) {
          companyNames[(c as any).id] = (c as any).name
        }
      }

      setPending(
        (pendingLinks ?? []).map((l: any) => ({
          ...l,
          company_name: companyNames[l.company_id] ?? l.company_id,
        }))
      )
      setActive(
        (activeLinks ?? []).map((l: any) => ({
          ...l,
          company_name: companyNames[l.company_id] ?? l.company_id,
        }))
      )
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleAccept(linkId: string) {
    setAccepting(linkId)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non connecté'); setAccepting(null); return }

    const { error: updateErr } = await supabase
      .from('accountant_links')
      .update({
        accountant_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', linkId)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      const accepted = pending.find(p => p.id === linkId)
      if (accepted) {
        setPending(prev => prev.filter(p => p.id !== linkId))
        setActive(prev => [...prev, { ...accepted }])
      }
    }
    setAccepting(null)
  }

  async function handleLeave(linkId: string) {
    await supabase.from('accountant_links').delete().eq('id', linkId)
    setActive(prev => prev.filter(l => l.id !== linkId))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Invitations</h1>
          <p className="text-gray-500 text-sm">Accès comptable aux sociétés</p>
        </div>
        <div className="text-sm text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Invitations</h1>
        <p className="text-gray-500 text-sm">Accès comptable aux sociétés</p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Pending invitations */}
      <div className="bg-[#111318] border border-[#252830] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#252830]">
          <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">
            Invitations en attente
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">Aucune invitation en attente.</div>
        ) : (
          <div className="divide-y divide-[#252830]">
            {pending.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-gray-200">{inv.company_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {inv.invited_at
                      ? `Invité le ${new Date(inv.invited_at).toLocaleDateString('fr-FR')}`
                      : '—'}
                    {inv.role ? ` · ${inv.role}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleAccept(inv.id)}
                  disabled={accepting === inv.id}
                  className="bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 text-black font-bold px-4 py-1.5 rounded-lg text-sm transition-colors"
                >
                  {accepting === inv.id ? '...' : 'Accepter'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active links */}
      <div className="bg-[#111318] border border-[#252830] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#252830]">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Accès actifs
          </div>
        </div>

        {active.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">Aucun accès actif.</div>
        ) : (
          <div className="divide-y divide-[#252830]">
            {active.map(link => (
              <div key={link.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-gray-200">{link.company_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {link.role ?? 'comptable'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/dashboard?company_id=${link.company_id}`}
                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Vue invité →
                  </a>
                  <button
                    onClick={() => handleLeave(link.id)}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Quitter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
