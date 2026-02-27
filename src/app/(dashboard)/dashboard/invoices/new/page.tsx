'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Send, Save, RefreshCw, AlertTriangle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { usePlan } from '@/hooks/usePlan'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import { calcInvoiceTotals, fmtTND, round3, STAMP_DUTY } from '@/lib/utils/tva-calculator'
import { amountToWords } from '@/lib/utils/amount-to-words'
import { nextInvoiceNumber } from '@/lib/utils/invoice-number'
import { ClientCombobox } from '@/components/invoice/ClientCombobox'
import { InvoiceLineItem } from '@/components/invoice/InvoiceLineItem'
import { ClientModal } from '@/components/clients/ClientModal'
import type { ComboClient } from '@/components/invoice/ClientCombobox'
import type { InvLine, TvaRate } from '@/components/invoice/InvoiceLineItem'

const SECTION = 'bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'

function newLine(): InvLine {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, tva_rate: 19 as TvaRate, line_ht: 0, line_ttc: 0 }
}

export default function NewInvoicePage() {
  const { activeCompany } = useCompany()
  const plan = usePlan()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<InvLine[]>([newLine()])
  const [notes, setNotes] = useState('')
  const [selectedClient, setSelectedClient] = useState<ComboClient | null>(null)

  const [clients, setClients] = useState<ComboClient[]>([])
  const [hasMandate, setHasMandate] = useState(false)
  const [hasCert, setHasCert] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [addClientOpen, setAddClientOpen] = useState(false)
  const [showSigWarning, setShowSigWarning] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'quota' | 'mandate'>('quota')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    const [
      { data: cls },
      { data: lastInv },
      { data: co },
      { data: mdt },
    ] = await Promise.all([
      supabase.from('clients').select('id,name,type,matricule_fiscal,address,gouvernorat,phone,email').eq('company_id', activeCompany.id).order('name'),
      supabase.from('invoices').select('number').eq('company_id', activeCompany.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('companies').select('invoice_prefix,own_cert_pem').eq('id', activeCompany.id).single(),
      supabase.from('mandates').select('id').eq('company_id', activeCompany.id).eq('is_active', true).limit(1).maybeSingle(),
    ])
    setClients((cls ?? []) as ComboClient[])
    const prefix = (co as any)?.invoice_prefix ?? 'FP'
    setInvoiceNumber(nextInvoiceNumber((lastInv as any)?.number, prefix))
    setHasMandate(!!mdt)
    setHasCert(!!(co as any)?.own_cert_pem)
    const preId = searchParams.get('client_id')
    if (preId && cls) {
      const pre = (cls as ComboClient[]).find(c => c.id === preId)
      if (pre) setSelectedClient(pre)
    }
    setLoading(false)
  }, [activeCompany?.id, supabase, searchParams])

  useEffect(() => { loadData() }, [loadData])

  function updateLine(id: string, field: keyof InvLine, value: any) {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const u = { ...l, [field]: value }
      const ht = round3(Number(u.quantity) * Number(u.unit_price))
      return { ...u, line_ht: ht, line_ttc: round3(ht + ht * Number(u.tva_rate) / 100) }
    }))
  }

  function addLine() { setLines(p => [...p, newLine()]) }
  function removeLine(id: string) { setLines(p => p.filter(l => l.id !== id)) }

  function addDiscount() {
    setLines(p => [...p, { ...newLine(), description: 'Remise', unit_price: -0, tva_rate: 0 as TvaRate }])
  }

  const totals = useMemo(() =>
    calcInvoiceTotals(lines.map(l => ({ quantity: l.quantity, unit_price: l.unit_price, tva_rate: l.tva_rate }))),
    [lines]
  )

  function validate(forSubmit = false): string[] {
    const e: string[] = []
    if (!invoiceDate) e.push('Date de facture requise')
    if (!selectedClient) e.push('Client requis')
    if (lines.length === 0) e.push('Au moins une ligne de facture requise')
    lines.forEach((l, i) => {
      if (!l.description.trim()) e.push(`Ligne ${i + 1} : description manquante`)
      if (l.quantity === 0) e.push(`Ligne ${i + 1} : quantite invalide`)
    })
    if (selectedClient?.type === 'B2B' && !selectedClient.matricule_fiscal) {
      e.push('Client B2B : matricule fiscal manquant sur la fiche client')
    }
    if (forSubmit && !hasMandate && !hasCert) {
      e.push('Signature electronique non configuree')
    }
    return e
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function buildAndSave(status: string): Promise<string | null> {
    if (!activeCompany?.id) return null
    const payload = {
      company_id: activeCompany.id,
      client_id: selectedClient?.id ?? null,
      number: invoiceNumber,
      issue_date: invoiceDate,
      due_date: dueDate || null,
      notes: notes || null,
      status,
      ht_amount: totals.total_ht,
      tva_amount: totals.total_tva,
      stamp_amount: totals.stamp_duty,
      ttc_amount: totals.total_ttc,
      total_in_words: amountToWords(totals.total_ttc),
    }
    let id = savedId
    if (id) {
      await supabase.from('invoices').update(payload).eq('id', id)
    } else {
      const { data } = await supabase.from('invoices').insert(payload).select('id').single()
      id = (data as any)?.id ?? null
      if (id) setSavedId(id)
    }
    if (id) {
      await supabase.from('invoice_line_items').delete().eq('invoice_id', id)
      await supabase.from('invoice_line_items').insert(
        lines.map((l, idx) => ({
          invoice_id: id, sort_order: idx,
          description: l.description, quantity: l.quantity, unit_price: l.unit_price,
          tva_rate: l.tva_rate, line_ht: l.line_ht,
          line_tva: round3(l.line_ht * l.tva_rate / 100), line_ttc: l.line_ttc,
        }))
      )
    }
    return id
  }

  async function handleSaveDraft() {
    const e = validate(false)
    if (e.length > 0) { setValidationErrors(e); return }
    setSaving(true); setValidationErrors([])
    const id = await buildAndSave('draft')
    setLastSaved(new Date()); setSaving(false)
    if (id) { showToast('Brouillon sauvegarde'); router.push(`/dashboard/invoices/${id}`) }
  }

  async function handleSubmitTTN() {
    const e = validate(true)
    if (e.length > 0) { setValidationErrors(e); return }
    if (!plan.canUseMandate && !hasCert) {
      setUpgradeReason('mandate')
      setUpgradeOpen(true)
      return
    }
    if (!hasMandate && !hasCert) { setShowSigWarning(true); return }
    setSubmitting(true); setValidationErrors([])
    const id = await buildAndSave('draft')
    if (!id) { setSubmitting(false); return }
    const res = await fetch('/api/invoices/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      setSubmitSuccess(true)
      showToast('Facture soumise a TTN', 'success')
      setTimeout(() => router.push(`/dashboard/invoices/${id}`), 2000)
    } else {
      setValidationErrors([data.error ?? 'Erreur lors de la soumission'])
    }
  }

  // Auto-save
  useEffect(() => {
    const hasContent = lines.some(l => l.description.trim())
    if (!hasContent) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      if (!activeCompany?.id) return
      await buildAndSave('draft')
      setLastSaved(new Date())
    }, 30000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [lines, selectedClient, invoiceDate, dueDate, notes, activeCompany?.id])

  const sigStatus = hasMandate ? 'mandate' : hasCert ? 'cert' : 'none'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Chargement...</div>
      </div>
    )
  }

  // Quota / expired — blocked state
  if (!plan.loading && !plan.canCreateInvoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center">
          <Lock size={28} className="text-gray-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white mb-2">
            {plan.isExpired ? 'Compte suspendu' : 'Limite mensuelle atteinte'}
          </h2>
          <p className="text-sm text-gray-400 max-w-sm">
            {plan.isExpired
              ? 'Votre essai est terminé. Choisissez un plan pour continuer à créer des factures.'
              : `Vous avez utilisé ${plan.invoicesUsed} / ${plan.invoiceLimit} factures ce mois. Passez au plan Pro pour des factures illimitées.`
            }
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-5 py-2.5 border border-[#1a1b22] text-gray-400 text-sm rounded-xl hover:bg-[#161b27] transition-colors">Retour</button>
          <button onClick={() => router.push('/pricing')} className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-sm rounded-xl transition-colors">Upgrade →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        featureName={upgradeReason === 'mandate' ? 'Mandat de signature TTN' : 'Factures illimitées'}
        requiredPlan="pro"
        featureBenefit={upgradeReason === 'mandate'
          ? 'Le mandat de signature est inclus dans le plan Pro, économisant ~350 TND/an vs un achat séparé.'
          : 'Le plan Pro offre des factures illimitées pour votre activité.'
        }
      />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-2xl border transition-all ${
          toast.type === 'success'
            ? 'bg-[#0f1118] border-[#2dd4a0]/40 text-[#2dd4a0]'
            : 'bg-[#0f1118] border-red-500/40 text-red-400'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            Factures
          </Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-base font-bold text-white">Nouvelle facture</h1>
          {invoiceNumber && (
            <span className="text-xs font-mono text-[#d4a843] bg-[#d4a843]/10 border border-[#d4a843]/20 px-2 py-0.5 rounded-lg">
              {invoiceNumber}
            </span>
          )}
        </div>
        {lastSaved && (
          <span className="text-[10px] text-gray-600">
            Sauvegarde {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-xs font-bold text-red-400 uppercase">Validation requise</span>
          </div>
          <ul className="space-y-0.5">
            {validationErrors.map((e, i) => (
              <li key={i} className="text-xs text-red-300"> {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

        {/*  LEFT: FORM (3/5  60%)  */}
        <div className="xl:col-span-3 space-y-4">

          {/* SECTION 1: Invoice header */}
          <div className={SECTION}>
            <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">En-tete facture</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Numero de facture</label>
                <div className="flex gap-2">
                  <input value={invoiceNumber} readOnly
                    className="flex-1 bg-[#0a0b0f] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm font-mono text-[#d4a843] outline-none cursor-default" />
                  <button type="button" onClick={loadData} title="Regenerer"
                    className="w-10 flex items-center justify-center bg-[#161b27] border border-[#1a1b22] rounded-xl text-gray-500 hover:text-white hover:border-[#252830] transition-colors">
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <div>
                <label className={LC}>Date de facture *</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LC}>Date d'echeance</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className={IC} placeholder="Optionnel" />
                <p className="text-[10px] text-gray-600 mt-1">J+30 recommande</p>
              </div>
              <div>
                <label className={LC}>Reference (optionnel)</label>
                <input value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="Bon de commande, projet..." className={IC} />
              </div>
            </div>
          </div>

          {/* SECTION 2: Client */}
          <div className={SECTION}>
            <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Facturer a</div>
            <ClientCombobox
              clients={clients}
              selected={selectedClient}
              onSelect={setSelectedClient}
              onAddNew={() => setAddClientOpen(true)}
            />
          </div>

          {/* SECTION 3: Line items */}
          <div className={SECTION}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Lignes de facturation</div>
              <button type="button" onClick={addLine}
                className="flex items-center gap-1.5 text-xs font-bold text-[#d4a843] hover:text-[#f0c060] transition-colors">
                <Plus size={13} strokeWidth={2.5} />
                Ajouter une ligne
              </button>
            </div>

            {/* Column headers */}
            <div className="hidden md:grid gap-2 px-0 pb-2 border-b border-[#1a1b22]"
              style={{ gridTemplateColumns: '1fr 80px 100px 130px 90px 90px 28px' }}>
              {['Description', 'Qte', 'Prix U. HT', 'TVA', 'HT', 'TTC', ''].map(h => (
                <div key={h} className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">{h}</div>
              ))}
            </div>

            <div className="space-y-0">
              {lines.map((l, i) => (
                <InvoiceLineItem
                  key={l.id} line={l} index={i}
                  isOnly={lines.length === 1}
                  onChange={updateLine}
                  onRemove={removeLine}
                />
              ))}
            </div>

            <button type="button" onClick={addDiscount}
              className="mt-3 text-xs text-gray-600 hover:text-gray-300 transition-colors">
              + Ajouter une remise globale
            </button>
          </div>

          {/* SECTION 4: Notes */}
          <div className={SECTION}>
            <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Conditions de paiement, RIB, mentions legales..."
              className={`${IC} resize-none`} />
          </div>
        </div>

        {/*  RIGHT: TOTALS PANEL (2/5  40%)  */}
        <div className="xl:col-span-2">
          <div className="sticky top-4 space-y-4">

            {/* Totals card */}
            <div className={SECTION}>
              <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Recapitulatif</div>
              <div className="space-y-2.5">

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total HT</span>
                  <span className="font-mono text-gray-200">{fmtTND(totals.total_ht)} TND</span>
                </div>

                {Object.entries(totals.tva_by_rate).filter(([, v]) => v.base > 0).map(([rate, v]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      TVA {rate}%
                      <span className="text-[10px] text-gray-700 ml-1">(base: {fmtTND(v.base)})</span>
                    </span>
                    <span className="font-mono text-gray-300">
                      {Number(rate) === 0 ? '' : fmtTND(v.tva)} TND
                    </span>
                  </div>
                ))}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Droit de timbre</span>
                  <span className="font-mono text-gray-400">{fmtTND(STAMP_DUTY)} TND</span>
                </div>

                <div className="border-t-2 border-[#252830] pt-3 mt-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">TOTAL TTC</span>
                    <span className="font-mono text-xl font-black text-[#d4a843]">
                      {fmtTND(totals.total_ttc)}
                      <span className="text-sm font-normal text-gray-500 ml-1">TND</span>
                    </span>
                  </div>
                </div>

                {totals.total_ttc > 0 && (
                  <div className="bg-[#161b27] rounded-lg px-3 py-2.5 mt-1">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Montant en lettres</div>
                    <p className="text-xs text-gray-400 leading-relaxed italic">
                      {amountToWords(totals.total_ttc)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Signature status card */}
            <div className={SECTION}>
              <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Signature electronique</div>
              {sigStatus === 'mandate' && (
                <div className="flex items-center gap-2 text-xs text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-lg px-3 py-2">
                  <span className="font-bold"></span> Signature Fatoura Pro active
                </div>
              )}
              {sigStatus === 'cert' && (
                <div className="flex items-center gap-2 text-xs text-[#4a9eff] bg-[#4a9eff]/10 border border-[#4a9eff]/20 rounded-lg px-3 py-2">
                  <span className="font-bold"></span> Votre certificat ANCE
                </div>
              )}
              {sigStatus === 'none' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[#e05a5a] bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} className="shrink-0" />
                    Signature non configuree
                  </div>
                  <Link href="/dashboard/settings/mandate"
                    className="block text-xs text-center text-gray-500 hover:text-[#d4a843] transition-colors">
                    Configurer la signature 
                  </Link>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button type="button" onClick={handleSaveDraft} disabled={saving || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#252830] bg-[#161b27] text-sm text-gray-300 hover:text-white hover:bg-[#252830] transition-colors disabled:opacity-50">
                <Save size={15} />
                {saving ? 'Enregistrement...' : 'Enregistrer en brouillon'}
              </button>

              <button type="button" onClick={handleSubmitTTN} disabled={saving || submitting || submitSuccess}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors disabled:opacity-50">
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Soumission en cours...
                  </>
                ) : submitSuccess ? (
                  <> Soumis a TTN</>
                ) : (
                  <>
                    <Send size={15} />
                    Soumettre a TTN
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature warning modal */}
      {showSigWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSigWarning(false)} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1118] border border-red-900/50 rounded-2xl p-6 space-y-4">
            <div className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle size={18} className="text-[#e05a5a]" />
              Signature requise
            </div>
            <p className="text-sm text-gray-400">
              Vous devez configurer une signature electronique pour soumettre des factures a TTN.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowSigWarning(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300 hover:bg-white/5">
                Annuler
              </button>
              <Link href="/dashboard/settings/mandate" onClick={() => setShowSigWarning(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold text-center">
                Configurer
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Add client modal */}
      {activeCompany && (
        <ClientModal
          open={addClientOpen}
          onClose={() => setAddClientOpen(false)}
          onSaved={async () => {
            await loadData()
            setAddClientOpen(false)
          }}
          companyId={activeCompany.id}
        />
      )}
    </div>
  )
}
