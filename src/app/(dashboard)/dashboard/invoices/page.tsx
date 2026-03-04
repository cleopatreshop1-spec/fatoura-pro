'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, MoreVertical, FileText, ChevronUp, ChevronDown, CheckSquare, Trash2, Download, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { fmtTND } from '@/lib/utils/tva-calculator'
import { nextInvoiceNumber } from '@/lib/utils/invoice-number'
import { LatePaymentRisk } from '@/components/invoice/LatePaymentRisk'
import { InvoiceGapDetector } from '@/components/invoice/InvoiceGapDetector'
import { InvoiceQuickPreview } from '@/components/invoice/InvoiceQuickPreview'

type InvRow = {
  id: string; number: string | null; status: string
  issue_date: string | null; due_date: string | null
  ht_amount: number; tva_amount: number; ttc_amount: number
  ttn_id: string | null; ttn_rejection_reason: string | null
  payment_status: string | null; created_at: string; currency: string | null
  clients: { id: string; name: string; type: string; matricule_fiscal: string | null } | null
}
type SortField = 'number' | 'issue_date' | 'due_date' | 'ttc_amount' | 'status'
type ClientRow = { id: string; name: string }
const PAGE_SIZE = 25

function getPeriodRange(p: string): { from: string; to: string } {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  const today = now.toISOString().slice(0, 10)
  if (p === 'this_month')   return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: today }
  if (p === 'this_quarter') { const q=Math.floor(m/3); return { from: `${y}-${String(q*3+1).padStart(2,'0')}-01`, to: today } }
  if (p === 'this_year')    return { from: `${y}-01-01`, to: today }
  return { from: '', to: '' }
}

