'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

export function CreateCompanyCard() {
  const supabase = useMemo(() => createClient(), [])
  const { loadingCompanies, companyLoadError, refreshCompanies } = useCompany()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setSubmitting(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Vous devez être connecté.')

      const defaultName = name.trim() || (user.email ? user.email.split('@')[0] : 'Ma Société')

      const { error: insertError } = await supabase
        .from('companies')
        .insert({ owner_id: user.id, name: defaultName, current_plan: 'trialing' })

      if (insertError) throw insertError

      await refreshCompanies()
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[#111318] border border-[#252830] rounded-xl p-4 space-y-3">
      <div className="text-sm text-gray-300">Aucune société active.</div>

      {companyLoadError && (
        <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
          {companyLoadError}
        </div>
      )}

      {error && (
        <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <input
        className="w-full bg-[#0a0b0f] border border-[#252830] rounded-lg px-3 py-2 text-white"
        placeholder="Nom de la société (optionnel)"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <button
        type="button"
        disabled={submitting || loadingCompanies}
        onClick={handleCreate}
        className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
      >
        {submitting ? '...' : loadingCompanies ? 'Chargement...' : 'Créer ma société'}
      </button>

      <button
        type="button"
        disabled={submitting}
        onClick={() => refreshCompanies()}
        className="w-full border border-[#252830] rounded-lg px-3 py-2 text-gray-300 hover:text-white disabled:opacity-50"
      >
        Réessayer
      </button>
    </div>
  )
}
