'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, MoreVertical, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { ClientModal } from '@/components/clients/ClientModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { fmtTND } from '@/lib/utils/tva-calculator'
import type { ClientRecord } from '@/components/clients/ClientModal'
import { ClientCSVImport } from '@/components/clients/ClientCSVImport'

type ClientRow = {
  id: string; name: string; type: string
  matricule_fiscal: string | null; phone: string | null; email: string | null
  gouvernorat: string | null; address: string | null
  postal_code: string | null; bank_name: string | null; bank_rib: string | null
  created_at: string
  invoices: { id: string; ttc_amount: number | null; status: string; payment_status: string | null }[]
}
type FilterType = 'all' | 'B2B' | 'B2C'

const PAGE_SIZE = 25

export default function ClientsPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<ClientRecord | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*, invoices(id, ttc_amount, status, payment_status)')
      .eq('company_id', activeCompany.id)
      .order('name')
    setClients((data ?? []) as ClientRow[])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Filtered + searched clients
  const filtered = useMemo(() => {
    let list = clients
    if (filter !== 'all') list = list.filter(c => c.type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.matricule_fiscal ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }
    return list
  }, [clients, filter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function getStats(c: ClientRow) {
    const validInvs = c.invoices?.filter(i => i.status !== 'draft') ?? []
    const count = validInvs.length
    const ca = validInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
    const balance = validInvs
      .filter(i => i.payment_status !== 'paid')
      .reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
    return { count, ca, balance }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('clients').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    showToast('Client supprime.')
    load()
  }

  function openEdit(c: ClientRow) {
    setEditClient(c)
    setDropdownOpen(null)
    setModalOpen(true)
  }

  function openAdd() {
    setEditClient(undefined)
    setModalOpen(true)
  }

  const FILTER_TABS: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'B2B', label: 'B2B' },
    { value: 'B2C', label: 'B2C' },
  ]

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Clients <span className="text-sm text-gray-500 font-normal">({filtered.length})</span>
          </h1>
          <p className="text-gray-500 text-sm">Gestion de votre portefeuille clients</p>
        </div>
        <div className="flex items-center gap-2">
          <ClientCSVImport onDone={load} />
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            <Plus size={15} strokeWidth={2.5} />
            Ajouter un client
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par nom, matricule, email..."
            className="w-full bg-[#0f1118] border border-[#1a1b22] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors" />
        </div>
        <div className="flex gap-1 bg-[#0f1118] border border-[#1a1b22] rounded-xl p-1">
          {FILTER_TABS.map(t => (
            <button key={t.value} onClick={() => { setFilter(t.value); setPage(1) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === t.value ? 'bg-[#161b27] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#1a1b22]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                <div className="h-4 bg-[#1a1b22] rounded w-36" />
                <div className="h-5 bg-[#1a1b22] rounded-full w-12 ml-2" />
                <div className="h-3.5 bg-[#1a1b22] rounded flex-1 max-w-[160px] hidden md:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-24 hidden lg:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-32 hidden lg:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-12 ml-auto" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-20" />
                <div className="w-6 h-6 rounded bg-[#1a1b22]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search || filter !== 'all' ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center">
                <Search size={20} className="text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-400">Aucun client ne correspond à votre recherche</p>
              <button
                onClick={() => { setSearch(''); setFilter('all') }}
                className="text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors">
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center gap-4 text-center px-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4a9eff]/15 to-[#4a9eff]/5 border border-[#4a9eff]/20 flex items-center justify-center">
                  <Users size={28} className="text-[#4a9eff]" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#d4a843] rounded-full flex items-center justify-center">
                  <span className="text-black text-[10px] font-black">+</span>
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-white mb-1">Aucun client encore</p>
                <p className="text-xs text-gray-500 max-w-xs">Ajoutez vos clients pour créer des factures rapidement et suivre leurs paiements</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_16px_rgba(212,168,67,0.2)]"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Ajouter mon premier client
                </button>
                <Link
                  href="/dashboard/invoices/new"
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ou créer une facture directement →
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-6 text-center">
                {[
                  { icon: '📊', label: 'Suivi des paiements' },
                  { icon: '⚡', label: 'Prédiction de retard' },
                  { icon: '🔗', label: 'Liens de partage' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-1">
                    <span className="text-xl">{f.icon}</span>
                    <span className="text-[10px] text-gray-600">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1b22]">
                    {['Nom', 'Type', 'Matricule Fiscal', 'Telephone', 'Email', 'Factures', 'CA Total', 'Solde dû', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1b22]">
                  {paginated.map(c => {
                    const { count, ca, balance } = getStats(c)
                    return (
                      <tr key={c.id} className="hover:bg-[#161b27]/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-gray-200 hover:text-[#d4a843] transition-colors">
                            {c.name}
                          </Link>
                          {c.gouvernorat && <div className="text-[10px] text-gray-600">{c.gouvernorat}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                            c.type === 'B2B'
                              ? 'bg-[#d4a843]/10 text-[#d4a843] border-[#d4a843]/20'
                              : 'bg-[#4a9eff]/10 text-[#4a9eff] border-[#4a9eff]/20'
                          }`}>
                            {c.type ?? 'B2B'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {c.matricule_fiscal ?? <span className="text-gray-700 italic"></span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{c.phone ?? ''}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate">{c.email ?? ''}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-300 text-center">{count}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                          {ca > 0 ? fmtTND(ca) + ' TND' : ''}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {balance > 0
                            ? <span className="text-[#f59e0b] font-bold">{fmtTND(balance)} TND</span>
                            : count > 0 ? <span className="text-[#2dd4a0] text-[10px]">✓ Soldé</span> : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button onClick={() => setDropdownOpen(dropdownOpen === c.id ? null : c.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-[#252830] transition-colors">
                              <MoreVertical size={14} />
                            </button>
                            {dropdownOpen === c.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(null)} />
                                <div className="absolute right-0 top-8 z-20 w-48 bg-[#161b27] border border-[#252830] rounded-xl shadow-2xl overflow-hidden py-1">
                                  <Link href={`/dashboard/clients/${c.id}`} onClick={() => setDropdownOpen(null)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors">
                                    Voir le détail
                                  </Link>
                                  <Link href={`/dashboard/invoices/new?client_id=${c.id}`} onClick={() => setDropdownOpen(null)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#d4a843] hover:bg-[#d4a843]/10 transition-colors">
                                    + Nouvelle facture
                                  </Link>
                                  <div className="my-1 border-t border-[#1a1b22]" />
                                  <button onClick={() => openEdit(c)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors text-left">
                                    Modifier
                                  </button>
                                  <Link href={`/dashboard/invoices?client_id=${c.id}`} onClick={() => setDropdownOpen(null)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors">
                                    Voir ses factures
                                  </Link>
                                  <div className="my-1 border-t border-[#252830]" />
                                  <button onClick={() => { setDeleteId(c.id); setDropdownOpen(null) }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/20 transition-colors text-left">
                                    Supprimer
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1b22]">
                <span className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} clients
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-[#1a1b22] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
                     Precedent
                  </button>
                  <span className="px-3 py-1.5 text-xs text-gray-400">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-[#1a1b22] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
                    Suivant 
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {activeCompany && (
        <ClientModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={() => { load(); showToast(editClient?.id ? 'Client modifie.' : 'Client ajoute.') }}
          companyId={activeCompany.id}
          initial={editClient}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce client ?"
        description="Cette action est irreversible. Les factures associees ne seront pas supprimees."
        confirmLabel="Supprimer"
        dangerous
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
