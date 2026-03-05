'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Trash2, Receipt, TrendingDown, Download, Paperclip, X as XIcon, RefreshCw, ChevronDown, ChevronUp, Pencil, Target, CheckSquare } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { fmtTND } from '@/lib/utils/tva-calculator'

type Expense = {
  id: string
  description: string
  amount: number
  category: string
  date: string
  invoice_id: string | null
  notes: string | null
  receipt_url: string | null
  created_at: string
  recurring_expense_id: string | null
}

const CATEGORIES = [
  { value: 'loyer',        label: 'Loyer / Bureau' },
  { value: 'salaires',     label: 'Salaires' },
  { value: 'materiel',     label: 'Matériel / Équipement' },
  { value: 'transport',    label: 'Transport' },
  { value: 'telecom',      label: 'Télécom / Internet' },
  { value: 'fournitures',  label: 'Fournitures' },
  { value: 'marketing',    label: 'Marketing / Pub' },
  { value: 'comptabilite', label: 'Comptabilité / Juridique' },
  { value: 'impots',       label: 'Impôts / Taxes' },
  { value: 'autre',        label: 'Autre' },
]

const CAT_COLORS: Record<string, string> = {
  loyer: 'text-blue-400 bg-blue-950/30 border-blue-900/30',
  salaires: 'text-purple-400 bg-purple-950/30 border-purple-900/30',
  materiel: 'text-cyan-400 bg-cyan-950/30 border-cyan-900/30',
  transport: 'text-green-400 bg-green-950/30 border-green-900/30',
  telecom: 'text-teal-400 bg-teal-950/30 border-teal-900/30',
  fournitures: 'text-gray-400 bg-gray-900/30 border-gray-800/30',
  marketing: 'text-pink-400 bg-pink-950/30 border-pink-900/30',
  comptabilite: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/30',
  impots: 'text-red-400 bg-red-950/30 border-red-900/30',
  autre: 'text-gray-500 bg-gray-900/20 border-gray-800/20',
}

const IC = 'w-full bg-[#0a0b0f] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'
const LC = 'block text-xs text-gray-400 mb-1.5'

type FormState = {
  description: string; amount: string; category: string; date: string; notes: string
}

type RecurringExpense = {
  id: string; description: string; amount: number; category: string
  notes: string | null; active: boolean; day_of_month: number; last_logged: string | null
}

const emptyRecurring = () => ({ description: '', amount: '', category: 'autre', notes: '', day_of_month: '1' })

const emptyForm = (): FormState => ({
  description: '', amount: '', category: 'autre',
  date: new Date().toISOString().slice(0, 10), notes: '',
})

