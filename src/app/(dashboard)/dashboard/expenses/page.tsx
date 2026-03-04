'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Trash2, Receipt, TrendingDown, Download, Paperclip, X as XIcon } from 'lucide-react'
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
  const receiptRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

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

  const filtered = useMemo(() => {
    let list = expenses
    if (catFilter !== 'all') list = list.filter(e => e.category === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.description.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q))
    }
    return list
  }, [expenses, catFilter, search])

  const totals = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthly = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + Number(e.amount), 0)
    const total   = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const byCat   = Object.fromEntries(
      CATEGORIES.map(c => [c.value, expenses.filter(e => e.category === c.value).reduce((s, e) => s + Number(e.amount), 0)])
    )
    return { monthly, total, byCat }
  }, [expenses])

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

  async function handleDelete(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    showToast('Dépense supprimée')
    load()
  }

  function exportCSV() {
    const header = 'Date,Description,Catégorie,Montant (TND),Notes'
    const rows = expenses.map(e =>
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
        {[
          { label: 'Ce mois', value: fmtTND(totals.monthly) + ' TND', color: 'text-red-400' },
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full bg-[#0f1118] border border-[#1a1b22] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a843] transition-colors">
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

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
                  {['Date', 'Description', 'Catégorie', 'Montant', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1b22]">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-[#161b27]/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                      {new Date(e.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-gray-200 font-medium">{e.description}</p>
                        {e.receipt_url && (
                          <a href={e.receipt_url} target="_blank" rel="noreferrer" title="Voir le justificatif"
                            className="text-[#2dd4a0] hover:text-[#2dd4a0]/80 transition-colors shrink-0">
                            <Paperclip size={11} />
                          </a>
                        )}
                      </div>
                      {e.notes && <p className="text-[10px] text-gray-600 mt-0.5">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLORS[e.category] ?? CAT_COLORS.autre}`}>
                        {CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-red-400 whitespace-nowrap text-right">
                      -{fmtTND(Number(e.amount))} TND
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(e.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                        title="Supprimer">
                        <Trash2 size={13} />
                      </button>
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
    </div>
  )
}
