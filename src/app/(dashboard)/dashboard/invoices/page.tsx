'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, MoreVertical, FileText, ChevronUp, ChevronDown, CheckSquare, Trash2, Download, DollarSign, Columns2, Bookmark, X, Users } from 'lucide-react'
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
  payment_status: string | null; paid_at: string | null; payment_date: string | null; created_at: string; currency: string | null
  reference: string | null; notes: string | null
  clients: { id: string; name: string; type: string; matricule_fiscal: string | null } | null
}
type SortField = 'number' | 'issue_date' | 'due_date' | 'ttc_amount' | 'status'
type ClientRow = { id: string; name: string }
type FilterPreset = { name: string; status: string; payment: string; period: string; client: string; amountMin: string; amountMax: string }
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
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [groupByClient, setGroupByClient] = useState(false)
  function toggleCol(col: string) { setHiddenCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s }) }
  const [paymentFilter, setPaymentFilter] = useState<'all'|'paid'|'unpaid'|'overdue'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'B2B'|'B2C'>('all')
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc'|'desc' }>({ field: 'issue_date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dropdown, setDropdown] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null)
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null)
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null)
  const [payDateInvoiceId, setPayDateInvoiceId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10))
  const [bulkPayDate, setBulkPayDate] = useState(new Date().toISOString().slice(0,10))
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem('inv_filter_presets') ?? '[]') } catch { return [] }
  })

  function savePreset() {
    const name = window.prompt('Nom du preset :')
    if (!name?.trim()) return
    const preset: FilterPreset = { name: name.trim(), status: statusFilter, payment: paymentFilter, period, client: clientFilter, amountMin, amountMax }
    const next = [...savedPresets.filter(p => p.name !== preset.name), preset]
    setSavedPresets(next)
    localStorage.setItem('inv_filter_presets', JSON.stringify(next))
  }

  function applyPreset(p: FilterPreset) {
    setStatusFilter(p.status)
    setPaymentFilter(p.payment as any)
    setPeriod(p.period)
    setClientFilter(p.client)
    setAmountMin(p.amountMin)
    setAmountMax(p.amountMax)
    setPage(1)
  }

  function deletePreset(name: string) {
    const next = savedPresets.filter(p => p.name !== name)
    setSavedPresets(next)
    localStorage.setItem('inv_filter_presets', JSON.stringify(next))
  }

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data: cls } = await supabase.from('clients').select('id, name').eq('company_id', activeCompany.id).order('name')
    const { data: co } = await (supabase as any).from('companies').select('monthly_revenue_goal').eq('id', activeCompany.id).single()
    setMonthlyGoal(co?.monthly_revenue_goal ? Number(co.monthly_revenue_goal) : null)
    setClients((cls ?? []) as ClientRow[])
    const { data } = await supabase
      .from('invoices')
      .select('id, number, status, issue_date, due_date, ht_amount, tva_amount, ttc_amount, ttn_id, ttn_rejection_reason, payment_status, paid_at, payment_date, created_at, currency, reference, notes, clients(id,name,type,matricule_fiscal)')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
    setInvoices((data ?? []) as unknown as InvRow[])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return
      if (e.key === 'n' || e.key === 'N') router.push('/dashboard/invoices/new')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

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
      const qNum = parseFloat(search.replace(',', '.'))
      list = list.filter(i =>
        (i.number ?? '').toLowerCase().includes(q) ||
        (i.clients?.name ?? '').toLowerCase().includes(q) ||
        (i.reference ?? '').toLowerCase().includes(q) ||
        (i.notes ?? '').toLowerCase().includes(q) ||
        (!isNaN(qNum) && Math.abs(Number(i.ttc_amount ?? 0) - qNum) < 1)
      )
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
    if (typeFilter !== 'all') list = list.filter(i => i.clients?.type === typeFilter)
    // Sort
    list = [...list].sort((a, b) => {
      let av: any = a[sort.field as keyof InvRow] ?? ''
      let bv: any = b[sort.field as keyof InvRow] ?? ''
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return list
  }, [invoices, search, statusFilter, clientFilter, period, customFrom, customTo, sort, amountMin, amountMax, paymentFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const summary = useMemo(() => {
    const ttc    = filtered.reduce((s,i) => s + Number(i.ttc_amount ?? 0), 0)
    const avgTTC = filtered.length > 0 ? ttc / filtered.length : 0
    // Compare to the overall invoice avg (all invoices)
    const allAvg = invoices.length > 0 ? invoices.reduce((s,i) => s + Number(i.ttc_amount ?? 0), 0) / invoices.length : 0
    const avgDelta = allAvg > 0 ? Math.round(((avgTTC - allAvg) / allAvg) * 100) : null
    return {
      ht:     filtered.reduce((s,i) => s + Number(i.ht_amount ?? 0), 0),
      tva:    filtered.reduce((s,i) => s + Number(i.tva_amount ?? 0), 0),
      ttc,
      unpaid: filtered.filter(i => i.payment_status !== 'paid').reduce((s,i) => s + Number(i.ttc_amount ?? 0), 0),
      avgTTC,
      avgDelta,
    }
  }, [filtered, invoices])
  const hasFilters = search || statusFilter !== 'all' || period !== 'all' || clientFilter || amountMin || amountMax || paymentFilter !== 'all' || typeFilter !== 'all'

  const clientTotals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const inv of filtered) {
      const cid = inv.clients?.id
      if (cid) map[cid] = (map[cid] ?? 0) + Number(inv.ttc_amount ?? 0)
    }
    return map
  }, [filtered])

  const agingHeatmap = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const buckets = [
      { label: '1–30j',  min: 1,  max: 30,  color: 'bg-amber-500' },
      { label: '31–60j', min: 31, max: 60,  color: 'bg-orange-500' },
      { label: '61–90j', min: 61, max: 90,  color: 'bg-red-500' },
      { label: '>90j',   min: 91, max: Infinity, color: 'bg-red-900' },
    ].map(b => {
      const invs = invoices.filter(i => {
        if (i.payment_status === 'paid' || !i.due_date) return false
        const days = Math.floor((new Date(today).getTime() - new Date(i.due_date).getTime()) / 86400000)
        return days >= b.min && days <= b.max
      })
      return { ...b, amount: invs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0), count: invs.length }
    })
    return buckets
  }, [invoices])
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

  function exportFilteredCSV() {
    const rows = [
      ['N° Facture','Client','Date','Échéance','HT','TVA','TTC','Statut','Paiement','Payé le'],
      ...filtered.map(i => [
        i.number ?? '',
        i.clients?.name ?? '',
        i.issue_date ?? '',
        i.due_date ?? '',
        String(Number(i.ht_amount ?? 0).toFixed(3)),
        String(Number(i.tva_amount ?? 0).toFixed(3)),
        String(Number(i.ttc_amount ?? 0).toFixed(3)),
        i.status ?? '',
        i.payment_status ?? '',
        i.paid_at ? new Date(i.paid_at).toLocaleDateString('fr-FR') : '',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `factures-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

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
    const toExport = selected.size > 0 ? selectedInvs : filtered
    const headers = ['N Facture','Client','Date','Echeance','HT','TVA','TTC','Statut','Paiement','Date paiement','TTN_ID']
    const rows = toExport.map(i => [
      i.number??'',
      i.clients?.name??'',
      i.issue_date??'',
      i.due_date??'',
      i.ht_amount,
      i.tva_amount,
      i.ttc_amount,
      i.status,
      i.payment_status??'',
      i.paid_at ? i.paid_at.slice(0,10) : '',
      i.ttn_id??'',
    ].map(v=>String(v).replace(/,/g,' ')))
    const csv = [headers, ...rows].map(r=>r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    a.download = `factures_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  async function quickUpdateStatus(id: string, newStatus: string) {
    await supabase.from('invoices').update({ status: newStatus }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
    showToast(`Statut mis à jour`)
  }

  async function quickUpdateDueDate(id: string, newDate: string) {
    if (!newDate) return
    await supabase.from('invoices').update({ due_date: newDate }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, due_date: newDate } : i))
    setEditingDueDate(null)
    showToast('Échéance mise à jour')
  }

  async function quickMarkPaid(id: string, currentStatus: string, date?: string) {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
    await supabase.from('invoices').update({
      payment_status: newStatus,
      paid_at: newStatus === 'paid' ? (date ? new Date(date).toISOString() : new Date().toISOString()) : null,
    }).eq('id', id)
    showToast(newStatus === 'paid' ? 'Facture marquée comme payée' : 'Marquée non payée')
    load()
    setDropdown(null)
    setPayDateInvoiceId(null)
  }

  async function bulkMarkPaid() {
    const ids = invoices.filter(i => selected.has(i.id) && i.payment_status !== 'paid').map(i => i.id)
    if (!ids.length) return
    const paidAt = bulkPayDate ? new Date(bulkPayDate).toISOString() : new Date().toISOString()
    await Promise.all(ids.map(id =>
      supabase.from('invoices').update({ payment_status: 'paid', paid_at: paidAt }).eq('id', id)
    ))
    setSelected(new Set()); showToast(`${ids.length} facture${ids.length > 1 ? 's' : ''} marquée${ids.length > 1 ? 's' : ''} comme payée${ids.length > 1 ? 's' : ''}`)
    load()
  }

  async function bulkUpdateStatus(newStatus: string) {
    const ids = invoices.filter(i => selected.has(i.id) && i.status !== newStatus).map(i => i.id)
    if (!ids.length) return
    await Promise.all(ids.map(id => supabase.from('invoices').update({ status: newStatus }).eq('id', id)))
    setSelected(new Set())
    showToast(`${ids.length} facture${ids.length > 1 ? 's' : ''} → ${newStatus}`)
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
          <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
            Factures <span className="text-sm text-gray-500 font-normal">({filtered.length})</span>
            {(() => { const n = invoices.filter(i => isOverdue(i)).length; return n > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/30 text-red-400 border-red-900/30">
                ⚠ {n} en retard
              </span>
            ) : null })()}
            {(() => { const n = invoices.filter(i => i.status === 'draft').length; return n > 0 ? (
              <button onClick={() => { setStatusFilter('draft'); setPage(1) }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#1a1b22] text-gray-500 border-[#252830] hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors">
                {n} brouillon{n > 1 ? 's' : ''}
              </button>
            ) : null })()}
          </h1>
          <p className="text-gray-500 text-sm">Gestion et suivi de vos factures</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2.5 border border-[#1a1b22] text-gray-400 hover:text-white text-sm rounded-xl transition-colors">
              <Download size={13} />CSV
            </button>
          )}
          <Link href="/dashboard/invoices/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            <Plus size={15} strokeWidth={2.5} />Nouvelle facture
          </Link>
        </div>
      </div>

      {/* Saved preset chips */}
      {savedPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {savedPresets.map(p => (
            <div key={p.name} className="flex items-center gap-0.5">
              <button onClick={() => applyPreset(p)}
                className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-l-lg border border-[#1a1b22] bg-[#0f1118] text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors">
                <Bookmark size={9} />{p.name}
              </button>
              <button onClick={() => deletePreset(p.name)}
                className="text-[9px] px-1.5 py-1 rounded-r-lg border border-l-0 border-[#1a1b22] bg-[#0f1118] text-gray-700 hover:text-red-400 transition-colors">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
        {/* Save preset */}
        <button onClick={savePreset}
          title="Sauvegarder le filtre actuel comme preset"
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#1a1b22] text-gray-500 hover:text-[#d4a843] hover:border-[#d4a843]/30 rounded-xl transition-colors">
          <Bookmark size={12} />Sauv.
        </button>
        {/* Export CSV */}
        {filtered.length > 0 && (
          <button onClick={exportFilteredCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#1a1b22] text-gray-500 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30 rounded-xl transition-colors"
            title={`Exporter ${filtered.length} facture${filtered.length > 1 ? 's' : ''} en CSV`}>
            <Download size={12} />CSV
          </button>
        )}
        {/* Group by client toggle */}
        <button onClick={() => setGroupByClient(g => !g)}
          title="Regrouper par client"
          className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl transition-colors ${groupByClient ? 'border-[#d4a843]/40 text-[#d4a843] bg-[#d4a843]/5' : 'border-[#1a1b22] text-gray-500 hover:text-white'}`}>
          <Users size={12} />Grouper
        </button>
        {/* Column visibility */}
        <div className="relative ml-auto">
          <button onClick={() => setColMenuOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-xl transition-colors ${colMenuOpen ? 'border-[#d4a843]/40 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:text-white'}`}>
            <Columns2 size={12} />Colonnes
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-[#161b27] border border-[#252830] rounded-xl shadow-2xl p-3 min-w-[160px] space-y-1">
              {[
                { key: 'ht',     label: 'Montant HT' },
                { key: 'tva',    label: 'Montant TVA' },
                { key: 'due',    label: 'Échéance' },
                { key: 'ttn',    label: 'TTN ID' },
                { key: 'paidat', label: 'Payé le' },
              ].map(col => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleCol(col.key)}
                    className="w-3 h-3 rounded accent-[#d4a843]" />
                  <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
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

      {/* Client type filter chips */}
      {invoices.some(i => i.clients?.type) && (
        <div className="flex gap-1.5">
          {([
            { value: 'all', label: 'Tous types' },
            { value: 'B2B', label: 'B2B' },
            { value: 'B2C', label: 'B2C' },
          ] as { value: 'all'|'B2B'|'B2C'; label: string }[]).map(o => {
            const cnt = o.value === 'all' ? invoices.length : invoices.filter(i => i.clients?.type === o.value).length
            if (o.value !== 'all' && cnt === 0) return null
            const active = typeFilter === o.value
            const col = o.value === 'B2B'
              ? (active ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300')
              : o.value === 'B2C'
              ? (active ? 'bg-[#4a9eff]/15 border-[#4a9eff]/40 text-[#4a9eff]' : 'border-[#1a1b22] text-gray-600 hover:text-gray-300')
              : (active ? 'bg-[#d4a843]/10 border-[#d4a843]/25 text-gray-300' : 'border-[#1a1b22] text-gray-500 hover:text-gray-300')
            return (
              <button key={o.value}
                onClick={() => { setTypeFilter(o.value); setPage(1) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${col}`}>
                {o.label}
                <span className={`text-[10px] font-mono ${active ? 'opacity-80' : 'opacity-50'}`}>{cnt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Amount range filter */}
      {invoices.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold shrink-0">Montant TTC :</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0" step="0.001" placeholder="Min"
              value={amountMin}
              onChange={e => { setAmountMin(e.target.value); setPage(1) }}
              className="w-24 bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2 py-1.5 text-[11px] text-gray-300 font-mono outline-none focus:border-[#d4a843]/40 transition-colors placeholder:text-gray-700"
            />
            <span className="text-gray-700 text-xs">—</span>
            <input
              type="number" min="0" step="0.001" placeholder="Max"
              value={amountMax}
              onChange={e => { setAmountMax(e.target.value); setPage(1) }}
              className="w-24 bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2 py-1.5 text-[11px] text-gray-300 font-mono outline-none focus:border-[#d4a843]/40 transition-colors placeholder:text-gray-700"
            />
            {(amountMin || amountMax) && (
              <button onClick={() => { setAmountMin(''); setAmountMax(''); setPage(1) }}
                className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-1.5">✕</button>
            )}
          </div>
          {(amountMin || amountMax) && (
            <span className="text-[10px] text-[#d4a843] font-mono">
              {amountMin ? `≥ ${amountMin}` : ''}{amountMin && amountMax ? ' · ' : ''}{amountMax ? `≤ ${amountMax}` : ''} TND
            </span>
          )}
        </div>
      )}

      {/* Saved filter presets */}
      {(savedPresets.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Presets :</span>
          {savedPresets.map(p => (
            <div key={p.name} className="flex items-center gap-0">
              <button onClick={() => applyPreset(p)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-l-lg border border-[#1a1b22] text-[10px] font-medium text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors">
                <Bookmark size={9} />{p.name}
              </button>
              <button onClick={() => deletePreset(p.name)}
                className="px-1.5 py-1 rounded-r-lg border border-l-0 border-[#1a1b22] text-[10px] text-gray-700 hover:text-red-400 hover:border-red-900/30 transition-colors">
                <X size={9} />
              </button>
            </div>
          ))}
          <button onClick={savePreset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[#252830] text-[10px] text-gray-600 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors">
            <Bookmark size={9} />Sauvegarder les filtres
          </button>
        </div>
      )}
      {savedPresets.length === 0 && (
        <div className="flex items-center">
          <button onClick={savePreset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[#252830] text-[10px] text-gray-600 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors">
            <Bookmark size={9} />Sauvegarder les filtres
          </button>
        </div>
      )}

      {/* Aging heatmap */}
      {agingHeatmap.some(b => b.count > 0) && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Créances en retard</span>
            <span className="text-[10px] font-mono text-red-400 font-bold">
              {fmtTND(agingHeatmap.reduce((s, b) => s + b.amount, 0))} TND
            </span>
          </div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-2">
            {(() => {
              const total = agingHeatmap.reduce((s, b) => s + b.amount, 0) || 1
              return agingHeatmap.map(b => b.amount > 0 ? (
                <div key={b.label} title={`${b.label}: ${fmtTND(b.amount)} TND (${b.count})`}
                  className={`h-full ${b.color} transition-all`} style={{ width: `${(b.amount / total) * 100}%` }} />
              ) : null)
            })()}
          </div>
          <div className="flex gap-4 flex-wrap">
            {agingHeatmap.map(b => b.count > 0 ? (
              <button key={b.label} onClick={() => { setPaymentFilter('overdue'); setPage(1) }}
                className="flex items-center gap-1.5 group">
                <span className={`w-2 h-2 rounded-full ${b.color} shrink-0`} />
                <span className="text-[10px] text-gray-600 group-hover:text-gray-300 transition-colors">{b.label}</span>
                <span className="text-[10px] font-mono text-gray-400">{fmtTND(b.amount)}</span>
                <span className="text-[10px] text-gray-600">({b.count})</span>
              </button>
            ) : null)}
          </div>
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <>
        <div className="sticky top-0 z-10 bg-[#080a0e]/90 backdrop-blur-sm border border-[#1a1b22] rounded-xl px-4 py-2.5 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 items-center shadow-lg">
          <span className="font-bold text-gray-300">{filtered.length} facture{filtered.length!==1?'s':''}</span>
          <span className="text-gray-600">·</span>
          <span>HT <span className="text-gray-300 font-mono font-semibold">{fmtTND(summary.ht)}</span></span>
          <span>TVA <span className="text-gray-300 font-mono">{fmtTND(summary.tva)}</span></span>
          <span>TTC <span className="text-[#d4a843] font-mono font-bold">{fmtTND(summary.ttc)}</span></span>
          {summary.avgTTC > 0 && filtered.length > 1 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="flex items-center gap-1">
                Moy. <span className="font-mono text-gray-300">{fmtTND(summary.avgTTC)} TND</span>
                {summary.avgDelta !== null && summary.avgDelta !== 0 && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${
                    summary.avgDelta > 0 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' : 'text-red-400 bg-red-950/30 border-red-900/30'
                  }`}>{summary.avgDelta > 0 ? '+' : ''}{summary.avgDelta}%</span>
                )}
              </span>
            </>
          )}
          {(() => {
            const paidWithBoth = filtered.filter(i => i.payment_status === 'paid' && i.payment_date && i.issue_date)
            if (paidWithBoth.length < 2) return null
            const avgDays = Math.round(paidWithBoth.reduce((s, i) => {
              return s + (new Date(i.payment_date!).getTime() - new Date(i.issue_date!).getTime()) / 86400000
            }, 0) / paidWithBoth.length)
            return (
              <>
                <span className="text-gray-600">·</span>
                <span title={`Délai moyen émission → paiement (${paidWithBoth.length} factures)`}
                  className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    avgDays <= 30 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                    avgDays <= 60 ? 'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20' :
                    'text-red-400 bg-red-950/30 border-red-900/30'
                  }`}>
                  ⏱ ø {avgDays}j
                </span>
              </>
            )
          })()}
          {(() => {
            const byCur: Record<string, number> = {}
            for (const i of filtered) {
              const cur = i.currency ?? 'TND'
              byCur[cur] = (byCur[cur] ?? 0) + 1
            }
            const currencies = Object.entries(byCur).filter(([c]) => c !== 'TND')
            if (currencies.length === 0) return null
            return (
              <>
                <span className="text-gray-600">·</span>
                {currencies.map(([cur, cnt]) => (
                  <span key={cur} className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-950/20 border-blue-900/30">
                    {cur} ×{cnt}
                  </span>
                ))}
              </>
            )
          })()}
          {(() => {
            const openInvs = filtered.filter(i => i.status !== 'draft' && i.payment_status !== 'paid' && i.issue_date)
            if (openInvs.length < 2) return null
            const today = Date.now()
            const avgAge = Math.round(openInvs.reduce((s, i) => s + (today - new Date(i.issue_date!).getTime()) / 86400000, 0) / openInvs.length)
            return (
              <>
                <span className="text-gray-600">·</span>
                <span title={`Âge moyen des factures ouvertes (${openInvs.length})`}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    avgAge > 60 ? 'text-red-400 bg-red-950/30 border-red-900/30' :
                    avgAge > 30 ? 'text-amber-400 bg-amber-950/20 border-amber-900/30' :
                    'text-gray-500 bg-[#1a1b22] border-[#252830]'
                  }`}>âge ø {avgAge}j</span>
              </>
            )
          })()}
          {summary.unpaid > 0 && (
            <span className="ml-auto text-[#f59e0b] font-semibold">
              Impayé: <span className="font-mono">{fmtTND(summary.unpaid)}</span>
            </span>
          )}
        </div>
        {monthlyGoal && monthlyGoal > 0 && (() => {
          const nowD = new Date()
          const thisMonth = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`
          const monthlyTTC = invoices.filter(i => (i.issue_date ?? '').startsWith(thisMonth) && i.status !== 'draft').reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
          const pct = Math.min(100, Math.round((monthlyTTC / monthlyGoal) * 100))
          return (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-600">
                <span>Objectif mensuel</span>
                <span className={`font-mono font-bold ${pct >= 100 ? 'text-[#2dd4a0]' : pct >= 75 ? 'text-[#d4a843]' : 'text-gray-500'}`}>
                  {fmtTND(monthlyTTC)} / {fmtTND(monthlyGoal)} TND ({pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-[#2dd4a0]' : pct >= 75 ? 'bg-[#d4a843]' : 'bg-[#4a9eff]'}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })()}
        </>
      )}

      {/* Payment status progress bar */}
      {filtered.length > 1 && (() => {
        const nonDraft = filtered.filter(i => i.status !== 'draft')
        if (nonDraft.length < 2) return null
        const paid   = nonDraft.filter(i => i.payment_status === 'paid').length
        const unpaid = nonDraft.filter(i => i.payment_status !== 'paid').length
        const paidPct = Math.round((paid / nonDraft.length) * 100)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-2.5">
            <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1.5">
              <span className="font-semibold text-gray-500">Statut paiement</span>
              <span>{paid} payé{paid>1?'s':''} · {unpaid} en attente · {paidPct}%</span>
            </div>
            <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden flex">
              <div className="h-full bg-[#2dd4a0] rounded-l-full transition-all" style={{ width: `${paidPct}%` }} />
              <div className="h-full bg-[#f59e0b]" style={{ width: `${100 - paidPct}%` }} />
            </div>
          </div>
        )
      })()}

      {/* Overdue aging breakdown */}
      {filtered.length > 0 && (() => {
        const today = new Date().toISOString().slice(0, 10)
        const overdue = filtered.filter(i => i.status !== 'draft' && i.payment_status !== 'paid' && i.due_date && i.due_date < today)
        if (overdue.length === 0) return null
        const buckets = [
          { label: '0–30j',  min: 0,  max: 30,  color: 'bg-amber-500/70',  text: 'text-amber-400' },
          { label: '31–60j', min: 31, max: 60,  color: 'bg-orange-500/70', text: 'text-orange-400' },
          { label: '61–90j', min: 61, max: 90,  color: 'bg-red-500/70',    text: 'text-red-400' },
          { label: '>90j',   min: 91, max: Infinity, color: 'bg-red-900/80', text: 'text-red-600' },
        ]
        const now = new Date()
        const bData = buckets.map(b => {
          const items = overdue.filter(i => {
            const days = Math.floor((now.getTime() - new Date(i.due_date!).getTime()) / 86400000)
            return days >= b.min && days <= b.max
          })
          return { ...b, count: items.length, amount: items.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0) }
        }).filter(b => b.count > 0)
        if (bData.length === 0) return null
        const maxAmt = Math.max(...bData.map(b => b.amount), 1)
        return (
          <div className="bg-[#0f1118] border border-red-900/20 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Ancienneté des retards</p>
              <span className="text-[10px] font-mono text-red-400 font-bold">{overdue.length} facture{overdue.length > 1 ? 's' : ''} · {fmtTND(overdue.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0))} TND</span>
            </div>
            <div className="space-y-1.5">
              {bData.map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold w-10 shrink-0 ${b.text}`}>{b.label}</span>
                  <div className="flex-1 h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                    <div className={`h-full ${b.color} rounded-full`} style={{ width: `${Math.round((b.amount / maxAmt) * 100)}%` }} />
                  </div>
                  <span className={`text-[9px] font-mono shrink-0 w-20 text-right ${b.text}`}>{fmtTND(b.amount)} TND</span>
                  <span className="text-[9px] text-gray-600 shrink-0 w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Invoice size histogram */}
      {filtered.length >= 5 && (() => {
        const amounts = filtered.filter(i => i.status !== 'draft' && Number(i.ttc_amount) > 0).map(i => Number(i.ttc_amount))
        if (amounts.length < 5) return null
        const max = Math.max(...amounts)
        const bucketCount = 5
        const step = max / bucketCount || 1
        const buckets = Array.from({ length: bucketCount }, (_, b) => {
          const lo = b * step, hi = (b + 1) * step
          const cnt = amounts.filter(a => b === bucketCount - 1 ? a >= lo : a >= lo && a < hi).length
          return { lo, hi, cnt, label: `${Math.round(lo / 1000)}k–${Math.round(hi / 1000)}k` }
        })
        const maxCnt = Math.max(...buckets.map(b => b.cnt), 1)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2.5">Distribution montants TTC</p>
            <div className="flex items-end gap-1.5 h-12">
              {buckets.map((b, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-gray-600">{b.cnt > 0 ? b.cnt : ''}</span>
                  <div className="w-full rounded-t-sm bg-[#d4a843]/50 transition-all"
                    style={{ height: `${Math.round((b.cnt / maxCnt) * 36)}px`, minHeight: b.cnt > 0 ? '2px' : '0' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1">
              {buckets.map((b, idx) => (
                <div key={idx} className="flex-1 text-center">
                  <span className="text-[7px] text-gray-700">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Per-client revenue summary (top 5) */}
      {filtered.length > 1 && (() => {
        const byClient: Record<string, { name: string; ttc: number; count: number; unpaid: number }> = {}
        for (const inv of filtered) {
          const cid = inv.clients?.id ?? '__none__'
          const name = inv.clients?.name ?? '—'
          if (!byClient[cid]) byClient[cid] = { name, ttc: 0, count: 0, unpaid: 0 }
          byClient[cid].ttc   += Number(inv.ttc_amount ?? 0)
          byClient[cid].count += 1
          if (inv.payment_status !== 'paid') byClient[cid].unpaid += Number(inv.ttc_amount ?? 0)
        }
        const top5 = Object.values(byClient).sort((a, b) => b.ttc - a.ttc).slice(0, 5)
        if (top5.length < 2) return null
        const maxTTC = top5[0].ttc
        const totalTTC = Object.values(byClient).reduce((s, c) => s + c.ttc, 0)
        const topShare = totalTTC > 0 ? Math.round((top5[0].ttc / totalTTC) * 100) : 0
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">CA par client (filtre actuel)</p>
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#d4a843]">
                👑 {top5[0].name} <span className="text-gray-600 font-normal">— {topShare}% du CA</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {top5.map(cl => (
                <div key={cl.name} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-32 truncate shrink-0">{cl.name}</span>
                  <div className="flex-1 h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4a843]/60 rounded-full"
                      style={{ width: `${Math.round((cl.ttc / maxTTC) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[#d4a843] shrink-0 w-20 text-right">{fmtTND(cl.ttc)} TND</span>
                  <span className="text-[10px] text-gray-600 shrink-0 w-10 text-right">{cl.count}f</span>
                  {cl.unpaid > 0 && <span className="text-[10px] font-mono text-[#f59e0b] shrink-0">-{fmtTND(cl.unpaid)}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Invoice count by month (last 6 months) */}
      {invoices.length >= 3 && (() => {
        const _now = new Date()
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(_now.getFullYear(), _now.getMonth() - (5 - i), 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const label = d.toLocaleDateString('fr-FR', { month: 'short' })
          const count = invoices.filter(inv => (inv.issue_date ?? '').startsWith(key) && inv.status !== 'draft').length
          const ttc   = invoices.filter(inv => (inv.issue_date ?? '').startsWith(key) && inv.status !== 'draft').reduce((s, inv) => s + Number(inv.ttc_amount ?? 0), 0)
          return { label, count, ttc }
        })
        if (months.every(m => m.count === 0)) return null
        const maxCount = Math.max(...months.map(m => m.count), 1)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Factures / mois (6 mois)</p>
            <div className="flex items-end gap-1.5 h-10">
              {months.map((m, idx) => {
                const h = Math.max(2, Math.round((m.count / maxCount) * 36))
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1"
                    title={`${m.label} : ${m.count} facture${m.count !== 1 ? 's' : ''} — ${fmtTND(m.ttc)} TND`}>
                    <div className="w-full flex items-end justify-center" style={{ height: 36 }}>
                      <div className={`w-full rounded-t-sm ${idx === 5 ? 'bg-[#d4a843]' : m.count > 0 ? 'bg-[#d4a843]/40' : 'bg-[#1a1b22]'}`} style={{ height: h }} />
                    </div>
                    <span className="text-[8px] text-gray-600">{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Payment delay heatmap per client */}
      {invoices.length >= 3 && (() => {
        const byClient: Record<string, { name: string; delays: number[] }> = {}
        for (const inv of invoices) {
          if (inv.payment_status !== 'paid' || !inv.paid_at || !inv.due_date) continue
          const delay = Math.round((new Date((inv as any).paid_at).getTime() - new Date(inv.due_date).getTime()) / 86400000)
          const cid   = inv.clients?.id ?? '__none__'
          const name  = inv.clients?.name ?? '—'
          if (!byClient[cid]) byClient[cid] = { name, delays: [] }
          byClient[cid].delays.push(delay)
        }
        const rows = Object.values(byClient)
          .map(c => ({ name: c.name, avg: Math.round(c.delays.reduce((s, d) => s + d, 0) / c.delays.length), count: c.delays.length }))
          .filter(c => c.count >= 2)
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 6)
        if (rows.length < 2) return null
        const maxAbs = Math.max(...rows.map(r => Math.abs(r.avg)), 1)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Délai paiement moyen / client</p>
            <div className="space-y-1.5">
              {rows.map(r => {
                const pct = Math.round((Math.abs(r.avg) / maxAbs) * 100)
                const isLate = r.avg > 0
                return (
                  <div key={r.name}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] text-gray-500 truncate max-w-[120px]">{r.name}</span>
                      <span className={`text-[9px] font-mono font-bold ${isLate ? 'text-red-400' : 'text-[#2dd4a0]'}`}>{isLate ? '+' : ''}{r.avg}j</span>
                    </div>
                    <div className="h-1 bg-[#1a1b22] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isLate ? 'bg-red-500' : 'bg-[#2dd4a0]'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[8px] text-gray-700 mt-2">+ = payé en retard · − = payé en avance</p>
          </div>
        )
      })()}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#0d1420] border border-[#d4a843]/30 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#d4a843] font-bold shrink-0">
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button onClick={bulkMarkPaid}
                className="flex items-center gap-1.5 text-xs text-[#2dd4a0] border border-[#2dd4a0]/30 bg-[#2dd4a0]/5 hover:bg-[#2dd4a0]/10 px-3 py-1.5 rounded-lg transition-colors font-medium">
                <CheckSquare size={12} />Marquer payées
              </button>
              <input
                type="date"
                value={bulkPayDate}
                onChange={e => setBulkPayDate(e.target.value)}
                title="Date de paiement pour la sélection"
                className="bg-[#0a0b0f] border border-[#2dd4a0]/20 rounded-lg px-2 py-1.5 text-xs text-[#2dd4a0] outline-none focus:border-[#2dd4a0]/50 transition-colors w-32"
              />
            </div>
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) { bulkUpdateStatus(e.target.value); e.target.value = '' } }}
              className="bg-[#0a0b0f] border border-[#252830] rounded-lg px-2 py-1.5 text-xs text-gray-400 outline-none focus:border-[#d4a843]/40 transition-colors cursor-pointer">
              <option value="" disabled>Changer statut…</option>
              <option value="draft">→ Brouillon</option>
              <option value="validated">→ Validée</option>
              <option value="valid">→ Soumise TTN</option>
              <option value="rejected">→ Rejetée</option>
            </select>
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
            {(() => {
              const overdueSelected = invoices.filter(i => selected.has(i.id) && isOverdue(i))
              const emails = [...new Set(overdueSelected.map(i => i.clients?.name).filter(Boolean))]
              return overdueSelected.length > 0 ? (
                <button
                  onClick={() => {
                    const lines = overdueSelected.map(i =>
                      `${i.clients?.name ?? ''} — Facture ${i.number ?? ''} — ${fmtTND(Number(i.ttc_amount ?? 0))} TND`
                    ).join('\n')
                    navigator.clipboard.writeText(lines)
                    setToast(`${overdueSelected.length} relance(s) copiées`)
                  }}
                  title={`${overdueSelected.length} facture(s) en retard sélectionnée(s) : ${emails.join(', ')}`}
                  className="flex items-center gap-1.5 text-xs text-amber-400 border border-amber-900/30 bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                  ⚡ Relance ({overdueSelected.length})
                </button>
              ) : null
            })()}
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
            {groupByClient && filtered.length > 0 && (() => {
              const groups: Record<string, { name: string; type: string | null; invs: typeof filtered }> = {}
              for (const inv of filtered) {
                const cid = inv.clients?.id ?? '__none__'
                if (!groups[cid]) groups[cid] = { name: inv.clients?.name ?? '—', type: inv.clients?.type ?? null, invs: [] }
                groups[cid].invs.push(inv)
              }
              const sorted = Object.entries(groups).sort((a, b) =>
                b[1].invs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0) - a[1].invs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
              )
              return (
                <div className="space-y-3">
                  {sorted.map(([cid, g]) => {
                    const total   = g.invs.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
                    const unpaid  = g.invs.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
                    const overdue = g.invs.filter(i => isOverdue(i)).reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)
                    return (
                      <div key={cid} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1b22] bg-[#0a0b0f]">
                          <div className="flex items-center gap-2">
                            {cid !== '__none__' ? (
                              <Link href={`/dashboard/clients/${cid}`} className="text-sm font-bold text-white hover:text-[#d4a843] transition-colors">{g.name}</Link>
                            ) : <span className="text-sm font-bold text-gray-500">{g.name}</span>}
                            {g.type && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/20">{g.type}</span>}
                            <span className="text-[10px] text-gray-600">{g.invs.length} facture{g.invs.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <span className="text-xs font-mono font-bold text-[#d4a843]">{fmtTND(total)} TND</span>
                              {unpaid > 0 && <span className="ml-2 text-[10px] font-mono text-[#f59e0b]">-{fmtTND(unpaid)}</span>}
                              {overdue > 0 && <span className="ml-1 text-[10px] font-mono text-red-400">⚠ {fmtTND(overdue)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="divide-y divide-[#1a1b22]">
                          {g.invs.map(inv => (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#161b27]/50 transition-colors">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${inv.payment_status === 'paid' ? 'bg-[#2dd4a0]' : isOverdue(inv) ? 'bg-red-500' : 'bg-[#f59e0b]'}`} />
                              <Link href={`/dashboard/invoices/${inv.id}`} className="text-xs font-mono text-gray-300 hover:text-[#d4a843] transition-colors w-28 shrink-0">{inv.number ?? '—'}</Link>
                              <span className="text-[10px] text-gray-600 w-20 shrink-0">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}</span>
                              {inv.due_date && <span className={`text-[10px] w-20 shrink-0 ${isOverdue(inv) ? 'text-red-400' : 'text-gray-600'}`}>{new Date(inv.due_date).toLocaleDateString('fr-FR')}</span>}
                              <span className="text-xs font-mono text-gray-200 ml-auto">{fmtTND(Number(inv.ttc_amount ?? 0))} TND</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                inv.payment_status === 'paid' ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                                isOverdue(inv) ? 'text-red-400 bg-red-950/30 border-red-900/30' :
                                'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20'
                              }`}>{inv.payment_status === 'paid' ? 'Payée' : isOverdue(inv) ? 'Retard' : 'Impayée'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            {!groupByClient && <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1b22]">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                    </th>
                    {([
                      { field: 'number'    as SortField|'', label: 'N° Facture', hide: '' },
                      { field: ''         as SortField|'', label: 'Client',      hide: '' },
                      { field: 'issue_date'as SortField|'', label: 'Date',        hide: '' },
                      { field: 'due_date'  as SortField|'', label: 'Échéance',    hide: `hidden md:table-cell${hiddenCols.has('due') ? ' !hidden' : ''}` },
                      { field: 'ht_amount' as SortField|'', label: 'HT',          hide: `hidden lg:table-cell${hiddenCols.has('ht')  ? ' !hidden' : ''}` },
                      { field: 'tva_amount'as SortField|'', label: 'TVA',         hide: `hidden lg:table-cell${hiddenCols.has('tva') ? ' !hidden' : ''}` },
                      { field: 'ttc_amount'as SortField|'', label: 'TTC',         hide: '' },
                      ...(hasMultiCurrency ? [{ field: '' as SortField|'', label: 'Devise', hide: 'hidden xl:table-cell' }] : []),
                      { field: 'status'    as SortField|'', label: 'Statut',      hide: '' },
                      { field: ''          as SortField|'', label: 'TTN_ID',      hide: `hidden xl:table-cell${hiddenCols.has('ttn') ? ' !hidden' : ''}` },
                      { field: ''          as SortField|'', label: '',            hide: '' },
                    ]).map(({ field, label, hide }) => (
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
                    <tr key={inv.id} className={`hover:bg-[#161b27]/50 transition-colors ${selected.has(inv.id)?'bg-[#d4a843]/5':''} ${isOverdue(inv)?'border-l-2 border-l-red-500/60 bg-red-950/10':''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleRow(inv.id)}
                          className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            title={inv.payment_status === 'paid' ? 'Payée' : isOverdue(inv) ? 'En retard' : 'Impayée'}
                            className={`shrink-0 w-2 h-2 rounded-full ${
                              inv.payment_status === 'paid' ? 'bg-[#2dd4a0]' :
                              isOverdue(inv)               ? 'bg-red-500' :
                                                             'bg-[#f59e0b]'
                            }`}
                          />
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
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center flex-wrap gap-0.5">
                          <span className="text-gray-300 text-xs">{inv.clients?.name ?? <span className="text-gray-600">—</span>}</span>
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
                        {inv.clients?.id && (() => {
                          const cid = inv.clients.id
                          const clientInvs = invoices
                            .filter(i => i.clients?.id === cid && i.status !== 'draft')
                            .sort((a, b) => (a.issue_date ?? '') < (b.issue_date ?? '') ? -1 : 1)
                            .slice(-5)
                          if (clientInvs.length < 2) return null
                          const today = new Date().toISOString().slice(0, 10)
                          return (
                            <div className="mt-1 flex items-center gap-0.5">
                              {clientInvs.map(ci => {
                                const overdue = ci.payment_status !== 'paid' && ci.due_date && ci.due_date < today
                                const col = ci.payment_status === 'paid' ? 'bg-[#2dd4a0]' : overdue ? 'bg-red-500' : 'bg-[#f59e0b]/60'
                                return <span key={ci.id} title={ci.number ?? ''} className={`w-1.5 h-1.5 rounded-full ${col}`} />
                              })}
                            </div>
                          )
                        })()}
                        {inv.clients?.id && summary.ttc > 0 && (() => {
                          const share = Math.round((clientTotals[inv.clients.id] ?? 0) / summary.ttc * 100)
                          return share >= 5 ? (
                            <div className="mt-0.5 flex items-center gap-1">
                              <div className="h-0.5 bg-[#1a1b22] rounded-full overflow-hidden w-16">
                                <div className="h-full bg-[#d4a843]/50 rounded-full" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-[8px] text-gray-700 font-mono">{share}%</span>
                            </div>
                          ) : null
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {inv.issue_date ? (
                          <>
                            <div>{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</div>
                            {(() => {
                              const days = Math.floor((Date.now() - new Date(inv.issue_date).getTime()) / 86400000)
                              return days > 0 ? <div className="text-[9px] text-gray-600 mt-0.5">J+{days}</div> : null
                            })()}
                          </>
                        ) : ''}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap hidden md:table-cell ${hiddenCols.has('due') ? '!hidden' : ''}`}>
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
                            {isOverdue(inv) ? (() => {
                              const daysLate = Math.floor((Date.now() - new Date(inv.due_date!).getTime()) / 86400000)
                              const col = daysLate > 90 ? 'bg-red-900/60 text-red-300 border-red-800/40' : daysLate > 30 ? 'bg-red-950/60 text-red-400 border-red-900/30' : 'bg-amber-950/40 text-amber-400 border-amber-900/30'
                              return <span className={`ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded border ${col}`}>+{daysLate}j</span>
                            })() : inv.payment_status !== 'paid' && inv.due_date && (() => {
                              const daysLeft = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000)
                              return daysLeft >= 0 && daysLeft <= 7
                                ? <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/30">J-{daysLeft}</span>
                                : null
                            })()}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap text-right hidden lg:table-cell ${hiddenCols.has('ht') ? '!hidden' : ''}`}>{fmtTND(Number(inv.ht_amount??0))}</td>
                      <td className={`px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap text-right hidden lg:table-cell ${hiddenCols.has('tva') ? '!hidden' : ''}`}>{fmtTND(Number(inv.tva_amount??0))}</td>
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
                      <td className="px-4 py-3">
                        <select
                          value={inv.status}
                          onChange={e => quickUpdateStatus(inv.id, e.target.value)}
                          title="Changer le statut"
                          className="bg-transparent border-0 outline-none cursor-pointer text-[10px] font-bold rounded px-0 py-0 appearance-none"
                          style={{ colorScheme: 'dark' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {['draft','pending','validated','valid','queued','rejected'].map(s => (
                            <option key={s} value={s} className="bg-[#0f1118] text-white">{s}</option>
                          ))}
                        </select>
                        <InvoiceStatusBadge status={inv.status} />
                        {inv.payment_status === 'paid' && inv.paid_at && (
                          <div className="text-[9px] text-[#2dd4a0]/60 font-mono mt-0.5">
                            {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-3 hidden xl:table-cell${hiddenCols.has('ttn') ? ' !hidden' : ''}`}>
                        {inv.ttn_rejection_reason ? (
                          <span
                            title={inv.ttn_rejection_reason}
                            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-900/30 cursor-help max-w-[100px] truncate">
                            ✕ {inv.ttn_rejection_reason.slice(0, 20)}{inv.ttn_rejection_reason.length > 20 ? '…' : ''}
                          </span>
                        ) : inv.ttn_id ? (
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
                                    {inv.payment_status !== 'paid' && payDateInvoiceId === inv.id ? (
                                      <div className="px-3 py-2 space-y-2">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Date de paiement</p>
                                        <input
                                          type="date"
                                          value={payDate}
                                          onChange={e => setPayDate(e.target.value)}
                                          className="w-full bg-[#0a0b0f] border border-[#d4a843]/50 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                                        />
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => quickMarkPaid(inv.id, 'unpaid', payDate)}
                                            className="flex-1 text-[10px] py-1.5 bg-[#2dd4a0] text-black font-bold rounded-lg hover:bg-[#2dd4a0]/80 transition-colors">
                                            Confirmer ✔
                                          </button>
                                          <button
                                            onClick={() => setPayDateInvoiceId(null)}
                                            className="px-2 text-[10px] py-1.5 border border-[#252830] text-gray-500 rounded-lg hover:text-white transition-colors">
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          if (inv.payment_status === 'paid') {
                                            quickMarkPaid(inv.id, 'paid')
                                          } else {
                                            setPayDate(new Date().toISOString().slice(0,10))
                                            setPayDateInvoiceId(inv.id)
                                          }
                                        }}
                                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                                          inv.payment_status === 'paid'
                                            ? 'text-gray-400 hover:bg-[#252830] hover:text-white'
                                            : 'text-[#2dd4a0] hover:bg-[#2dd4a0]/10'
                                        }`}>
                                        <DollarSign size={13} />
                                        {inv.payment_status === 'paid' ? 'Marquer non payée' : 'Marquer payée ✔'}
                                      </button>
                                    )}
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
            </div>}

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
