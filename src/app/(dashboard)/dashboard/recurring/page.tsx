'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2, Power, PlayCircle, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { fmtTND } from '@/lib/utils/tva-calculator'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import Link from 'next/link'

type RecLine = { id: string; description: string; quantity: number; unit_price: number; tva_rate: number }
type RecurringRow = {
  id: string; name: string; frequency: string; next_date: string
  last_generated: string | null; is_active: boolean; notes: string | null
  clients: { id: string; name: string } | null
  recurring_invoice_lines: RecLine[]
}

type TvaRate = 0 | 7 | 13 | 19
type NewLine = { description: string; quantity: number; unit_price: number; tva_rate: TvaRate }

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire', monthly: 'Mensuel', quarterly: 'Trimestriel', yearly: 'Annuel',
}

const FREQ_COLORS: Record<string, string> = {
  weekly:    'text-[#4a9eff] bg-[#4a9eff]/10 border-[#4a9eff]/30',
  monthly:   'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/30',
  quarterly: 'text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/30',
  yearly:    'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/30',
}

const emptyLine = (): NewLine => ({ description: '', quantity: 1, unit_price: 0, tva_rate: 19 })

const IC = 'bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-[#d4a843] transition-colors w-full'
const NI = IC + ' font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

export default function RecurringPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<RecurringRow[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [frequency, setFrequency] = useState<'weekly'|'monthly'|'quarterly'|'yearly'>('monthly')
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [formLines, setFormLines] = useState<NewLine[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const [{ data: rec }, { data: cls }] = await Promise.all([
      fetch('/api/recurring').then(r => r.json()),
      (supabase as any).from('clients').select('id, name').eq('company_id', activeCompany.id).order('name'),
    ])
    setItems(rec?.recurring ?? [])
    setClients(cls ?? [])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => { load() }, [load])

  function updateLine(i: number, field: keyof NewLine, value: string | number) {
    setFormLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function validateForm(): string[] {
    const e: string[] = []
    if (!name.trim()) e.push('Nom du modèle requis')
    if (!nextDate) e.push('Date de première génération requise')
    formLines.forEach((l, i) => {
      if (!l.description.trim()) e.push(`Ligne ${i + 1} : description manquante`)
      if (l.quantity <= 0) e.push(`Ligne ${i + 1} : quantité invalide`)
    })
    return e
  }

  async function handleCreate() {
    const errs = validateForm()
    if (errs.length) { setFormErrors(errs); return }
    setSaving(true); setFormErrors([])
    const res = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), client_id: clientId || null,
        frequency, next_date: nextDate, notes: notes || null,
        lines: formLines.map(l => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(data.error ?? 'Erreur', 'err'); return }
    showToast('Modèle créé !')
    setShowForm(false); setName(''); setClientId(''); setNotes(''); setFormLines([emptyLine()])
    load()
  }

  async function handleToggle(item: RecurringRow) {
    const res = await fetch(`/api/recurring/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    if (res.ok) { showToast(item.is_active ? 'Désactivé' : 'Activé'); load() }
    else showToast('Erreur', 'err')
  }

  async function handleGenerate(item: RecurringRow) {
    setGenerating(item.id)
    const res = await fetch(`/api/recurring/${item.id}`, { method: 'POST' })
    const data = await res.json()
    setGenerating(null)
    if (!res.ok) { showToast(data.error ?? 'Erreur', 'err'); return }
    showToast(`Facture ${data.invoice?.number} créée !`)
    load()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await fetch(`/api/recurring/${deleteId}`, { method: 'DELETE' })
    setDeleting(false); setDeleteId(null)
    showToast('Modèle supprimé'); load()
  }

  const totalHT = (lines: RecLine[]) =>
    lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-2xl border ${
          toast.type === 'ok' ? 'bg-[#0f1118] border-[#2dd4a0]/40 text-[#2dd4a0]' : 'bg-[#0f1118] border-red-500/40 text-red-400'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Factures récurrentes</h1>
          <p className="text-gray-500 text-sm">Modèles auto-générés selon une fréquence définie</p>
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          Nouveau modèle
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#d4a843] uppercase tracking-wider">Nouveau modèle récurrent</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Nom du modèle *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Abonnement mensuel" className={IC} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={IC}>
                <option value="">Aucun client sélectionné</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fréquence *</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as typeof frequency)} className={IC}>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
                <option value="yearly">Annuel</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Première génération *</label>
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={IC} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles..." className={IC} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Lignes de facturation *</div>
            <div className="space-y-2">
              {formLines.map((l, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 70px 90px 100px 24px' }}>
                  <input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description..." className={IC} />
                  <input type="number" min="0.001" step="0.001" value={l.quantity || ''} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Qté" className={NI} />
                  <input type="number" min="0" step="0.001" value={l.unit_price || ''} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="Prix U." className={NI} />
                  <select value={l.tva_rate} onChange={e => updateLine(i, 'tva_rate', Number(e.target.value) as TvaRate)} className={IC}>
                    {[0, 7, 13, 19].map(r => <option key={r} value={r}>{r}% TVA</option>)}
                  </select>
                  <button onClick={() => setFormLines(p => p.filter((_, idx) => idx !== i))} disabled={formLines.length === 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 disabled:opacity-20 transition-colors">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setFormLines(p => [...p, emptyLine()])}
              className="mt-2 text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors">
              + Ajouter une ligne
            </button>
          </div>

          {formErrors.length > 0 && (
            <ul className="text-xs text-red-400 space-y-0.5 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2">
              {formErrors.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setFormErrors([]) }}
              className="px-4 py-2 rounded-xl border border-[#252830] text-sm text-gray-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : null}
              Créer le modèle
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-[#1a1b22] rounded w-1/3 mb-2" />
              <div className="h-3 bg-[#1a1b22] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center mx-auto mb-4">
            <Calendar size={22} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">Aucun modèle récurrent</p>
          <p className="text-gray-600 text-sm mb-4">Créez un modèle pour automatiser vos factures périodiques.</p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            <Plus size={14} /> Créer un modèle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`bg-[#0f1118] border rounded-2xl overflow-hidden transition-colors ${
              item.is_active ? 'border-[#1a1b22]' : 'border-[#1a1b22]/50 opacity-60'
            }`}>
              {/* Row header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => setExpanded(p => p === item.id ? null : item.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${FREQ_COLORS[item.frequency] ?? FREQ_COLORS.monthly}`}>
                    {FREQ_LABELS[item.frequency] ?? item.frequency}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.clients?.name ?? 'Aucun client'} · Prochaine : {new Date(item.next_date).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="font-mono text-sm text-[#d4a843] font-bold">
                      {fmtTND(totalHT(item.recurring_invoice_lines))} TND
                    </div>
                    <div className="text-[10px] text-gray-600">HT estimé</div>
                  </div>
                  {expanded === item.id ? <ChevronUp size={14} className="text-gray-500 shrink-0 ml-1" /> : <ChevronDown size={14} className="text-gray-500 shrink-0 ml-1" />}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleGenerate(item)} disabled={!!generating}
                    title="Générer une facture maintenant"
                    className="p-2 rounded-xl text-[#2dd4a0] hover:bg-[#2dd4a0]/10 disabled:opacity-40 transition-colors">
                    {generating === item.id ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  </button>
                  <button onClick={() => handleToggle(item)} title={item.is_active ? 'Désactiver' : 'Activer'}
                    className={`p-2 rounded-xl transition-colors ${
                      item.is_active ? 'text-[#d4a843] hover:bg-[#d4a843]/10' : 'text-gray-600 hover:bg-[#1a1b22]'
                    }`}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => setDeleteId(item.id)} title="Supprimer"
                    className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded lines */}
              {expanded === item.id && (
                <div className="border-t border-[#1a1b22] px-5 py-4">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Lignes de facturation</div>
                  <div className="space-y-1">
                    {item.recurring_invoice_lines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 truncate flex-1 mr-4">{l.description}</span>
                        <span className="text-gray-500 text-xs mr-4">×{l.quantity} @ {fmtTND(l.unit_price)} — TVA {l.tva_rate}%</span>
                        <span className="font-mono text-gray-300 text-xs">{fmtTND(l.quantity * l.unit_price)} TND</span>
                      </div>
                    ))}
                  </div>
                  {item.last_generated && (
                    <p className="text-[10px] text-gray-600 mt-3">
                      Dernière génération : {new Date(item.last_generated).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId} title="Supprimer ce modèle ?"
        description="Les factures déjà générées ne seront pas supprimées."
        confirmLabel="Supprimer" dangerous loading={deleting}
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