export default function InvoicesPage() {
  const { activeCompany } = useCompany()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [invoices, setInvoices] = useState<InvRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [period, setPeriod] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all'|'paid'|'unpaid'|'overdue'>('all')
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc'|'desc' }>({ field: 'issue_date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dropdown, setDropdown] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null)
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data: cls } = await supabase.from('clients').select('id, name').eq('company_id', activeCompany.id).order('name')
    setClients((cls ?? []) as ClientRow[])
    const { data } = await supabase
      .from('invoices')
      .select('id, number, status, issue_date, due_date, ht_amount, tva_amount, ttc_amount, ttn_id, ttn_rejection_reason, payment_status, created_at, clients(id, name, type, matricule_fiscal)')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
    setInvoices((data ?? []) as unknown as InvRow[])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Debounced search
  function handleSearchInput(v: string) {
    setSearchInput(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1) }, 300)
  }

  // Sort toggle
  function toggleSort(field: SortField) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' })
    setPage(1)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ChevronDown size={11} className="text-gray-700 ml-0.5" />
    return sort.dir === 'asc' ? <ChevronUp size={11} className="text-[#d4a843] ml-0.5" /> : <ChevronDown size={11} className="text-[#d4a843] ml-0.5" />
  }

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let list = invoices
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i => (i.number ?? '').toLowerCase().includes(q) || (i.clients?.name ?? '').toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
    if (clientFilter) list = list.filter(i => i.clients?.id === clientFilter)
    if (period !== 'all' && period !== 'custom') {
      const { from, to } = getPeriodRange(period)
      if (from) list = list.filter(i => (i.issue_date ?? '') >= from)
      if (to)   list = list.filter(i => (i.issue_date ?? '') <= to)
    } else if (period === 'custom') {
      if (customFrom) list = list.filter(i => (i.issue_date ?? '') >= customFrom)
      if (customTo)   list = list.filter(i => (i.issue_date ?? '') <= customTo)
    }
    if (amountMin) list = list.filter(i => Number(i.ttc_amount ?? 0) >= Number(amountMin))
    if (amountMax) list = list.filter(i => Number(i.ttc_amount ?? 0) <= Number(amountMax))
    if (paymentFilter === 'paid') list = list.filter(i => i.payment_status === 'paid')
    if (paymentFilter === 'unpaid') list = list.filter(i => i.payment_status !== 'paid')
    if (paymentFilter === 'overdue') list = list.filter(i => isOverdue(i))
    // Sort
    list = [...list].sort((a, b) => {
      let av: any = a[sort.field as keyof InvRow] ?? ''
      let bv: any = b[sort.field as keyof InvRow] ?? ''
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return list
  }, [invoices, search, statusFilter, clientFilter, period, customFrom, customTo, sort, amountMin, amountMax, paymentFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const summary = useMemo(() => ({
    ht:  filtered.reduce((s,i) => s + Number(i.ht_amount ?? 0), 0),
    tva: filtered.reduce((s,i) => s + Number(i.tva_amount ?? 0), 0),
    ttc: filtered.reduce((s,i) => s + Number(i.ttc_amount ?? 0), 0),
  }), [filtered])
  const hasFilters = search || statusFilter !== 'all' || period !== 'all' || clientFilter || amountMin || amountMax || paymentFilter !== 'all'
  const hasMultiCurrency = invoices.some(i => i.currency && i.currency !== 'TND')

  // Selection
  const allPageSelected = paginated.length > 0 && paginated.every(i => selected.has(i.id))
  function toggleAll() {
    if (allPageSelected) setSelected(s => { const n=new Set(s); paginated.forEach(i=>n.delete(i.id)); return n })
    else setSelected(s => { const n=new Set(s); paginated.forEach(i=>n.add(i.id)); return n })
  }
  function toggleRow(id: string) {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }
  const selectedInvs = invoices.filter(i => selected.has(i.id))

  // Actions
  async function handleDuplicate(inv: InvRow) {
    setDropdown(null)
    const { data: lastInv } = await supabase.from('invoices').select('number').eq('company_id', activeCompany!.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const { data: co } = await supabase.from('companies').select('invoice_prefix').eq('id', activeCompany!.id).single()
    const prefix = (co as any)?.invoice_prefix ?? 'FP'
    const num = nextInvoiceNumber((lastInv as any)?.number, prefix)
    const { data: newInv } = await supabase.from('invoices').insert({
      company_id: activeCompany!.id, client_id: inv.clients?.id ?? null,
      number: num, issue_date: new Date().toISOString().slice(0,10),
      status: 'draft', ht_amount: inv.ht_amount, tva_amount: inv.tva_amount,
      stamp_amount: 0.6, ttc_amount: inv.ttc_amount,
    }).select('id').single()
    if (newInv) {
      const { data: lines } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', inv.id).order('sort_order')
      if (lines?.length) {
        await supabase.from('invoice_line_items').insert(
          lines.map(({ id: _id, ...l }: any) => ({ ...l, invoice_id: (newInv as any).id }))
        )
      }
      router.push(`/dashboard/invoices/${(newInv as any).id}`)
    }
  }

  async function handleResubmit(inv: InvRow) {
    setDropdown(null)
    const res = await fetch('/api/invoices/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: inv.id }) })
    const d = await res.json()
    showToast(res.ok ? 'Facture remise en file TTN' : (d.error ?? 'Erreur'))
    if (res.ok) load()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await (supabase as any).from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', deleteId)
    setDeleteId(null); setDeleting(false); showToast('Facture supprimee.')
    load()
  }

  function exportCSV() {
    const headers = ['N Facture','Client','Date','Echeance','HT','TVA','TTC','Statut','TTN_ID']
    const rows = selectedInvs.map(i => [
      i.number??'',i.clients?.name??'',i.issue_date??'',i.due_date??'',
      i.ht_amount,i.tva_amount,i.ttc_amount,i.status,i.ttn_id??''
    ].map(v=>String(v).replace(/,/g,' ')))
    const csv = [headers, ...rows].map(r=>r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'factures.csv'; a.click()
  }

  async function quickUpdateDueDate(id: string, newDate: string) {
    if (!newDate) return
    await supabase.from('invoices').update({ due_date: newDate }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, due_date: newDate } : i))
    setEditingDueDate(null)
    showToast('Échéance mise à jour')
  }

  async function quickMarkPaid(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
    await supabase.from('invoices').update({
      payment_status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
    }).eq('id', id)
    showToast(newStatus === 'paid' ? 'Facture marquée comme payée' : 'Marquée non payée')
    load()
    setDropdown(null)
  }

  async function bulkMarkPaid() {
    const ids = invoices.filter(i => selected.has(i.id) && i.payment_status !== 'paid').map(i => i.id)
    if (!ids.length) return
    await Promise.all(ids.map(id =>
      supabase.from('invoices').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    ))
    setSelected(new Set()); showToast(`${ids.length} facture${ids.length > 1 ? 's' : ''} marquée${ids.length > 1 ? 's' : ''} comme payée${ids.length > 1 ? 's' : ''}`)
    load()
  }

  async function exportZIP() {
    const ids = invoices.filter(i => selected.has(i.id)).map(i => i.id)
    if (!ids.length) return
    setZipProgress({ current: 0, total: ids.length })
    try {
      const res = await fetch('/api/invoices/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) { setZipProgress(null); showToast('Erreur export ZIP'); return }
      // Simulate per-invoice progress while waiting for response
      for (let i = 1; i <= ids.length; i++) {
        setZipProgress({ current: i, total: ids.length })
        await new Promise(r => setTimeout(r, Math.max(200, 1200 / ids.length)))
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `factures_${new Date().toISOString().slice(0,10)}.zip`
      a.click()
    } finally {
      setZipProgress(null)
      showToast(`${ids.length} facture${ids.length>1?'s':''} exportée${ids.length>1?'s':''} en ZIP`)
    }
  }

  async function bulkDeleteDrafts() {
    const ids = invoices.filter(i => selected.has(i.id) && ['draft', 'validated'].includes(i.status)).map(i => i.id)
    if (!ids.length) return
    await Promise.all(ids.map(id =>
      (supabase as any).from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    ))
    setSelected(new Set()); showToast(`${ids.length} brouillon${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`)
    load()
  }

  async function copyTTN(id: string) {
    await navigator.clipboard.writeText(id); showToast('TTN_ID copie !')
  }

  function isOverdue(inv: InvRow) {
    return inv.due_date && new Date(inv.due_date) < new Date() && inv.payment_status !== 'paid'
  }

  const STATUS_OPTS = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'validated', label: 'Finalisée' },
    { value: 'queued', label: 'File attente' },
    { value: 'pending', label: 'En attente TTN' },
    { value: 'valid', label: 'Validée TTN' },
    { value: 'rejected', label: 'Rejetée' },
  ]

  const SEL = 'bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#d4a843] transition-colors'

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      {/* ZIP export progress overlay */}
      {zipProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-8 py-7 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#d4a843]/10 border border-[#d4a843]/30 flex items-center justify-center">
                <Download size={15} className="text-[#d4a843]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Export ZIP PDF</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {zipProgress.current < zipProgress.total
                    ? `Génération ${zipProgress.current} / ${zipProgress.total}...`
                    : 'Compression en cours...'}
                </p>
              </div>
            </div>
            <div className="w-full h-2 bg-[#1a1b22] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4a843] rounded-full transition-all duration-300"
                style={{ width: `${Math.round((zipProgress.current / zipProgress.total) * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-600">
              <span>{zipProgress.current} facture{zipProgress.current !== 1 ? 's' : ''}</span>
              <span>{Math.round((zipProgress.current / zipProgress.total) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Factures <span className="text-sm text-gray-500 font-normal">({filtered.length})</span>
          </h1>
          <p className="text-gray-500 text-sm">Gestion et suivi de vos factures</p>
        </div>
        <Link href="/dashboard/invoices/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
          <Plus size={15} strokeWidth={2.5} />Nouvelle facture
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchInput} onChange={e => handleSearchInput(e.target.value)}
            placeholder="N° facture, client..."
            className="w-full bg-[#0f1118] border border-[#1a1b22] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className={SEL}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1) }} className={SEL}>
          <option value="all">Toute periode</option>
          <option value="this_month">Ce mois</option>
          <option value="this_quarter">Ce trimestre</option>
          <option value="this_year">Cette annee</option>
          <option value="custom">Personnalise</option>
        </select>
        {period === 'custom' && <>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={SEL} />
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={SEL} />
        </>}
        <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1) }} className={SEL}>
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* Amount range */}
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" step="1" placeholder="Min TND"
            value={amountMin} onChange={e => { setAmountMin(e.target.value); setPage(1) }}
            className="w-24 bg-[#0f1118] border border-[#1a1b22] rounded-xl px-2.5 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
          />
          <span className="text-gray-600 text-xs">–</span>
          <input
            type="number" min="0" step="1" placeholder="Max TND"
            value={amountMax} onChange={e => { setAmountMax(e.target.value); setPage(1) }}
            className="w-24 bg-[#0f1118] border border-[#1a1b22] rounded-xl px-2.5 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
          />
        </div>
        {hasFilters && (
          <button onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('all'); setPeriod('all'); setClientFilter(''); setCustomFrom(''); setCustomTo(''); setAmountMin(''); setAmountMax(''); setPaymentFilter('all'); setPage(1) }}
            className="px-3 py-2 text-xs text-gray-400 hover:text-white border border-[#1a1b22] rounded-xl transition-colors">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Quick-filter chip bar */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTS.map(o => {
          const count = o.value === 'all'
            ? invoices.length
            : invoices.filter(i => i.status === o.value).length
          if (o.value !== 'all' && count === 0) return null
          const active = statusFilter === o.value
          const CHIP_COLOR: Record<string, string> = {
            all:       active ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:text-gray-300 hover:border-[#252830]',
            draft:     active ? 'bg-gray-700/40 border-gray-600/50 text-gray-200' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
            validated: active ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
            queued:    active ? 'bg-blue-950/40 border-blue-800/50 text-blue-300' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
            pending:   active ? 'bg-[#4a9eff]/15 border-[#4a9eff]/40 text-[#4a9eff]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
            valid:     active ? 'bg-[#2dd4a0]/15 border-[#2dd4a0]/40 text-[#2dd4a0]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
            rejected:  active ? 'bg-red-950/40 border-red-800/50 text-red-400' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]',
          }
          return (
            <button key={o.value}
              onClick={() => { setStatusFilter(o.value); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${CHIP_COLOR[o.value] ?? ''}`}>
              {o.label}
              <span className={`text-[10px] font-mono ${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Payment filter chip bar */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { value: 'all',     label: 'Paiement',  count: invoices.length },
          { value: 'paid',    label: '✓ Payées',   count: invoices.filter(i => i.payment_status === 'paid').length },
          { value: 'unpaid',  label: 'Impayées',  count: invoices.filter(i => i.payment_status !== 'paid').length },
          { value: 'overdue', label: '⚠ Retard',  count: invoices.filter(i => isOverdue(i)).length },
        ] as { value: 'all'|'paid'|'unpaid'|'overdue'; label: string; count: number }[]).map(o => {
          if (o.value !== 'all' && o.count === 0) return null
          const active = paymentFilter === o.value
          const col =
            o.value === 'paid'    ? (active ? 'bg-[#2dd4a0]/15 border-[#2dd4a0]/40 text-[#2dd4a0]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]') :
            o.value === 'unpaid'  ? (active ? 'bg-[#f59e0b]/15 border-[#f59e0b]/40 text-[#f59e0b]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]') :
            o.value === 'overdue' ? (active ? 'bg-red-950/40 border-red-800/50 text-red-400'        : 'border-[#1a1b22] text-gray-600 hover:text-gray-300 hover:border-[#252830]') :
            active ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:text-gray-300 hover:border-[#252830]'
          return (
            <button key={o.value}
              onClick={() => { setPaymentFilter(o.value); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${col}`}>
              {o.label}
              <span className={`text-[10px] font-mono ${active ? 'opacity-80' : 'opacity-50'}`}>{o.count}</span>
            </button>
          )
        })}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
          <span className="font-medium text-gray-400">{filtered.length} facture{filtered.length!==1?'s':''}</span>
          <span> HT: <span className="text-gray-300 font-mono">{fmtTND(summary.ht)} TND</span></span>
          <span> TVA: <span className="text-gray-300 font-mono">{fmtTND(summary.tva)} TND</span></span>
          <span> TTC: <span className="text-gray-200 font-mono font-bold">{fmtTND(summary.ttc)} TND</span></span>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#0d1420] border border-[#d4a843]/30 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#d4a843] font-bold shrink-0">
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 flex-wrap">
            <button onClick={bulkMarkPaid}
              className="flex items-center gap-1.5 text-xs text-[#2dd4a0] border border-[#2dd4a0]/30 bg-[#2dd4a0]/5 hover:bg-[#2dd4a0]/10 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <CheckSquare size={12} />Marquer payées
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-[#252830] px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} />CSV
            </button>
            <button onClick={exportZIP}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-[#252830] px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} />ZIP PDF
            </button>
            {invoices.some(i => selected.has(i.id) && ['draft','validated'].includes(i.status)) && (
              <button onClick={bulkDeleteDrafts}
                className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900/30 hover:bg-red-950/20 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 size={12} />Supprimer brouillons
              </button>
            )}
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-gray-600 hover:text-white px-2 py-1.5 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Gap detector */}
      <InvoiceGapDetector invoices={invoices} prefix={activeCompany?.invoice_prefix ?? 'FP'} />

      {/* Table */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#1a1b22]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="w-3.5 h-3.5 rounded bg-[#1a1b22]" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-24" />
                <div className="h-3.5 bg-[#1a1b22] rounded flex-1 max-w-[140px]" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-20 hidden sm:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-20 hidden md:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-20 hidden lg:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-20 hidden lg:block" />
                <div className="h-3.5 bg-[#1a1b22] rounded w-24" />
                <div className="h-5 bg-[#1a1b22] rounded-full w-20" />
                <div className="w-6 h-6 rounded bg-[#1a1b22] ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center">
                <Search size={20} className="text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-400">Aucune facture ne correspond à vos filtres</p>
              <p className="text-xs text-gray-600">Essayez de modifier le statut, la période ou le terme de recherche</p>
              <button
                onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter('all'); setPeriod('all'); setClientFilter('') }}
                className="mt-1 text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors"
              >
                Effacer tous les filtres
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center gap-4 text-center px-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d4a843]/15 to-[#d4a843]/5 border border-[#d4a843]/20 flex items-center justify-center">
                  <FileText size={28} className="text-[#d4a843]" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#d4a843] rounded-full flex items-center justify-center">
                  <span className="text-black text-[10px] font-black">+</span>
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-white mb-1">Aucune facture encore</p>
                <p className="text-xs text-gray-500 max-w-xs">Créez votre première facture électronique conforme TTN en moins de 2 minutes</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                <Link
                  href="/dashboard/invoices/new"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_16px_rgba(212,168,67,0.2)]"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Créer ma première facture
                </Link>
                <Link
                  href="/dashboard/clients"
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ou ajouter un client d&apos;abord →
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1b22]">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                    </th>
                    {([['number','N° Facture',''],['','Client',''],['issue_date','Date',''],['due_date','Échéance','hidden md:table-cell'],
                       ['ht_amount','HT','hidden lg:table-cell'],['tva_amount','TVA','hidden lg:table-cell'],['ttc_amount','TTC',''],
                       ...(hasMultiCurrency ? [['','Devise','hidden xl:table-cell']] as [SortField|'',string,string][] : []),
                       ['status','Statut',''],['','TTN_ID','hidden xl:table-cell'],['','']
                    ] as [SortField|'',string,string][]).map(([field, label, hide]) => (
                      <th key={label} onClick={() => field && toggleSort(field as SortField)}
                        className={`px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap ${hide} ${field?'cursor-pointer hover:text-gray-400 select-none':''}`}>
                        <span className="flex items-center">
                          {label}
                          {field && <SortIcon field={field as SortField} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1b22]">
                  {paginated.map(inv => (
                    <tr key={inv.id} className={`hover:bg-[#161b27]/50 transition-colors ${selected.has(inv.id)?'bg-[#d4a843]/5':''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleRow(inv.id)}
                          className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceQuickPreview
                          id={inv.id}
                          number={inv.number}
                          status={inv.status}
                          clientName={inv.clients?.name ?? null}
                          clientType={inv.clients?.type ?? null}
                          issueDate={inv.issue_date}
                          dueDate={inv.due_date}
                          htAmount={Number(inv.ht_amount ?? 0)}
                          tvaAmount={Number(inv.tva_amount ?? 0)}
                          ttcAmount={Number(inv.ttc_amount ?? 0)}
                          paymentStatus={inv.payment_status}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center flex-wrap gap-0.5">
                          <span className="text-gray-300 text-xs">{inv.clients?.name ?? <span className="text-gray-600"></span>}</span>
                          {inv.clients?.type && (
                            <span className={`ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded border ${inv.clients.type==='B2B'?'text-[#d4a843] border-[#d4a843]/20':'text-[#4a9eff] border-[#4a9eff]/20'}`}>
                              {inv.clients.type}
                            </span>
                          )}
                          {inv.payment_status !== 'paid' && (
                            <LatePaymentRisk
                              invoiceId={inv.id}
                              clientId={inv.clients?.id}
                              dueDate={inv.due_date}
                              allInvoices={invoices as any}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                        {editingDueDate === inv.id ? (
                          <input
                            type="date"
                            defaultValue={inv.due_date ?? ''}
                            autoFocus
                            onBlur={e => quickUpdateDueDate(inv.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') quickUpdateDueDate(inv.id, (e.target as HTMLInputElement).value)
                              if (e.key === 'Escape') setEditingDueDate(null)
                            }}
                            className="bg-[#0f1118] border border-[#d4a843]/60 rounded-lg px-2 py-1 text-xs text-white outline-none w-32"
                          />
                        ) : (
                          <span
                            onClick={() => setEditingDueDate(inv.id)}
                            title="Cliquer pour modifier l'échéance"
                            className={`text-xs cursor-pointer hover:text-white transition-colors group ${isOverdue(inv) ? 'text-red-400' : 'text-gray-400'}`}>
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : <span className="text-gray-700 hover:text-gray-500">+ Ajouter</span>}
                            {isOverdue(inv) ? (
                              <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30">Retard</span>
                            ) : inv.payment_status !== 'paid' && inv.due_date && (() => {
                              const daysLeft = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000)
                              return daysLeft >= 0 && daysLeft <= 7
                                ? <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/30">J-{daysLeft}</span>
                                : null
                            })()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap text-right hidden lg:table-cell">{fmtTND(Number(inv.ht_amount??0))}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap text-right hidden lg:table-cell">{fmtTND(Number(inv.tva_amount??0))}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-200 font-bold whitespace-nowrap text-right">
                        {fmtTND(Number(inv.ttc_amount??0))}
                      </td>
                      {hasMultiCurrency && (
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {inv.currency && inv.currency !== 'TND' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950/30 text-blue-400 border border-blue-900/30">{inv.currency}</span>
                          ) : (
                            <span className="text-[10px] text-gray-700">TND</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {inv.ttn_id ? (
                          <button onClick={() => copyTTN(inv.ttn_id!)}
                            className="font-mono text-[10px] text-[#d4a843] hover:text-[#f0c060] truncate max-w-[80px] block transition-colors" title="Copier TTN_ID">
                            {inv.ttn_id.slice(0,12)}
                          </button>
                        ) : <span className="text-gray-700"></span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button onClick={() => setDropdown(dropdown===inv.id?null:inv.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-[#252830] transition-colors">
                            <MoreVertical size={14} />
                          </button>
                          {dropdown === inv.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setDropdown(null)} />
                              <div className="absolute right-0 top-8 z-20 w-52 bg-[#161b27] border border-[#252830] rounded-xl shadow-2xl overflow-hidden py-1">
                                <Link href={`/dashboard/invoices/${inv.id}`} onClick={()=>setDropdown(null)}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors">
                                  Voir le détail
                                </Link>
                                {/* Quick pay toggle */}
                                {!['draft'].includes(inv.status) && (
                                  <>
                                    <div className="my-1 border-t border-[#1a1b22]" />
                                    <button
                                      onClick={() => quickMarkPaid(inv.id, inv.payment_status ?? 'unpaid')}
                                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                                        inv.payment_status === 'paid'
                                          ? 'text-gray-400 hover:bg-[#252830] hover:text-white'
                                          : 'text-[#2dd4a0] hover:bg-[#2dd4a0]/10'
                                      }`}>
                                      <DollarSign size={13} />
                                      {inv.payment_status === 'paid' ? 'Marquer non payée' : 'Marquer payée ✔'}
                                    </button>
                                    <div className="my-1 border-t border-[#1a1b22]" />
                                  </>
                                )}
                                <button onClick={() => handleDuplicate(inv)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors text-left">
                                  Dupliquer
                                </button>
                                {['rejected','draft','validated'].includes(inv.status) && (
                                  <button onClick={() => handleResubmit(inv)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#252830] hover:text-white transition-colors text-left">
                                    Soumettre à TTN
                                  </button>
                                )}
                                {['draft','validated'].includes(inv.status) && <>
                                  <div className="my-1 border-t border-[#252830]" />
                                  <button onClick={() => { setDeleteId(inv.id); setDropdown(null) }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/20 transition-colors text-left">
                                    Supprimer
                                  </button>
                                </>}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1b22]">
                <span className="text-xs text-gray-500">
                  Affichage {(page-1)*PAGE_SIZE+1}{Math.min(page*PAGE_SIZE,filtered.length)} sur {filtered.length} factures
                </span>
                <div className="flex gap-2">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    className="px-3 py-1.5 text-xs border border-[#1a1b22] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors"> Precedent</button>
                  <span className="px-3 py-1.5 text-xs text-gray-400">{page} / {totalPages}</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                    className="px-3 py-1.5 text-xs border border-[#1a1b22] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors">Suivant </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog open={!!deleteId} title="Supprimer cette facture ?"
        description="Cette action est irreversible." confirmLabel="Supprimer" dangerous
        loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