export default function ExpensesPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [formOpen, setFormOpen]  = useState(false)
  const [form, setForm]          = useState<FormState>(emptyForm())
  const [saving, setSaving]      = useState(false)
  const [toast, setToast]        = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const receiptRef = useRef<HTMLInputElement>(null)

  const [recurringList, setRecurringList]   = useState<RecurringExpense[]>([])
  const [recurringOpen, setRecurringOpen]   = useState(false)
  const [recurringForm, setRecurringForm]   = useState(emptyRecurring())
  const [addingRecurring, setAddingRecurring] = useState(false)
  const [savingRecurring, setSavingRecurring] = useState(false)
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null)
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try { return Number(localStorage.getItem('exp_monthly_budget') ?? '0') || 0 } catch { return 0 }
  })
  const [editingMonthlyBudget, setEditingMonthlyBudget] = useState(false)
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState('')
  const [budgets, setBudgets] = useState<Record<string, number>>({}) 
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineEdit, setInlineEdit] = useState<{ amount: string; category: string; description: string }>({ amount: '', category: 'autre', description: '' })
  const [savingInline, setSavingInline] = useState(false)
  const [chartYear, setChartYear] = useState(new Date().getFullYear())
  const [showYoY, setShowYoY] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  function toggleRow(id: string) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll(ids: string[]) {
    if (ids.every(id => selected.has(id))) setSelected(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
    else setSelected(s => { const n = new Set(s); ids.forEach(id => n.add(id)); return n })
  }
  async function bulkDelete() {
    if (!selected.size) return
    setBulkDeleting(true)
    await Promise.all([...selected].map(id => supabase.from('expenses').delete().eq('id', id)))
    setBulkDeleting(false)
    setSelected(new Set())
    showToast(`${selected.size} dépense${selected.size > 1 ? 's' : ''} supprimée${selected.size > 1 ? 's' : ''}`)
    load()
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadBudgets = useCallback(async () => {
    if (!activeCompany?.id) return
    const { data } = await (supabase as any)
      .from('expense_budgets')
      .select('category, monthly_limit')
      .eq('company_id', activeCompany.id)
    const map: Record<string, number> = {}
    for (const row of data ?? []) map[row.category] = Number(row.monthly_limit)
    setBudgets(map)
  }, [activeCompany?.id, supabase])

  async function saveBudget(category: string, value: string) {
    if (!activeCompany?.id) return
    const limit = parseFloat(value) || 0
    setSavingBudget(true)
    await (supabase as any).from('expense_budgets').upsert(
      { company_id: activeCompany.id, category, monthly_limit: limit },
      { onConflict: 'company_id,category' }
    )
    setSavingBudget(false)
    setBudgets(prev => ({ ...prev, [category]: limit }))
    setEditingBudget(null)
    setBudgetInput('')
  }

  const loadRecurring = useCallback(async () => {
    if (!activeCompany?.id) return
    const { data } = await (supabase as any)
      .from('recurring_expenses')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
    setRecurringList((data ?? []) as RecurringExpense[])
  }, [activeCompany?.id, supabase])

  async function saveRecurring() {
    if (!activeCompany?.id || !recurringForm.description || !recurringForm.amount) return
    setSavingRecurring(true)
    if (editingRecurringId) {
      const { error } = await (supabase as any).from('recurring_expenses').update({
        description:  recurringForm.description,
        amount:       parseFloat(recurringForm.amount),
        category:     recurringForm.category,
        notes:        recurringForm.notes || null,
        day_of_month: parseInt(recurringForm.day_of_month) || 1,
      }).eq('id', editingRecurringId)
      setSavingRecurring(false)
      if (error) { showToast('Erreur sauvegarde'); return }
      setEditingRecurringId(null)
    } else {
      const { error } = await (supabase as any).from('recurring_expenses').insert({
        company_id:   activeCompany.id,
        description:  recurringForm.description,
        amount:       parseFloat(recurringForm.amount),
        category:     recurringForm.category,
        notes:        recurringForm.notes || null,
        day_of_month: parseInt(recurringForm.day_of_month) || 1,
      })
      setSavingRecurring(false)
      if (error) { showToast('Erreur sauvegarde'); return }
    }
    setRecurringForm(emptyRecurring())
    setAddingRecurring(false)
    loadRecurring()
    showToast(editingRecurringId ? 'Récurrence mise à jour' : 'Dépense récurrente ajoutée')
  }

  async function toggleRecurring(id: string, active: boolean) {
    await (supabase as any).from('recurring_expenses').update({ active }).eq('id', id)
    loadRecurring()
  }

  async function deleteRecurring(id: string) {
    await (supabase as any).from('recurring_expenses').delete().eq('id', id)
    loadRecurring()
    showToast('Supprimé')
  }

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('date', { ascending: false })
    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadRecurring() }, [loadRecurring])
  useEffect(() => { loadBudgets() }, [loadBudgets])

  const filtered = useMemo(() => {
    let list = expenses
    if (catFilter !== 'all') list = list.filter(e => e.category === catFilter)
    if (dateFrom) list = list.filter(e => e.date >= dateFrom)
    if (dateTo)   list = list.filter(e => e.date <= dateTo)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.description.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q))
    }
    return list
  }, [expenses, catFilter, dateFrom, dateTo, search])

  const totals = useMemo(() => {
    const now0 = new Date()
    const thisMonth = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}`
    const prevD = new Date(now0.getFullYear(), now0.getMonth() - 1, 1)
    const prevMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`
    const monthly = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + Number(e.amount), 0)
    const total   = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const byCat   = Object.fromEntries(
      CATEGORIES.map(c => [c.value, expenses.filter(e => e.category === c.value && e.date.startsWith(thisMonth)).reduce((s, e) => s + Number(e.amount), 0)])
    )
    const byCatPrev = Object.fromEntries(
      CATEGORIES.map(c => [c.value, expenses.filter(e => e.category === c.value && e.date.startsWith(prevMonth)).reduce((s, e) => s + Number(e.amount), 0)])
    )
    // 12 months of selected year + prev year for YoY
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const key  = `${chartYear}-${String(i + 1).padStart(2, '0')}`
      const keyP = `${chartYear - 1}-${String(i + 1).padStart(2, '0')}`
      const label = new Date(chartYear, i, 1).toLocaleDateString('fr-FR', { month: 'short' })
      const monthExpenses = expenses.filter(e => e.date.startsWith(key))
      const prevExpenses  = expenses.filter(e => e.date.startsWith(keyP))
      const amount = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
      const amountPrev = prevExpenses.reduce((s, e) => s + Number(e.amount), 0)
      const count = monthExpenses.length
      return { key, label, amount, amountPrev, count }
    })
    // Forecast next month = avg of last 3 completed months
    const now3 = new Date()
    const last3 = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now3.getFullYear(), now3.getMonth() - (i + 1), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0)
    })
    const nextMonthForecast = Math.round(last3.reduce((s, v) => s + v, 0) / 3)
    return { monthly, total, byCat, byCatPrev, byMonth, nextMonthForecast }
  }, [expenses, chartYear])

  async function handleReceiptFile(file: File) {
    if (!activeCompany?.id) return
    if (file.size > 5 * 1024 * 1024) { showToast('Fichier trop lourd (max 5 Mo)'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${activeCompany.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
    if (error) { showToast('Erreur upload reçu'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
    setReceiptUrl(publicUrl)
    setUploading(false)
    showToast('Reçu joint')
  }

  async function handleSave() {
    if (!activeCompany?.id || !form.description || !form.amount) return
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      company_id:  activeCompany.id,
      description: form.description,
      amount:      parseFloat(form.amount),
      category:    form.category,
      date:        form.date,
      notes:       form.notes || null,
      receipt_url: receiptUrl || null,
    })
    setSaving(false)
    if (error) { showToast('Erreur lors de la sauvegarde'); return }
    setForm(emptyForm())
    setReceiptUrl(null)
    setFormOpen(false)
    showToast('Dépense ajoutée')
    load()
  }

  async function saveInlineEdit(id: string) {
    if (!inlineEdit.description.trim() || !inlineEdit.amount) return
    setSavingInline(true)
    await supabase.from('expenses').update({
      description: inlineEdit.description,
      amount: parseFloat(inlineEdit.amount),
      category: inlineEdit.category,
    }).eq('id', id)
    setSavingInline(false)
    setInlineEditId(null)
    load()
    showToast('Dépense mise à jour')
  }

  async function handleDelete(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    showToast('Dépense supprimée')
    load()
  }

  function exportCSV() {
    const toExport = filtered
    const header = 'Date,Description,Catégorie,Montant (TND),Notes'
    const rows = toExport.map(e =>
      [e.date, `"${e.description.replace(/"/g,'""')}"`, e.category, e.amount, e.notes ? `"${e.notes.replace(/"/g,'""')}"` : ''].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `depenses_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Receipt lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-[#0f1118] border border-[#252830] rounded-full flex items-center justify-center text-gray-400 hover:text-white z-10 transition-colors">
              <XIcon size={14} />
            </button>
            {/\.(jpe?g|png|webp|gif)$/i.test(lightboxUrl) ? (
              <img src={lightboxUrl} alt="justificatif" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            ) : (
              <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl p-8 text-center space-y-4">
                <Paperclip size={32} className="text-[#2dd4a0] mx-auto" />
                <p className="text-sm text-gray-400">Ce justificatif est un fichier PDF ou non-image.</p>
                <a href={lightboxUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold text-sm rounded-xl transition-colors">
                  Ouvrir le fichier →
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingDown size={20} className="text-red-400" />
            Dépenses
          </h1>
          <p className="text-gray-500 text-sm">Suivez vos dépenses et charges</p>
        </div>
        <div className="flex items-center gap-2">
          {expenses.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 border border-[#1a1b22] text-gray-400 hover:text-white text-sm rounded-xl transition-colors">
              <Download size={13} />CSV
            </button>
          )}
          <button
            onClick={() => setFormOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Ce mois</p>
          <p className="text-lg font-mono font-bold text-red-400">{fmtTND(totals.monthly)} TND</p>
          {(() => {
            const prevTotal = Object.values(totals.byCatPrev).reduce((s, v) => s + v, 0)
            if (prevTotal <= 0) return null
            const delta = totals.monthly - prevTotal
            const pct = Math.round((delta / prevTotal) * 100)
            return (
              <span className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                pct > 10  ? 'text-red-400 bg-red-950/30 border-red-900/30' :
                pct < -10 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                'text-gray-500 bg-[#1a1b22] border-[#252830]'
              }`}>{pct > 0 ? '+' : ''}{pct}% vs mois préc.</span>
            )
          })()}
        </div>
        {[
          { label: 'Total', value: fmtTND(totals.total) + ' TND', color: 'text-white' },
          { label: 'Catégorie max', value: (() => {
              const top = Object.entries(totals.byCat).sort((a,b) => b[1]-a[1])[0]
              return top ? CATEGORIES.find(c => c.value === top[0])?.label?.split(' ')[0] ?? '—' : '—'
            })(), color: 'text-[#d4a843]' },
          { label: 'Entrées', value: String(expenses.length), color: 'text-gray-300' },
        ].map(k => (
          <div key={k.label} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {totals.nextMonthForecast > 0 && (() => {
        const next = new Date(); next.setMonth(next.getMonth() + 1)
        const nextLabel = next.toLocaleDateString('fr-FR', { month: 'long' })
        const delta = totals.nextMonthForecast - totals.monthly
        const deltaPct = totals.monthly > 0 ? Math.round((delta / totals.monthly) * 100) : null
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Prévision — {nextLabel}</p>
              <p className="text-lg font-mono font-bold text-[#4a9eff]">{fmtTND(totals.nextMonthForecast)} TND</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-600 mb-1">Moy. 3 mois</p>
              {deltaPct !== null && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  deltaPct > 10  ? 'text-red-400 bg-red-950/30 border-red-900/30' :
                  deltaPct < -10 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                  'text-gray-500 bg-[#1a1b22] border-[#252830]'
                }`}>{deltaPct > 0 ? '+' : ''}{deltaPct}% vs ce mois</span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Year-over-year comparison badge */}
      {(() => {
        const thisYearTotal = totals.byMonth.reduce((s, m) => s + m.amount, 0)
        const lastYearTotal = totals.byMonth.reduce((s, m) => s + m.amountPrev, 0)
        if (thisYearTotal <= 0 || lastYearTotal <= 0) return null
        const delta = Math.round(((thisYearTotal - lastYearTotal) / lastYearTotal) * 100)
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Comparaison annuelle</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-mono font-black ${delta > 0 ? 'text-red-400' : 'text-[#2dd4a0]'}`}>
                  {delta > 0 ? '+' : ''}{delta}%
                </span>
                <span className="text-xs text-gray-600">vs {chartYear - 1}</span>
              </div>
              <p className="text-[9px] text-gray-600 mt-0.5">
                {chartYear} : {fmtTND(thisYearTotal)} TND · {chartYear - 1} : {fmtTND(lastYearTotal)} TND
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              delta > 10 ? 'text-red-400 bg-red-950/30 border-red-900/30' :
              delta < -10 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
              'text-gray-500 bg-[#1a1b22] border-[#252830]'
            }`}>{delta > 10 ? '↑ Hausse' : delta < -10 ? '↓ Baisse' : '≈ Stable'}</span>
          </div>
        )
      })()}

      {/* Monthly budget progress bar */}
      {(() => {
        const spent = totals.monthly
        const budget = monthlyBudget
        if (budget <= 0 && !editingMonthlyBudget) return (
          <button onClick={() => { setMonthlyBudgetInput(''); setEditingMonthlyBudget(true) }}
            className="flex items-center gap-2 w-full bg-[#0f1118] border border-dashed border-[#1a1b22] rounded-2xl px-4 py-2.5 text-[10px] text-gray-700 hover:text-gray-500 hover:border-[#252830] transition-colors">
            <Target size={11} /> Définir un budget mensuel global
          </button>
        )
        const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
        const over = budget > 0 && spent > budget
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Target size={11} className={over ? 'text-red-400' : 'text-gray-500'} />
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Budget mensuel</p>
              </div>
              {editingMonthlyBudget ? (
                <div className="flex items-center gap-1">
                  <input autoFocus type="number" min="0" step="1" value={monthlyBudgetInput}
                    onChange={e => setMonthlyBudgetInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = Number(monthlyBudgetInput) || 0; setMonthlyBudget(v); localStorage.setItem('exp_monthly_budget', String(v)); setEditingMonthlyBudget(false) }
                      if (e.key === 'Escape') setEditingMonthlyBudget(false)
                    }}
                    className="w-24 bg-[#0a0b0f] border border-[#d4a843]/40 rounded-lg px-2 py-0.5 text-xs text-white outline-none font-mono" />
                  <button onClick={() => { const v = Number(monthlyBudgetInput) || 0; setMonthlyBudget(v); localStorage.setItem('exp_monthly_budget', String(v)); setEditingMonthlyBudget(false) }}
                    className="text-[10px] text-[#2dd4a0] hover:text-white px-1.5 py-0.5 rounded transition-colors">✓</button>
                  <button onClick={() => setEditingMonthlyBudget(false)} className="text-[10px] text-gray-600 hover:text-white px-1 py-0.5 rounded transition-colors">✕</button>
                </div>
              ) : (
                <button onClick={() => { setMonthlyBudgetInput(String(monthlyBudget)); setEditingMonthlyBudget(true) }}
                  className={`text-[10px] font-mono font-bold ${over ? 'text-red-400' : 'text-gray-400'} hover:text-white transition-colors`}>
                  {fmtTND(spent)} / {fmtTND(budget)} TND
                </button>
              )}
            </div>
            {budget > 0 && (
              <>
                <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 75 ? 'bg-[#f59e0b]' : 'bg-[#2dd4a0]'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={`text-[9px] font-bold ${over ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-gray-600'}`}>
                    {pct}% utilisé{over ? ' — dépassé !' : ''}
                  </span>
                  {!over && <span className="text-[9px] text-gray-700">{fmtTND(budget - spent)} TND restant</span>}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Recurring expense total badge */}
      {recurringList.length > 0 && (() => {
        const activeRec = recurringList.filter(r => r.active)
        if (activeRec.length === 0) return null
        const monthlyTotal = activeRec.reduce((s, r) => s + Number(r.amount ?? 0), 0)
        const topRec = activeRec.reduce((best, r) => Number(r.amount) > Number(best.amount) ? r : best, activeRec[0])
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Charges récurrentes actives</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-purple-400 bg-purple-950/20 border-purple-900/30">
                {activeRec.length} actif{activeRec.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xl font-mono font-black text-purple-400">{fmtTND(monthlyTotal)} TND<span className="text-xs text-gray-600 font-normal ml-1">/mois</span></p>
            <p className="text-[9px] text-gray-600 mt-0.5">
              Plus élevée : <span className="text-gray-400">{topRec.description}</span> — {fmtTND(topRec.amount)} TND
            </p>
          </div>
        )
      })()}

      {/* Largest single expense badge */}
      {expenses.length > 0 && (() => {
        const largest = expenses.reduce((best, e) => Number(e.amount) > Number(best.amount) ? e : best, expenses[0])
        const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
        const pct = total > 0 ? Math.round((Number(largest.amount) / total) * 100) : 0
        return Number(largest.amount) > 0 ? (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Plus grosse dépense</p>
              <p className="text-sm font-mono font-black text-white truncate max-w-[160px]">{largest.description}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">
                {largest.date} · {CATEGORIES.find(c => c.value === largest.category)?.label?.split(' ')[0] ?? largest.category}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-bold text-red-400">{fmtTND(largest.amount)} TND</p>
              <p className="text-[9px] text-gray-600">{pct}% du total</p>
            </div>
          </div>
        ) : null
      })()}

      {/* Expense per active client estimate */}
      {expenses.length > 0 && (() => {
        const monthlyTotal = totals.monthly
        if (monthlyTotal <= 0) return null
        const clientIds = new Set(
          (expenses as any[])
            .filter(e => e.date?.startsWith(new Date().toISOString().slice(0, 7)) && e.client_id)
            .map((e: any) => e.client_id)
        )
        const invoiceClientIds = new Set(
          (expenses as any[]).filter(e => e.client_id).map((e: any) => e.client_id)
        )
        const clientCount = invoiceClientIds.size || 1
        const perClient = Math.round(monthlyTotal / clientCount)
        if (clientCount < 2) return null
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Coût moyen par client</p>
              <p className="text-lg font-mono font-black text-white">{fmtTND(perClient)} TND<span className="text-xs text-gray-600 font-normal ml-1">/client</span></p>
              <p className="text-[9px] text-gray-600 mt-0.5">{fmtTND(monthlyTotal)} TND ÷ {clientCount} clients actifs ce mois</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-[#4a9eff] bg-blue-950/20 border-blue-900/30 shrink-0">
              {clientCount} clients
            </span>
          </div>
        )
      })()}

      {/* Weekly expense trend sparkline */}
      {expenses.length >= 5 && (() => {
        const now0 = new Date()
        const weeks: number[] = []
        for (let w = 7; w >= 0; w--) {
          const wStart = new Date(now0); wStart.setDate(now0.getDate() - w * 7 - 6)
          const wEnd   = new Date(now0); wEnd.setDate(now0.getDate() - w * 7)
          const wStartStr = wStart.toISOString().slice(0, 10)
          const wEndStr   = wEnd.toISOString().slice(0, 10)
          weeks.push(expenses.filter(e => e.date >= wStartStr && e.date <= wEndStr).reduce((s, e) => s + Number(e.amount), 0))
        }
        if (weeks.every(v => v === 0)) return null
        const minW = Math.min(...weeks), maxW = Math.max(...weeks, 1), range = maxW - minW || 1
        const W = 140, H = 30, pad = 3
        const pts = weeks.map((v, i) => {
          const x = pad + (i / (weeks.length - 1)) * (W - pad * 2)
          const y = H - pad - ((v - minW) / range) * (H - pad * 2)
          return `${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        const lastPt = pts.split(' ').pop()!.split(',')
        const trend = weeks[7] > weeks[6] * 1.05 ? 'up' : weeks[7] < weeks[6] * 0.95 ? 'down' : 'flat'
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Tendance hebdo dépenses</p>
              <p className="text-[9px] text-gray-700">8 dernières semaines</p>
            </div>
            <div className="flex items-center gap-2">
              <svg width={W} height={H} className="shrink-0">
                <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
                <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill="#f97316" />
              </svg>
              <span className={`text-sm font-bold ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-[#2dd4a0]' : 'text-gray-500'}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Top expense day of week */}
      {expenses.length >= 5 && (() => {
        const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
        const byDay = Array(7).fill(0)
        for (const e of expenses) {
          if (e.date) byDay[new Date(e.date).getDay()] += Number(e.amount ?? 0)
        }
        const maxAmt = Math.max(...byDay, 1)
        const bestIdx = byDay.indexOf(Math.max(...byDay))
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Dépenses par jour</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-red-400 bg-red-950/30 border-red-900/30">{DOW[bestIdx]} le + cher</span>
            </div>
            <div className="flex items-end gap-1 h-8">
              {byDay.map((amt, i) => {
                const h = Math.max(2, Math.round((amt / maxAmt) * 28))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5"
                    title={`${DOW[i]}: ${fmtTND(amt)} TND`}>
                    <div className="w-full flex items-end justify-center" style={{ height: 28 }}>
                      <div className={`w-full rounded-t-sm ${i === bestIdx ? 'bg-red-500' : amt > 0 ? 'bg-red-500/30' : 'bg-[#1a1b22]'}`} style={{ height: h }} />
                    </div>
                    <span className="text-[7px] text-gray-700">{DOW[i].slice(0,1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Largest single expense badge */}
      {expenses.length >= 3 && (() => {
        const largest = [...expenses].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))[0]
        if (!largest) return null
        const totalAll = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
        const pct = totalAll > 0 ? Math.round((Number(largest.amount ?? 0) / totalAll) * 100) : 0
        const CATS: Record<string, string> = { alimentation: '🛒', transport: '🚗', informatique: '💻', marketing: '📣', salaires: '👥', loyer: '🏠', fournitures: '🖊️', services: '🔧', autre: '📦' }
        const icon = CATS[largest.category] ?? '📦'
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">Dépense la + élevée</p>
                <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[160px]">{largest.description || largest.category}</p>
                {largest.date && <p className="text-[9px] text-gray-700">{new Date(largest.date).toLocaleDateString('fr-FR')}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-black text-red-400">{fmtTND(Number(largest.amount ?? 0))} TND</p>
              <span className="text-[9px] font-bold text-gray-600">{pct}% du total</span>
            </div>
          </div>
        )
      })()}

      {/* Monthly trend chart */}
      {expenses.length > 0 && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Dépenses mensuelles</h3>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowYoY(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  showYoY
                    ? 'bg-[#4a9eff]/15 border border-[#4a9eff]/40 text-[#4a9eff]'
                    : 'border border-[#1a1b22] text-gray-600 hover:text-gray-400'
                }`}>
                N-1
              </button>
              {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                <button key={y} onClick={() => setChartYear(y)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    chartYear === y
                      ? 'bg-[#d4a843]/15 border border-[#d4a843]/40 text-[#d4a843]'
                      : 'border border-[#1a1b22] text-gray-600 hover:text-gray-400'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totals.byMonth} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtTND(v)} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[#0a0b0f] border border-[#1a1b22] rounded-xl px-3 py-2 text-xs shadow-2xl">
                        <p className="text-gray-400 font-semibold mb-1.5">{label}</p>
                        <p className="font-mono font-bold text-red-400">{fmtTND(d.amount)} TND <span className="text-gray-600">({chartYear})</span></p>
                        {showYoY && d.amountPrev > 0 && (
                          <p className="font-mono text-[#4a9eff] mt-0.5">{fmtTND(d.amountPrev)} TND <span className="text-gray-600">({chartYear - 1})</span></p>
                        )}
                        {d.count > 0 && <p className="text-gray-600 mt-0.5">{d.count} entrée{d.count > 1 ? 's' : ''}</p>}
                      </div>
                    )
                  }}
                />
                {showYoY && <Bar dataKey="amountPrev" radius={[3, 3, 0, 0]} fill="#4a9eff" fillOpacity={0.35} />}
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#ef4444" fillOpacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Budget Panel */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        <button
          onClick={() => setBudgetOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#161b27]/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Target size={14} className="text-[#d4a843]" />
            <span className="text-sm font-bold text-white">Budgets mensuels</span>
            {Object.keys(budgets).filter(k => budgets[k] > 0).length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-[#d4a843]/10 text-[#d4a843] border border-[#d4a843]/20 rounded-full font-bold">
                {Object.keys(budgets).filter(k => budgets[k] > 0).length} configuré{Object.keys(budgets).filter(k => budgets[k] > 0).length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {budgetOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </button>

        {budgetOpen && (
          <div className="border-t border-[#1a1b22] px-5 py-4 space-y-3">
            <p className="text-xs text-gray-600">Définissez un plafond mensuel par catégorie. Une barre de progression s&apos;affichera automatiquement.</p>
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const spent  = totals.byCat[cat.value] ?? 0
                const limit  = budgets[cat.value] ?? 0
                const pct    = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
                const over   = limit > 0 && spent > limit
                const near   = limit > 0 && !over && pct >= 80
                const barCol = over ? 'bg-red-500' : near ? 'bg-amber-400' : 'bg-[#2dd4a0]'
                const nowC   = new Date()
                const trend3 = Array.from({ length: 3 }, (_, i) => {
                  const d = new Date(nowC.getFullYear(), nowC.getMonth() - (2 - i), 1)
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  return expenses.filter(e => e.category === cat.value && e.date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0)
                })
                const maxTrend = Math.max(...trend3, 1)
                const hasTrend = trend3.some(v => v > 0)
                return (
                  <div key={cat.value} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs text-gray-400 truncate">{cat.label}</span>
                        {hasTrend && (
                          <div className="flex items-end gap-0.5 h-4 shrink-0">
                            {trend3.map((v, ti) => {
                              const h = Math.max(2, Math.round((v / maxTrend) * 14))
                              const isLast = ti === 2
                              return <div key={ti} className={`w-1.5 rounded-sm ${isLast ? 'bg-[#d4a843]' : 'bg-[#252830]'}`} style={{ height: h }} />
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {limit > 0 && (
                          <span className={`text-[10px] font-mono ${over ? 'text-red-400' : near ? 'text-amber-400' : 'text-gray-500'}`}>
                            {fmtTND(spent)} / {fmtTND(limit)} TND
                          </span>
                        )}
                        {editingBudget === cat.value ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" step="0.001" min="0"
                              value={budgetInput}
                              onChange={e => setBudgetInput(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveBudget(cat.value, budgetInput)
                                if (e.key === 'Escape') { setEditingBudget(null); setBudgetInput('') }
                              }}
                              className="w-24 bg-[#0a0b0f] border border-[#d4a843]/60 rounded-lg px-2 py-1 text-xs text-white outline-none font-mono"
                            />
                            <button onClick={() => saveBudget(cat.value, budgetInput)} disabled={savingBudget}
                              className="text-[10px] px-2 py-1 bg-[#d4a843] text-black font-bold rounded-lg hover:bg-[#f0c060] transition-colors disabled:opacity-50">
                              OK
                            </button>
                            <button onClick={() => { setEditingBudget(null); setBudgetInput('') }}
                              className="text-[10px] px-2 py-1 border border-[#252830] text-gray-500 rounded-lg hover:text-white transition-colors">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingBudget(cat.value); setBudgetInput(limit > 0 ? String(limit) : '') }}
                            className="text-[10px] text-gray-600 hover:text-[#d4a843] transition-colors flex items-center gap-1"
                          >
                            <Pencil size={10} />{limit > 0 ? 'Modifier' : 'Définir'}
                          </button>
                        )}
                      </div>
                    </div>
                    {limit > 0 && (
                      <div className="w-full h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barCol}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recurring Expenses Panel */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        <button
          onClick={() => setRecurringOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#161b27]/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <RefreshCw size={14} className="text-[#2dd4a0]" />
            <span className="text-sm font-bold text-white">Dépenses récurrentes</span>
            {recurringList.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-[#2dd4a0]/10 text-[#2dd4a0] border border-[#2dd4a0]/20 rounded-full font-bold">
                {recurringList.filter(r => r.active).length} actives
              </span>
            )}
          </div>
          {recurringOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </button>

        {recurringOpen && (
          <div className="px-5 pb-5 space-y-3 border-t border-[#1a1b22]">
            <p className="text-xs text-gray-600 pt-4">
              Les dépenses récurrentes sont enregistrées automatiquement chaque mois au jour configuré.
            </p>

            {/* List */}
            {recurringList.length > 0 && (
              <div className="space-y-2">
                {recurringList.map(r => (
                  <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${r.active ? 'bg-[#161b27] border-[#252830]' : 'bg-[#0a0b0f] border-[#1a1b22] opacity-60'}`}>
                    <button
                      onClick={() => toggleRecurring(r.id, !r.active)}
                      className={`shrink-0 w-8 h-4 rounded-full transition-colors relative ${r.active ? 'bg-[#2dd4a0]' : 'bg-[#252830]'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${r.active ? 'left-4' : 'left-0.5'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{r.description}</p>
                      <p className="text-[10px] text-gray-600">
                        {CATEGORIES.find(c => c.value === r.category)?.label} · le {r.day_of_month} du mois
                        {r.last_logged && ` · dernier: ${new Date(r.last_logged).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#d4a843] shrink-0">{fmtTND(r.amount)} TND</span>
                    <button
                      onClick={() => {
                        setEditingRecurringId(r.id)
                        setRecurringForm({ description: r.description, amount: String(r.amount), category: r.category, notes: r.notes ?? '', day_of_month: String(r.day_of_month) })
                        setAddingRecurring(true)
                      }}
                      className="text-gray-700 hover:text-[#d4a843] transition-colors shrink-0">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteRecurring(r.id)} className="text-gray-700 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit form */}
            {addingRecurring ? (
              <div className="bg-[#161b27] border border-[#252830] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{editingRecurringId ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={LC}>Description *</label>
                    <input value={recurringForm.description} onChange={e => setRecurringForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Loyer, abonnement logiciel..." className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Montant (TND) *</label>
                    <input type="number" step="0.001" min="0" value={recurringForm.amount} onChange={e => setRecurringForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.000" className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Jour du mois (1–28)</label>
                    <input type="number" min="1" max="28" value={recurringForm.day_of_month} onChange={e => setRecurringForm(f => ({ ...f, day_of_month: e.target.value }))}
                      className={IC} />
                  </div>
                  <div className="col-span-2">
                    <label className={LC}>Catégorie</label>
                    <select value={recurringForm.category} onChange={e => setRecurringForm(f => ({ ...f, category: e.target.value }))} className={IC}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveRecurring} disabled={savingRecurring}
                    className="flex-1 py-2 bg-[#2dd4a0] hover:bg-[#34d8a8] disabled:opacity-50 text-black font-bold text-sm rounded-xl transition-colors">
                    {savingRecurring ? 'Sauvegarde...' : editingRecurringId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                  <button onClick={() => { setAddingRecurring(false); setEditingRecurringId(null); setRecurringForm(emptyRecurring()) }}
                    className="px-4 py-2 border border-[#252830] text-gray-400 hover:text-white text-sm rounded-xl transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingRecurring(true)}
                className="flex items-center gap-2 text-xs text-[#2dd4a0] hover:text-white border border-[#2dd4a0]/20 hover:border-[#2dd4a0]/40 px-3 py-2 rounded-xl transition-colors">
                <Plus size={12} />Ajouter une récurrence
              </button>
            )}
          </div>
        )}
      </div>

      {/* Category bar chart */}
      {expenses.length > 0 && (() => {
        const chartData = CATEGORIES
          .map(c => ({ name: c.label.split(' ')[0], amount: totals.byCat[c.value] ?? 0 }))
          .filter(d => d.amount > 0)
          .sort((a, b) => b.amount - a.amount)
        const BAR_COLORS = ['#ef4444','#f97316','#f59e0b','#d4a843','#a855f7','#ec4899','#14b8a6','#3b82f6','#2dd4a0','#6b7280']
        return (
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
            <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Répartition par catégorie</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmtTND(v)} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    contentStyle={{ background: '#0a0b0f', border: '1px solid #1a1b22', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: any) => [fmtTND(Number(v ?? 0)) + ' TND', 'Montant']}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* Budget vs Actual */}
      {Object.keys(budgets).length > 0 && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
          <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Budget vs Réel (ce mois)</h3>
          <div className="space-y-2.5">
            {CATEGORIES.filter(c => budgets[c.value]).map(c => {
              const limit  = budgets[c.value]
              const actual = expenses
                .filter(e => e.category === c.value && e.date.startsWith(new Date().toISOString().slice(0, 7)))
                .reduce((s, e) => s + Number(e.amount), 0)
              const pct    = Math.min(100, limit > 0 ? Math.round((actual / limit) * 100) : 0)
              const over   = actual > limit
              return (
                <div key={c.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{c.label.split(' ')[0]}</span>
                    <span className={`text-xs font-mono ${over ? 'text-red-400' : 'text-gray-400'}`}>
                      {fmtTND(actual)} / {fmtTND(limit)}
                      {over && <span className="ml-1.5 text-[9px] font-bold text-red-400">+{fmtTND(actual - limit)}</span>}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : pct >= 80 ? 'bg-[#f59e0b]' : 'bg-[#2dd4a0]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add expense form */}
      {formOpen && (
        <div className="bg-[#0f1118] border border-[#d4a843]/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Ajouter une dépense</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LC}>Description *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Loyer bureau, facture fournisseur..." className={IC} />
            </div>
            <div>
              <label className={LC}>Montant (TND) *</label>
              <input type="number" min="0" step="0.001" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.000" className={`${IC} font-mono`} />
            </div>
            <div>
              <label className={LC}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={IC} />
            </div>
            <div>
              <label className={LC}>Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={IC}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LC}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optionnel" className={IC} />
            </div>
          </div>

          {/* Receipt upload */}
          <div>
            <label className={LC}>Reçu / Justificatif</label>
            <input
              ref={receiptRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f) }}
            />
            {receiptUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#2dd4a0]/5 border border-[#2dd4a0]/20 rounded-xl">
                <Paperclip size={12} className="text-[#2dd4a0] shrink-0" />
                <a href={receiptUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-[#2dd4a0] hover:underline truncate flex-1">
                  Justificatif joint ✓
                </a>
                <button onClick={() => setReceiptUrl(null)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <XIcon size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#252830] rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:border-[#d4a843]/30 transition-colors disabled:opacity-50"
              >
                {uploading
                  ? <div className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
                  : <Paperclip size={12} />}
                {uploading ? 'Upload en cours...' : 'Joindre un reçu (JPG, PNG, PDF — max 5 Mo)'}
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !form.description || !form.amount}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors">
              {saving ? 'Sauvegarde...' : 'Ajouter'}
            </button>
            <button onClick={() => { setFormOpen(false); setForm(emptyForm()) }}
              className="px-4 py-2.5 border border-[#1a1b22] text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full bg-[#0f1118] border border-[#1a1b22] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCatFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              catFilter === 'all'
                ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]'
                : 'border-[#1a1b22] text-gray-600 hover:text-gray-300'
            }`}>
            Tout
          </button>
          {(() => {
            const ranked = CATEGORIES.filter(c => (totals.byCat[c.value] ?? 0) > 0)
              .sort((a, b) => (totals.byCat[b.value] ?? 0) - (totals.byCat[a.value] ?? 0))
            const rankMap: Record<string, number> = {}
            ranked.forEach((c, i) => { rankMap[c.value] = i })
            const medals = ['🥇', '🥈', '🥉']
            return ranked.map(c => {
              const curr = totals.byCat[c.value] ?? 0
              const prev = totals.byCatPrev[c.value] ?? 0
              const delta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null
              const rank = rankMap[c.value]
              return (
                <button key={c.value} onClick={() => setCatFilter(catFilter === c.value ? 'all' : c.value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    catFilter === c.value
                      ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]'
                      : 'border-[#1a1b22] text-gray-600 hover:text-gray-300'
                  }`}>
                  {rank < 3 && <span className="text-[10px]">{medals[rank]}</span>}
                  {c.label.split(' ')[0]}
                  {delta !== null && delta !== 0 && (
                    <span className={`text-[8px] font-bold ${delta > 0 ? 'text-red-400' : 'text-[#2dd4a0]'}`}>
                      {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}%
                    </span>
                  )}
                </button>
              )
            })
          })()}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          title="Date de début"
          className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a843] transition-colors" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          title="Date de fin"
          className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a843] transition-colors" />
        {(dateFrom || dateTo || catFilter !== 'all' || search) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setCatFilter('all'); setSearch('') }}
            className="px-3 py-2.5 border border-[#252830] text-gray-600 hover:text-white text-xs rounded-xl transition-colors whitespace-nowrap">
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#0d1420] border border-red-900/40 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-red-400 font-bold shrink-0">
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <button onClick={bulkDelete} disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900/40 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50">
            <Trash2 size={12} />{bulkDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto">
            Annuler
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#1a1b22]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="h-4 bg-[#1a1b22] rounded flex-1 max-w-[200px]" />
                <div className="h-4 bg-[#1a1b22] rounded w-20" />
                <div className="h-5 bg-[#1a1b22] rounded-full w-24" />
                <div className="h-4 bg-[#1a1b22] rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center">
              <Receipt size={28} className="text-gray-600" />
            </div>
            <div>
              <p className="text-base font-bold text-white mb-1">Aucune dépense</p>
              <p className="text-xs text-gray-500 max-w-xs">Commencez à enregistrer vos dépenses pour suivre votre rentabilité</p>
            </div>
            <button onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
              <Plus size={14} /> Ajouter une dépense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1b22]">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))}
                      onChange={() => toggleAll(filtered.map(e => e.id))}
                      className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                  </th>
                  {['Date', 'Description', 'Catégorie', 'Montant', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1b22]">
                  {filtered.map(e => (
                  <tr key={e.id} className={`hover:bg-[#161b27]/50 transition-colors group ${selected.has(e.id) ? 'bg-red-950/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleRow(e.id)}
                        className="w-3.5 h-3.5 rounded accent-[#d4a843] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                      {new Date(e.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      {inlineEditId === e.id ? (
                        <input
                          value={inlineEdit.description}
                          onChange={ev => setInlineEdit(p => ({ ...p, description: ev.target.value }))}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveInlineEdit(e.id); if (ev.key === 'Escape') setInlineEditId(null) }}
                          autoFocus
                          className="w-full bg-[#0a0b0f] border border-[#d4a843]/50 rounded-lg px-2 py-1 text-sm text-white outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-gray-200 font-medium">{e.description}</p>
                          {e.recurring_expense_id && (
                            <span title="Dépense récurrente" className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2dd4a0]/10 text-[#2dd4a0] border border-[#2dd4a0]/20">↻</span>
                          )}
                          {e.receipt_url && (
                            <button type="button" onClick={() => setLightboxUrl(e.receipt_url)}
                              title="Voir le justificatif"
                              className="group/rc relative text-[#2dd4a0] hover:text-[#2dd4a0]/80 transition-colors shrink-0">
                              <Paperclip size={11} />
                              {/\.(jpe?g|png|webp|gif)$/i.test(e.receipt_url) && (
                                <span className="pointer-events-none absolute bottom-5 left-0 z-20 hidden group-hover/rc:block">
                                  <img src={e.receipt_url} alt="reçu" className="w-28 h-28 object-cover rounded-lg border border-[#252830] shadow-2xl" />
                                </span>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => { setInlineEditId(e.id); setInlineEdit({ amount: String(e.amount), category: e.category, description: e.description }) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-[#d4a843] shrink-0">
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}
                      {e.notes && <p className="text-[10px] text-gray-600 mt-0.5">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {inlineEditId === e.id ? (
                        <select value={inlineEdit.category} onChange={ev => setInlineEdit(p => ({ ...p, category: ev.target.value }))}
                          className="bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2 py-1 text-xs text-white outline-none">
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLORS[e.category] ?? CAT_COLORS.autre}`}>
                          {CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-red-400 whitespace-nowrap text-right">
                      {inlineEditId === e.id ? (
                        <input
                          type="number" min="0" step="0.001"
                          value={inlineEdit.amount}
                          onChange={ev => setInlineEdit(p => ({ ...p, amount: ev.target.value }))}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveInlineEdit(e.id); if (ev.key === 'Escape') setInlineEditId(null) }}
                          className="w-24 bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2 py-1 text-xs text-red-400 outline-none font-mono text-right"
                        />
                      ) : (
                        <span>-{fmtTND(Number(e.amount))} TND</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inlineEditId === e.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveInlineEdit(e.id)} disabled={savingInline}
                            className="text-[10px] px-2 py-1 bg-[#d4a843] text-black font-bold rounded-lg hover:bg-[#f0c060] transition-colors disabled:opacity-50">
                            OK
                          </button>
                          <button onClick={() => setInlineEditId(null)}
                            className="text-[10px] px-2 py-1 border border-[#252830] text-gray-500 rounded-lg hover:text-white transition-colors">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleDelete(e.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                          title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#252830] bg-[#161b27]/50">
                  <td colSpan={3} className="px-4 py-3 text-xs text-gray-500 font-semibold">
                    Total ({filtered.length} dépense{filtered.length > 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-red-400 text-right whitespace-nowrap">
                    -{fmtTND(filtered.reduce((s, e) => s + Number(e.amount), 0))} TND
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Receipt lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                <Paperclip size={11} /> Justificatif
              </span>
              <div className="flex gap-2">
                <a href={lightboxUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors px-3 py-1.5 bg-[#0f1118] border border-[#1a1b22] rounded-lg">
                  Ouvrir ↗
                </a>
                <button onClick={() => setLightboxUrl(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f1118] border border-[#1a1b22] text-gray-400 hover:text-white transition-colors">
                  <XIcon size={14} />
                </button>
              </div>
            </div>
            {/\.(jpe?g|png|webp|gif)$/i.test(lightboxUrl) ? (
              <img src={lightboxUrl} alt="Justificatif"
                className="max-h-[80vh] max-w-full object-contain rounded-xl border border-[#1a1b22] shadow-2xl" />
            ) : (
              <iframe src={lightboxUrl} title="Justificatif PDF"
                className="w-full h-[80vh] rounded-xl border border-[#1a1b22]" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
