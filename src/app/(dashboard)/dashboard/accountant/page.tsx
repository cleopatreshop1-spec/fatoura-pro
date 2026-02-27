'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Plus, Building2, AlertTriangle, CheckCircle, Clock, X, Send } from 'lucide-react'
import { toast } from 'sonner'

type FidClient = {
  id: string
  client_company_id: string | null
  invited_email: string | null
  client_name: string | null
  status: string
  accepted_at: string | null
  invited_at: string | null
  permissions: string[]
  clientCompany?: {
    id: string; name: string; matricule_fiscal: string | null
  } | null
  stats?: { invoiceCount: number; validCount: number; rejectedCount: number; monthCA: number }
}

export default function AccountantPage() {
  const { activeCompany, ownCompany, isFiduciaire, fiduciaiireLinks, refreshCompanies, switchCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<FidClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail, setInvEmail] = useState('')
  const [invName, setInvName] = useState('')
  const [invMsg, setInvMsg] = useState('')
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    if (!ownCompany?.id) return
    setLoading(true)

    const { data: links } = await (supabase as any)
      .from('fiduciaire_clients')
      .select(`
        id, client_company_id, invited_email, client_name, status, accepted_at, invited_at, permissions,
        clientCompany:companies!client_company_id(id, name, matricule_fiscal)
      `)
      .eq('fiduciaire_company_id', ownCompany.id)
      .order('invited_at', { ascending: false })

    const list: FidClient[] = (links ?? []) as FidClient[]

    // Load stats for active clients
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

    for (const cl of list) {
      if (cl.status === 'active' && cl.client_company_id) {
        const [{ count: invCount }, { count: validCount }, { count: rejCount }, { data: monthInvs }] = await Promise.all([
          (supabase as any).from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', cl.client_company_id),
          (supabase as any).from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', cl.client_company_id).eq('status', 'valid'),
          (supabase as any).from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', cl.client_company_id).eq('status', 'rejected'),
          (supabase as any).from('invoices').select('ttc_amount').eq('company_id', cl.client_company_id).gte('issue_date', monthStart),
        ])
        const monthCA = (monthInvs ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
        cl.stats = { invoiceCount: invCount ?? 0, validCount: validCount ?? 0, rejectedCount: rejCount ?? 0, monthCA }
      }
    }

    setClients(list)
    setLoading(false)
  }, [ownCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  async function handleInvite() {
    if (!invEmail.trim() || !ownCompany?.id) return
    setInviting(true)
    const res = await fetch('/api/fiduciaire/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), client_name: invName.trim(), message: invMsg.trim() }),
    })
    const d = await res.json()
    setInviting(false)
    if (res.ok) {
      toast.success(`Invitation envoyée à ${invEmail}`)
      setShowInvite(false); setInvEmail(''); setInvName(''); setInvMsg('')
      load(); refreshCompanies()
    } else {
      toast.error(d.error ?? 'Erreur')
    }
  }

  async function handleRevoke(clientId: string) {
    await (supabase as any).from('fiduciaire_clients').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', clientId)
    toast.success('Accès révoqué')
    load()
  }

  const fmtTND = (n: number) => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  const active  = clients.filter(c => c.status === 'active')
  const pending = clients.filter(c => c.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isFiduciaire && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30 uppercase tracking-wider">
                Mode Fiduciaire
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">Portefeuille clients</h1>
          <p className="text-gray-500 text-sm">
            {active.length} client{active.length !== 1 ? 's' : ''} actif{active.length !== 1 ? 's' : ''}
            {pending.length > 0 && `  ${pending.length} invitation${pending.length !== 1 ? 's' : ''} en attente`}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
          <Plus size={14} strokeWidth={2.5} />Inviter un client
        </button>
      </div>

      {/* Active clients grid */}
      {loading ? (
        <div className="text-sm text-gray-600 py-8 text-center">Chargement du portefeuille...</div>
      ) : active.length === 0 && pending.length === 0 ? (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-12 text-center space-y-3">
          <Building2 size={40} className="text-gray-700 mx-auto" />
          <p className="text-sm font-bold text-gray-400">Aucun client dans votre portefeuille</p>
          <p className="text-xs text-gray-600 max-w-xs mx-auto">
            Invitez vos clients PME pour gérer leurs factures, TVA et soumissions TTN depuis votre compte.
          </p>
          <button onClick={() => setShowInvite(true)}
            className="mx-auto flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors">
            <Plus size={13} />Inviter votre premier client
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Clients actifs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map(cl => {
                  const co = cl.clientCompany
                  const s  = cl.stats
                  const hasAlert = (s?.rejectedCount ?? 0) > 0
                  return (
                    <div key={cl.id} className={`bg-[#0f1118] border rounded-2xl p-5 space-y-3 ${hasAlert ? 'border-red-900/40' : 'border-[#1a1b22]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-7 h-7 rounded-lg bg-[#4a9eff]/15 border border-[#4a9eff]/20 flex items-center justify-center text-xs font-bold text-[#4a9eff] shrink-0">
                              {(co?.name ?? cl.client_name ?? '?')[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-white truncate">{co?.name ?? cl.client_name ?? cl.invited_email}</span>
                          </div>
                          {co?.matricule_fiscal && (
                            <div className="text-[10px] font-mono text-gray-600 ml-9">{co.matricule_fiscal}</div>
                          )}
                        </div>
                        {hasAlert
                          ? <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                          : <CheckCircle size={14} className="text-[#2dd4a0] shrink-0 mt-0.5" />
                        }
                      </div>

                      {/* Stats */}
                      {s && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Factures', value: String(s.invoiceCount), color: 'text-gray-300' },
                            { label: 'Validées', value: String(s.validCount),   color: 'text-[#2dd4a0]' },
                            { label: 'Rejetées', value: String(s.rejectedCount), color: s.rejectedCount > 0 ? 'text-red-400' : 'text-gray-600' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-[#161b27] rounded-lg px-2 py-2 text-center">
                              <div className={`text-base font-black font-mono ${color}`}>{value}</div>
                              <div className="text-[9px] text-gray-600 uppercase">{label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {s && s.monthCA > 0 && (
                        <div className="text-[10px] text-gray-600">
                          CA ce mois: <span className="text-gray-400 font-mono font-bold">{fmtTND(s.monthCA)} TND</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {co?.id && (
                          <button
                            onClick={() => { switchCompany(co.id) }}
                            className="flex-1 py-2 rounded-xl bg-[#d4a843]/10 hover:bg-[#d4a843]/20 text-[#d4a843] text-xs font-bold transition-colors border border-[#d4a843]/20">
                            Gérer 
                          </button>
                        )}
                        <button onClick={() => handleRevoke(cl.id)}
                          className="px-3 py-2 rounded-xl border border-red-900/30 text-red-400 text-xs hover:bg-red-950/20 transition-colors">
                          Révoquer
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">En attente d'acceptation</h2>
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden divide-y divide-[#1a1b22]">
                {pending.map(cl => (
                  <div key={cl.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock size={14} className="text-yellow-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 truncate">{cl.client_name || cl.invited_email}</div>
                        <div className="text-[10px] text-gray-600">
                          {cl.invited_email}  Invité le {cl.invited_at ? new Date(cl.invited_at).toLocaleDateString('fr-FR') : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-900/20 text-yellow-500 border border-yellow-800/30">En attente</span>
                      <button onClick={() => handleRevoke(cl.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Annuler</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1b22]">
              <h3 className="text-sm font-bold text-white">Inviter un client PME</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-500 hover:text-white p-1"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Email du responsable *</label>
                <input value={invEmail} onChange={e => setInvEmail(e.target.value)} type="email" autoFocus
                  placeholder="responsable@pme.tn"
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Nom de la société</label>
                <input value={invName} onChange={e => setInvName(e.target.value)}
                  placeholder="Ex: SARL AlphaTech"
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Message personnalisé (optionnel)</label>
                <textarea value={invMsg} onChange={e => setInvMsg(e.target.value)} rows={2}
                  placeholder="Bonjour, je vous invite à rejoindre Fatoura Pro..."
                  className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] resize-none" />
              </div>
              <p className="text-[10px] text-gray-600">
                Un email d'invitation sera envoyé. Une fois inscrit, votre cabinet pourra gérer leurs factures et soumissions TTN.
              </p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300">Annuler</button>
                <button onClick={handleInvite} disabled={inviting || !invEmail.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {inviting ? '...' : <><Send size={13} />Envoyer l'invitation</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
