'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

type ApiKey = {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default function ApiKeysPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadKeys() {
    if (!activeCompany?.id) return
    const { data } = await supabase.from('api_keys').select('*')
      .eq('company_id', activeCompany.id).order('created_at', { ascending: false })
    setKeys((data ?? []) as ApiKey[])
    setLoading(false)
  }

  useEffect(() => { loadKeys() }, [activeCompany?.id])

  async function handleCreate() {
    if (!name.trim() || !activeCompany?.id) return
    setCreating(true); setError(''); setNewKey(null)
    const rawKey = `fp_live_${crypto.randomUUID().replace(/-/g, '')}`
    const prefix = rawKey.slice(0, 12)
    const encoder = new TextEncoder()
    const data = encoder.encode(rawKey)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const keyHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
    const { error: e } = await supabase.from('api_keys').insert({
      company_id: activeCompany.id, name: name.trim(),
      key_hash: keyHash, key_prefix: prefix,
      permissions: ['invoices:write', 'tva:read'], is_active: true,
    })
    if (e) setError(e.message)
    else { setNewKey(rawKey); setName(''); await loadKeys() }
    setCreating(false)
  }

  async function handleRevoke(id: string) {
    await supabase.from('api_keys').update({ is_active: false }).eq('id', id)
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Clés API</h1>
        <p className="text-gray-500 text-sm">Intégrations ERP et externes</p>
      </div>

      {newKey && (
        <div className="bg-green-950/30 border border-green-900/50 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-green-400 uppercase">Clé générée — copiez-la maintenant, elle ne sera plus affichée</div>
          <div className="font-mono text-sm text-white bg-black/30 rounded px-3 py-2 break-all">{newKey}</div>
        </div>
      )}

      {error && <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
        <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Nouvelle clé</div>
        <div className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom (ex: ERP Sage)"
            className="flex-1 bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#d4a843]" />
          <button onClick={handleCreate} disabled={creating || !name.trim()}
            className="bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            {creating ? '...' : 'Générer'}
          </button>
        </div>
      </div>

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1a1b22]">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Clés existantes</div>
        </div>
        {loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Chargement...</div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-600 text-center">Aucune clé API.</div>
        ) : (
          <div className="divide-y divide-[#1a1b22]">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-gray-200">{k.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{k.key_prefix}...</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${k.is_active ? 'bg-green-900/20 text-[#2dd4a0]' : 'bg-gray-800 text-gray-500'}`}>
                    {k.is_active ? 'ACTIVE' : 'RÉVOQUÉE'}
                  </span>
                  {k.is_active && (
                    <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-500 hover:text-red-400">Révoquer</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
