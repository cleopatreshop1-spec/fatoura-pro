'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Copy, X } from 'lucide-react'

type ApiKey = { id: string; name: string; key_prefix: string; permissions: string[]; last_used_at: string | null; expires_at: string | null; is_active: boolean; created_at: string }

const ALL_PERMS = [
  { key: 'invoices:write', label: 'Créer et soumettre des factures', default: true },
  { key: 'invoices:read',  label: 'Lire les factures', default: true },
  { key: 'tva:read',       label: 'Accéder aux données TVA', default: false },
  { key: 'clients:write',  label: 'Gérer les clients', default: false },
]

export function ApiKeysTab() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>(ALL_PERMS.filter(p => p.default).map(p => p.key))
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function load() {
    if (!activeCompany?.id) return
    const { data } = await supabase.from('api_keys')
      .select('id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at')
      .eq('company_id', activeCompany.id).order('created_at', { ascending: false })
    setKeys((data ?? []) as ApiKey[])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompany?.id])

  async function handleCreate() {
    if (!newKeyName.trim() || !activeCompany?.id) return
    setCreating(true)
    const rawKey = `fp_live_${crypto.randomUUID().replace(/-/g, '')}`
    const prefix = rawKey.slice(0, 14)
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('api_keys').insert({
      company_id: activeCompany.id, name: newKeyName.trim(),
      key_hash: keyHash, key_prefix: prefix,
      permissions: selectedPerms, is_active: true,
      expires_at: expiresAt || null,
    })
    setGeneratedKey(rawKey)
    setCreating(false)
    load()
  }

  async function handleRevoke(id: string) {
    await supabase.from('api_keys').update({ is_active: false }).eq('id', id)
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k))
    showToast('Clé révoquée.')
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text); showToast('Copié !')
  }

  const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">API Keys  Integration ERP</h2>
          <p className="text-xs text-gray-500 mt-0.5">Permettez a votre ERP de soumettre des factures via notre API REST.</p>
        </div>
        <button onClick={() => { setModalOpen(true); setGeneratedKey(null); setNewKeyName(''); setSelectedPerms(ALL_PERMS.filter(p=>p.default).map(p=>p.key)) }}
          className="px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors">
          Créer une clé API
        </button>
      </div>

      {/* Keys list */}
      <div className="bg-[#161b27] border border-[#1a1b22] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#252830]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[#252830] rounded w-32" />
                  <div className="h-3 bg-[#252830] rounded w-56" />
                </div>
                <div className="h-7 bg-[#252830] rounded-lg w-20" />
                <div className="h-7 bg-[#252830] rounded-lg w-16" />
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-600 text-center">Aucune clé API.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#252830]">
              {['Nom','Prefixe','Permissions','Derniere utilisation','Expiration',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#252830]">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-[#252830]/50 transition-colors">
                  <td className="px-4 py-3 text-gray-200 text-xs">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{k.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.permissions ?? []).map(p => (
                        <span key={p} className="text-[9px] px-1.5 py-0.5 bg-[#1a1b22] text-gray-500 rounded">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('fr-FR') : ''}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{k.expires_at ? new Date(k.expires_at).toLocaleDateString('fr-FR') : ''}</td>
                  <td className="px-4 py-3">
                    {k.is_active ? (
                      <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Révoquer</button>
                    ) : (
                      <span className="text-[10px] text-gray-700 font-mono">RÉVOQUÉE</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Docs */}
      <div className="bg-[#161b27] border border-[#1a1b22] rounded-2xl p-5">
        <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Documentation rapide</div>
        <pre className="text-[11px] text-gray-400 bg-[#0a0b0f] rounded-xl p-4 overflow-x-auto leading-relaxed">
{`curl -X POST https://api.fatoura.pro/v1/invoices \\
  -H "Authorization: Bearer fp_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"...","lines":[...]}'`}
        </pre>
      </div>

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1b22]">
              <h3 className="text-sm font-bold text-white">{generatedKey ? 'Clé générée' : 'Nouvelle clé API'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white p-1"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {generatedKey ? (
                <div className="space-y-3">
                  <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-3 text-xs text-yellow-300 font-bold">
                    Cette clé ne sera plus affichée. Copiez-la maintenant.
                  </div>
                  <div className="bg-[#0a0b0f] rounded-xl px-4 py-3 font-mono text-xs text-[#d4a843] break-all flex items-start gap-2">
                    <span className="flex-1">{generatedKey}</span>
                    <button onClick={() => handleCopy(generatedKey)} className="text-gray-500 hover:text-[#d4a843] shrink-0 mt-0.5"><Copy size={13} /></button>
                  </div>
                  <button onClick={() => setModalOpen(false)} className="w-full py-2.5 bg-[#d4a843] text-black font-bold rounded-xl text-sm">Fermer</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Nom de la clé *</label>
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="ERP Sage Production" className={IC} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Permissions</label>
                    <div className="space-y-2">
                      {ALL_PERMS.map(p => (
                        <label key={p.key} className="flex items-center gap-2.5 cursor-pointer">
                          <input type="checkbox" checked={selectedPerms.includes(p.key)}
                            onChange={e => setSelectedPerms(prev => e.target.checked ? [...prev,p.key] : prev.filter(x=>x!==p.key))}
                            className="w-3.5 h-3.5 rounded accent-[#d4a843]" />
                          <span className="text-xs text-gray-300">{p.label}</span>
                          <span className="text-[9px] font-mono text-gray-600">{p.key}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Expiration (optionnel)</label>
                    <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={IC} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300">Annuler</button>
                    <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold disabled:opacity-50">
                      {creating ? '...' : 'Générer la clé'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
