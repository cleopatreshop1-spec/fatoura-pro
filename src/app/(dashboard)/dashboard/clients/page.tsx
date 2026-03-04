'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, MoreVertical, Users, ChevronUp, ChevronDown, Download, Trash2 } from 'lucide-react'
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
  credit_limit: number | null
  created_at: string
  invoices: { id: string; ttc_amount: number | null; status: string; payment_status: string | null; due_date: string | null; issue_date: string | null; paid_at: string | null }[]
}
type FilterType = 'all' | 'B2B' | 'B2C'
type SortField = 'name' | 'count' | 'ca' | 'balance' | 'credit' | 'lastInv'

const PAGE_SIZE = 25

export default function ClientsPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [govFilter, setGovFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<ClientRecord | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [merging, setMerging] = useState(false)

  function toggleRow(id: string) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll(ids: string[]) {
    if (ids.every(id => selected.has(id))) setSelected(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
    else setSelected(s => { const n = new Set(s); ids.forEach(id => n.add(id)); return n })
  }
  async function mergeClients() {
    if (selected.size !== 2) return
    const [keepId, removeId] = [...selected]
    const keepClient  = clients.find(c => c.id === keepId)
    const removeClient = clients.find(c => c.id === removeId)
    if (!keepClient || !removeClient) return
    if (!window.confirm(`Fusionner "${removeClient.name}" dans "${keepClient.name}" ?\n\nToutes les factures de "${removeClient.name}" seront réassignées à "${keepClient.name}", puis ce client sera supprimé.`)) return
    setMerging(true)
    await supabase.from('invoices').update({ client_id: keepId }).eq('client_id', removeId)
    await supabase.from('clients').delete().eq('id', removeId)
    setMerging(false)
    setSelected(new Set())
    showToast(`Fusion réussie — factures de "${removeClient.name}" transférées`)
    load()
  }

  async function bulkDelete() {
    if (!selected.size) return
    setBulkDeleting(true)
    await Promise.all([...selected].map(id => supabase.from('clients').delete().eq('id', id)))
    setBulkDeleting(false)
    setSelected(new Set())
    showToast(`${selected.size} client${selected.size > 1 ? 's' : ''} supprimé${selected.size > 1 ? 's' : ''}`)
    load()
  }

  function toggleSort(field: SortField) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'name' ? 'asc' : 'desc' })
    setPage(1)
  }

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*, invoices(id, ttc_amount, status, payment_status, due_date, issue_date, paid_at)')
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

  const todayStr = new Date().toISOString().slice(0, 10)

  function getStats(c: ClientRow) {
    const validInvs = c.invoices?.filter(i => i.status !== 'draft') ?? []
    const count = validInvs.length
    const ca = validInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
    const unpaidInvs = validInvs.filter(i => i.payment_status !== 'paid')
    const balance = unpaidInvs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
    const unpaid = unpaidInvs.length
    const maxOverdueDays = unpaidInvs
      .filter(i => i.due_date && i.due_date < todayStr)
      .reduce((max, i) => {
        const days = Math.floor((new Date(todayStr).getTime() - new Date(i.due_date!).getTime()) / 86400000)
        return days > max ? days : max
      }, 0)
    const paidWithDue = validInvs.filter(i => i.payment_status === 'paid' && i.paid_at && i.due_date)
    const avgPayDelay = paidWithDue.length > 0
      ? Math.round(paidWithDue.reduce((s, i) => {
          return s + (new Date(i.paid_at!).getTime() - new Date(i.due_date!).getTime()) / 86400000
        }, 0) / paidWithDue.length)
      : null
    return { count, ca, balance, unpaid, maxOverdueDays, avgPayDelay }
  }

  function getRisk(c: ClientRow): { label: string; color: string; bg: string } | null {
    const { count, ca, balance, unpaid } = getStats(c)
    if (count === 0) return null
    const unpaidRatio = count > 0 ? unpaid / count : 0
    const balanceRatio = ca > 0 ? balance / ca : 0
    const score = unpaidRatio * 0.5 + balanceRatio * 0.5
    if (score >= 0.6) return { label: 'Risque élevé', color: 'text-red-400',    bg: 'bg-red-950/30 border-red-900/30' }
    if (score >= 0.3) return { label: 'Risque moyen', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/20' }
    return null
  }

  // Filtered + searched + sorted clients
  const filtered = useMemo(() => {
    let list = clients
    if (filter !== 'all') list = list.filter(c => c.type === filter)
    if (govFilter) list = list.filter(c => c.gouvernorat === govFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.matricule_fiscal ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const sa = getStats(a), sb = getStats(b)
      let av: string | number = 0, bv: string | number = 0
      const aLast = a.invoices?.reduce((m: string, i: any) => i.status !== 'draft' && i.issue_date > m ? i.issue_date : m, '') ?? ''
      const bLast = b.invoices?.reduce((m: string, i: any) => i.status !== 'draft' && i.issue_date > m ? i.issue_date : m, '') ?? ''
      if (sort.field === 'name')    { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      if (sort.field === 'count')   { av = sa.count;  bv = sb.count }
      if (sort.field === 'ca')      { av = sa.ca;     bv = sb.ca }
      if (sort.field === 'balance') { av = sa.balance; bv = sb.balance }
      if (sort.field === 'credit')  { av = a.credit_limit ? (sa.balance / Number(a.credit_limit)) : -1; bv = b.credit_limit ? (sb.balance / Number(b.credit_limit)) : -1 }
      if (sort.field === 'lastInv') { av = aLast; bv = bLast }
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sort.dir === 'asc' ? av - (bv as number) : (bv as number) - av
    })
    return list
  }, [clients, filter, govFilter, search, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  function exportCSV() {
    const header = 'Nom,Type,Matricule Fiscal,Telephone,Email,Gouvernorat,Factures,CA Total (TTC),Solde du,Plafond credit'
    const rows = filtered.map(c => {
      const { count, ca, balance } = getStats(c)
      return [
        `"${c.name.replace(/"/g,'""')}"`,
        c.type ?? 'B2B',
        c.matricule_fiscal ?? '',
        c.phone ?? '',
        c.email ?? '',
        c.gouvernorat ?? '',
        count,
        ca.toFixed(3),
        balance.toFixed(3),
        c.credit_limit != null ? Number(c.credit_limit).toFixed(3) : '',
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `clients_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

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
          {filtered.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30 rounded-xl transition-colors">
              <Download size={13} />
              CSV
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            <Plus size={15} strokeWidth={2.5} />
            Ajouter un client
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (() => {
        const totalCA      = filtered.reduce((s, c) => s + getStats(c).ca, 0)
        const totalUnpaid  = filtered.reduce((s, c) => s + getStats(c).balance, 0)
        const unpaidCount  = filtered.reduce((s, c) => s + getStats(c).unpaid, 0)
        return (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-2.5 items-center">
            <span className="font-bold text-gray-300">{filtered.length} client{filtered.length > 1 ? 's' : ''}</span>
            <span className="text-gray-700">·</span>
            <span>CA total <span className="font-mono font-semibold text-gray-300">{fmtTND(totalCA)} TND</span></span>
            {totalUnpaid > 0 && <>
              <span className="text-gray-700">·</span>
              <span>Impayé <span className="font-mono font-bold text-[#f59e0b]">{fmtTND(totalUnpaid)} TND</span>
                <span className="ml-1 text-gray-600">({unpaidCount} fact.)</span>
              </span>
            </>}
          </div>
        )
      })()}

      {/* Client growth sparkline — new clients per month (last 6 months) */}
      {clients.length >= 3 && (() => {
        const now6 = new Date()
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now6.getFullYear(), now6.getMonth() - (5 - i), 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const label = d.toLocaleDateString('fr-FR', { month: 'short' })
          const count = clients.filter(c => c.created_at.startsWith(key)).length
          return { label, count }
        })
        if (months.every(m => m.count === 0)) return null
        const maxCount = Math.max(...months.map(m => m.count), 1)
        const totalNew = months.reduce((s, m) => s + m.count, 0)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="shrink-0">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Nouveaux clients — 6 mois</p>
              <p className="text-lg font-mono font-black text-[#4a9eff] mt-0.5">+{totalNew}</p>
            </div>
            <div className="flex items-end gap-1.5 h-10 flex-1">
              {months.map((m, idx) => {
                const h = Math.max(3, Math.round((m.count / maxCount) * 36))
                const isLast = idx === 5
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.label}: ${m.count} nouveau${m.count > 1 ? 'x' : ''}`}>
                    <div className="w-full flex items-end justify-center" style={{ height: 36 }}>
                      <div className={`w-full rounded-t-sm ${isLast ? 'bg-[#4a9eff]' : m.count > 0 ? 'bg-[#4a9eff]/40' : 'bg-[#1a1b22]'}`} style={{ height: h }} />
                    </div>
                    <span className="text-[9px] text-gray-600">{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

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
        {(() => {
          const govs = [...new Set(clients.map(c => c.gouvernorat).filter(Boolean))].sort() as string[]
          if (govs.length < 2) return null
          return (
            <select value={govFilter} onChange={e => { setGovFilter(e.target.value); setPage(1) }}
              className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a843] transition-colors">
              <option value="">Tous gouvernorats</option>
              {govs.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )
        })()}
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
            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div className="bg-[#0d1420] border border-red-900/30 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-red-400 font-bold shrink-0">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
                {selected.size === 2 && (
                  <button onClick={mergeClients} disabled={merging}
                    className="flex items-center gap-1.5 text-xs text-[#2dd4a0] border border-[#2dd4a0]/30 bg-[#2dd4a0]/10 hover:bg-[#2dd4a0]/20 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
                    title="Fusionner les 2 clients — toutes les factures du 2e seront transférées vers le 1er">
                    ⇒ {merging ? 'Fusion...' : 'Fusionner'}
                  </button>
                )}
                <button onClick={bulkDelete} disabled={bulkDeleting}
                  className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50">
                  <Trash2 size={12} />{bulkDeleting ? 'Suppression...' : 'Supprimer la sélection'}
                </button>
                <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors">Désélectionner</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1b22]">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox"
                        checked={paginated.length > 0 && paginated.every(c => selected.has(c.id))}
                        onChange={() => toggleAll(paginated.map(c => c.id))}
                        className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                    </th>
                    {([
                      ['name',    'Nom',             'name'],
                      [null,      'Type',             null],
                      [null,      'Matricule Fiscal', null],
                      [null,      'Telephone',        null],
                      [null,      'Email',            null],
                      ['count',   'Factures',         'count'],
                      ['ca',      'CA Total',         'ca'],
                      ['balance', 'Solde dû',         'balance'],
                      ['credit',  'Plafond',           'credit'],
                      ['lastInv', 'Dernière facture',  'lastInv'],
                      [null,      '',                 null],
                    ] as [SortField | null, string, string | null][]).map(([field, label]) => (
                      <th key={label}
                        onClick={() => field && toggleSort(field)}
                        className={`px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap ${field ? 'cursor-pointer hover:text-gray-400 select-none' : ''}`}>
                        <span className="flex items-center gap-0.5">
                          {label}
                          {field && (
                            sort.field === field
                              ? sort.dir === 'asc'
                                ? <ChevronUp size={11} className="text-[#d4a843] ml-0.5" />
                                : <ChevronDown size={11} className="text-[#d4a843] ml-0.5" />
                              : <ChevronDown size={11} className="text-gray-700 ml-0.5" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1b22]">
                  {paginated.map(c => {
                    const { count, ca, balance, unpaid, maxOverdueDays, avgPayDelay } = getStats(c)
                    const lastInvDate = c.invoices?.reduce((m: string, i: any) => i.status !== 'draft' && (i.issue_date ?? '') > m ? (i.issue_date ?? '') : m, '') ?? ''
                    const risk = getRisk(c)
                    return (
                      <tr key={c.id} className={`hover:bg-[#161b27]/50 transition-colors ${selected.has(c.id) ? 'bg-red-950/10' : ''}`}>
                        <td className="px-4 py-3 w-8">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)}
                            className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-gray-200 hover:text-[#d4a843] transition-colors">
                              {c.name}
                            </Link>
                            {risk && (
                              <span title="Score de risque basé sur le ratio impayés/CA"
                                className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${risk.color} ${risk.bg}`}>
                                {risk.label}
                              </span>
                            )}
                            {count > 0 && balance > 0 && (
                              <span title={`${unpaid} facture${unpaid > 1 ? 's' : ''} impayée${unpaid > 1 ? 's' : ''}`}
                                className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-900/30">
                                {unpaid}
                              </span>
                            )}
                            {maxOverdueDays > 0 && (
                              <span title={`La plus ancienne facture impayée a ${maxOverdueDays}j de retard`}
                                className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  maxOverdueDays > 90 ? 'bg-red-950/40 text-red-400 border-red-900/30' :
                                  maxOverdueDays > 30 ? 'bg-orange-950/40 text-orange-400 border-orange-900/30' :
                                  'bg-amber-950/40 text-amber-400 border-amber-900/30'
                                }`}>
                                +{maxOverdueDays}j
                              </span>
                            )}
                            {avgPayDelay !== null && (
                              <span title={`Délai moyen de paiement : ${avgPayDelay >= 0 ? '+' : ''}${avgPayDelay} jours après échéance`}
                                className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  avgPayDelay > 15 ? 'bg-red-950/40 text-red-400 border-red-900/30' :
                                  avgPayDelay > 0  ? 'bg-amber-950/40 text-amber-400 border-amber-900/30' :
                                  'bg-[#2dd4a0]/10 text-[#2dd4a0] border-[#2dd4a0]/20'
                                }`}>
                                ø {avgPayDelay >= 0 ? '+' : ''}{avgPayDelay}j
                              </span>
                            )}
                            {count > 0 && lastInvDate && (() => {
                              const daysSince = Math.floor((Date.now() - new Date(lastInvDate).getTime()) / 86400000)
                              return daysSince > 90 ? (
                                <span title={`Aucune facture depuis ${daysSince} jours`}
                                  className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-800/60 text-gray-500 border border-gray-700/40">
                                  inactif
                                </span>
                              ) : null
                            })()}
                          </div>
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
                        <td className="px-4 py-3 text-xs whitespace-nowrap min-w-[100px]">
                          {c.credit_limit ? (() => {
                            const limit = Number(c.credit_limit)
                            const pct   = Math.min(100, Math.round((balance / limit) * 100))
                            const over  = balance > limit
                            const warn  = balance > limit * 0.8
                            return (
                              <div title={`${pct}% utilisé — ${fmtTND(balance)} / ${fmtTND(limit)} TND`}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`font-mono text-[10px] font-bold ${over ? 'text-red-400' : warn ? 'text-amber-400' : 'text-gray-500'}`}>
                                    {pct}%
                                  </span>
                                  {over && <span className="text-[9px] text-red-400 font-bold">Dépassé</span>}
                                </div>
                                <div className="h-1 bg-[#1a1b22] rounded-full overflow-hidden w-16">
                                  <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-[#2dd4a0]'}`}
                                    style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })() : <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap hidden xl:table-cell">
                          {lastInvDate ? new Date(lastInvDate).toLocaleDateString('fr-FR') : <span className="text-gray-700">—</span>}
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
