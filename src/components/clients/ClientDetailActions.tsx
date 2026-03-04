'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ClientModal } from './ClientModal'
import type { ClientRecord } from './ClientModal'

const CATEGORIES = [
  { value: 'loyer',        label: 'Loyer / Bureau' },
  { value: 'salaires',     label: 'Salaires' },
  { value: 'materiel',     label: 'Matériel' },
  { value: 'transport',    label: 'Transport' },
  { value: 'telecom',      label: 'Télécom' },
  { value: 'fournitures',  label: 'Fournitures' },
  { value: 'marketing',    label: 'Marketing' },
  { value: 'comptabilite', label: 'Comptabilité' },
  { value: 'impots',       label: 'Impôts' },
  { value: 'autre',        label: 'Autre' },
]

interface Props {
  clientId: string
  client: ClientRecord
  companyId: string
}

export function ClientDetailActions({ clientId, client, companyId }: Props) {
  const [open, setOpen] = useState(false)
  const [expOpen, setExpOpen] = useState(false)
  const [desc, setDesc] = useState(`Dépense — ${client.name ?? ''}`)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('autre')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  function handleSaved() { window.location.reload() }

  async function saveExpense() {
    if (!amount || !desc) return
    setSaving(true)
    await supabase.from('expenses').insert({
      company_id:  companyId,
      description: desc,
      amount:      parseFloat(amount),
      category,
      date,
    })
    setSaving(false)
    setSaved(true)
    setAmount('')
    setDesc(`Dépense — ${client.name ?? ''}`)
    setCategory('autre')
    setTimeout(() => { setSaved(false); setExpOpen(false) }, 1800)
  }

  const IC = 'w-full bg-[#0a0b0f] border border-[#1a1b22] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors"
      >
        Modifier
      </button>

      {/* Quick-add expense */}
      <button
        onClick={() => setExpOpen(v => !v)}
        className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
          expOpen ? 'border-red-900/40 text-red-400 bg-red-950/10' : 'border-[#1a1b22] text-gray-400 hover:text-white hover:border-[#252830]'
        }`}
      >
        {expOpen ? <X size={13} /> : <Plus size={13} />}
        {expOpen ? 'Annuler' : '+ Dépense liée'}
      </button>

      {expOpen && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nouvelle dépense</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className={IC} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Montant (TND)</label>
              <input type="number" min="0" step="0.001" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.000"
                className={`${IC} font-mono`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={IC} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={IC}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button onClick={saveExpense} disabled={saving || !amount || !desc}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
              saved ? 'bg-[#2dd4a0]/20 text-[#2dd4a0] border border-[#2dd4a0]/30'
                    : 'bg-red-950/30 text-red-400 border border-red-900/30 hover:bg-red-950/50'
            }`}>
            {saving ? 'Enregistrement...' : saved ? '✓ Dépense ajoutée' : 'Enregistrer la dépense'}
          </button>
        </div>
      )}

      <ClientModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={handleSaved}
        companyId={companyId}
        initial={client}
      />
    </>
  )
}
