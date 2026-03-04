'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Send, Save, RefreshCw, AlertTriangle, Lock, ScanLine } from 'lucide-react'
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
import { InvoiceScannerModal } from '@/components/ai/InvoiceScannerModal'
import { AIDraftInvoice } from '@/components/ai/AIDraftInvoice'
import { ConfettiCelebration } from '@/components/shared/ConfettiCelebration'
import type { ScannedInvoice } from '@/types/scanner'

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
  const [currency, setCurrency] = useState<'TND' | 'EUR' | 'USD'>('TND')
  const [exchangeRate, setExchangeRate] = useState<string>('1')
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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ number: string; id: string } | null>(null)
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const [pastDescriptions, setPastDescriptions] = useState<string[]>([])

  const autoSaveRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buildAndSaveRef = useRef<((status: string) => Promise<string | null>) | null>(null)

  function applyDraft(draft: {
    client_id: string | null
    client_name_hint: string | null
    due_date: string | null
    notes: string
    lines: { description: string; quantity: number; unit_price: number; tva_rate: number }[]
  }) {
    if (draft.client_id) {
      const match = clients.find(c => c.id === draft.client_id)
      if (match) setSelectedClient(match)
    }
    if (draft.due_date) setDueDate(draft.due_date)
    if (draft.notes) setNotes(draft.notes)
    if (draft.lines.length > 0) {
      setLines(draft.lines.map(l => ({
        id:          crypto.randomUUID(),
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tva_rate:    ([0, 7, 13, 19].includes(l.tva_rate) ? l.tva_rate : 19) as TvaRate,
        line_ht:     l.quantity * l.unit_price,
        line_ttc:    l.quantity * l.unit_price * (1 + l.tva_rate / 100),
      })))
    }
    showToast('Facture pré-remplie par l\'IA — vérifiez avant de sauvegarder', 'success')
  }

  function handleScanConfirm(scanned: ScannedInvoice) {
    setScannerOpen(false)
    if (scanned.client.name) {
      const match = clients.find(
        c => c.name.toLowerCase() === scanned.client.name.toLowerCase()
      )
      if (match) setSelectedClient(match)
    }
    if (scanned.invoice.date) setInvoiceDate(scanned.invoice.date)
    if (scanned.invoice.due_date) setDueDate(scanned.invoice.due_date)
    if (scanned.lines.length > 0) {
      setLines(scanned.lines.map(l => ({
        id:          crypto.randomUUID(),
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tva_rate:    l.tva_rate as TvaRate,
        line_ht:     l.total_ht,
        line_ttc:    Math.round(l.total_ht * (1 + l.tva_rate / 100) * 1000) / 1000,
      })))
    }
    showToast('Données scannées importées — vérifiez avant de sauvegarder', 'success')
  }

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) {
      setLoading(false)
      return
    }
    const editId = searchParams.get('edit')
    const [
      { data: cls },
      { data: lastInv },
      { data: co },
      { data: mdt },
      { data: pastLines },
    ] = await Promise.all([
      supabase.from('clients').select('id,name,type,matricule_fiscal,address,gouvernorat,phone,email').eq('company_id', activeCompany.id).order('name'),
      supabase.from('invoices').select('number').eq('company_id', activeCompany.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('companies').select('invoice_prefix,own_cert_pem').eq('id', activeCompany.id).single(),
      supabase.from('mandates').select('id').eq('company_id', activeCompany.id).eq('is_active', true).limit(1).maybeSingle(),
      (supabase as any).from('invoice_line_items').select('description').eq('company_id', activeCompany.id).order('created_at', { ascending: false }).limit(200),
    ])
    setClients((cls ?? []) as ComboClient[])
    const prefix = (co as any)?.invoice_prefix ?? 'FP'
    setHasMandate(!!mdt)
    setHasCert(!!(co as any)?.own_cert_pem)
    if (pastLines) {
      const unique = [...new Set((pastLines as any[]).map((l: any) => (l.description ?? '').trim()).filter(Boolean))]
      setPastDescriptions(unique.slice(0, 80))
    }

    if (editId) {
      // Load existing draft for editing
      setSavedId(editId)
      const [{ data: inv }, { data: existingLines }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', editId).eq('company_id', activeCompany.id).single(),
        supabase.from('invoice_line_items').select('*').eq('invoice_id', editId).order('sort_order'),
      ])
      if (inv) {
        setInvoiceNumber((inv as any).number ?? nextInvoiceNumber((lastInv as any)?.number, prefix))
        setInvoiceDate((inv as any).issue_date ?? new Date().toISOString().slice(0, 10))
        setDueDate((inv as any).due_date ?? '')
        setNotes((inv as any).notes ?? '')
        setReference((inv as any).reference ?? '')
        if ((inv as any).currency) setCurrency((inv as any).currency as 'TND' | 'EUR' | 'USD')
        if ((inv as any).exchange_rate) setExchangeRate(String((inv as any).exchange_rate))
        const clientId = (inv as any).client_id
        if (clientId && cls) {
          const pre = (cls as ComboClient[]).find(c => c.id === clientId)
          if (pre) setSelectedClient(pre)
        }
      }
      if (existingLines?.length) {
        setLines(existingLines.map((l: any) => ({
          id: crypto.randomUUID(),
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tva_rate: Number(l.tva_rate) as TvaRate,
          line_ht: Number(l.line_ht),
          line_ttc: Number(l.line_ttc),
        })))
      }
    } else {
      setInvoiceNumber(nextInvoiceNumber((lastInv as any)?.number, prefix))
      const preId     = searchParams.get('client_id')
      const prefillRaw = searchParams.get('prefill')

      if (preId && cls) {
        const pre = (cls as ComboClient[]).find(c => c.id === preId)
        if (pre) setSelectedClient(pre)
      }

      // Pre-fill from AI action edit (AIChatPanel passes ?prefill=<JSON>)
      if (prefillRaw) {
        try {
          const pf = JSON.parse(prefillRaw)
          if (pf.invoice_date) setInvoiceDate(pf.invoice_date)
          if (pf.notes)        setNotes(pf.notes)
          if (Array.isArray(pf.lines) && pf.lines.length > 0) {
            setLines(pf.lines.map((l: any) => ({
              id:          crypto.randomUUID(),
              description: l.description ?? '',
              quantity:    Number(l.quantity)   || 1,
              unit_price:  Number(l.unit_price) || 0,
              tva_rate:    ([0, 7, 13, 19].includes(Number(l.tva_rate)) ? Number(l.tva_rate) : 19) as TvaRate,
              line_ht:     Number(l.quantity) * Number(l.unit_price),
              line_ttc:    Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tva_rate) / 100),
            })))
          }
          // Try to match client by name
          if (pf.client_name && cls) {
            const match = (cls as ComboClient[]).find(
              c => c.name.toLowerCase() === String(pf.client_name).toLowerCase()
            )
            if (match) setSelectedClient(match)
          }
        } catch {
          // ignore malformed prefill
        }
      }
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

  // Duplicate detection: check same client + same date + amount within 5 TND
  useEffect(() => {
    if (!selectedClient || !invoiceDate || savedId || duplicateDismissed) {
      setDuplicateWarning(null)
      return
    }
    const ttc = totals.total_ttc
    if (ttc <= 0) return
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, number, ttc_amount')
        .eq('company_id', activeCompany!.id)
        .eq('client_id', selectedClient.id)
        .eq('issue_date', invoiceDate)
        .neq('status', 'draft')
        .limit(5)
      const match = (data ?? []).find((inv: any) =>
        Math.abs(Number(inv.ttc_amount) - ttc) < 5
      ) as { id: string; number: string } | undefined
      setDuplicateWarning(match ?? null)
    }, 800)
    return () => clearTimeout(timer)
  }, [selectedClient?.id, invoiceDate, totals.total_ttc, savedId, duplicateDismissed, supabase, activeCompany])

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

  const buildAndSave = useCallback(async function buildAndSaveInner(status: string): Promise<string | null> {
    if (!activeCompany?.id) return null

    // ── EDIT path: invoice already exists, update in-place ──
    if (savedId) {
      const updatePayload = {
        client_id:      selectedClient?.id ?? null,
        issue_date:     invoiceDate,
        due_date:       dueDate || null,
        notes:          notes || null,
        status,
        ht_amount:      totals.total_ht,
        tva_amount:     totals.total_tva,
        stamp_amount:   totals.stamp_duty,
        ttc_amount:     totals.total_ttc,
        total_in_words: amountToWords(totals.total_ttc),
      }
      await supabase.from('invoices').update(updatePayload).eq('id', savedId)
      await supabase.from('invoice_line_items').delete().eq('invoice_id', savedId)
      const { error: lineErr } = await supabase.from('invoice_line_items').insert(
        lines.map((l, idx) => ({
          invoice_id: savedId, sort_order: idx,
          description: l.description,
          quantity:    Number(l.quantity),
          unit_price:  Number(l.unit_price),
          tva_rate:    Number(l.tva_rate),
        }))
      )
      if (lineErr) { showToast(`Erreur lignes: ${lineErr.message}`, 'error'); return null }
      return savedId
    }

    // ── CREATE path: go through /api/invoices (enforces quota + atomic counter) ──
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:    selectedClient?.id ?? null,
        invoice_date: invoiceDate,
        due_date:     dueDate || null,
        notes:        notes || null,
        status,
        source:       'manual',
        currency,
        exchange_rate: parseFloat(exchangeRate) || 1,
        lines: lines.map((l, idx) => ({
          sort_order:  idx,
          description: l.description,
          quantity:    Number(l.quantity),
          unit_price:  Number(l.unit_price),
          tva_rate:    Number(l.tva_rate),
        })),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error ?? 'Erreur lors de la sauvegarde', 'error')
      return null
    }
    const newId = data.invoice?.id ?? null
    if (newId) setSavedId(newId)
    return newId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id, savedId, invoiceDate, dueDate, notes, lines, selectedClient, totals])

  useEffect(() => { buildAndSaveRef.current = buildAndSave }, [buildAndSave])

  async function handleSaveDraft() {
    const e = validate(false)
    if (e.length > 0) { setValidationErrors(e); return }
    setSaving(true); setValidationErrors([])
    const id = await buildAndSave('draft')
    setLastSaved(new Date()); setSaving(false)
    if (id) { showToast('Brouillon sauvegardé'); router.push(`/dashboard/invoices/${id}`) }
  }

  async function handleFinalise() {
    const e = validate(false)
    if (e.length > 0) { setValidationErrors(e); return }
    setSaving(true); setValidationErrors([])
    const id = await buildAndSave('validated')
    setLastSaved(new Date()); setSaving(false)
    if (id) { showToast('Facture finalisée — prête à soumettre à TTN'); router.push(`/dashboard/invoices/${id}`) }
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

  // Auto-save — uses ref so it always calls the latest buildAndSave
  useEffect(() => {
    const hasContent = lines.some(l => l.description.trim())
    if (!hasContent) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      if (!activeCompany?.id) return
      await buildAndSaveRef.current?.('draft')
      setLastSaved(new Date())
    }, 30000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [lines, selectedClient, invoiceDate, dueDate, notes, activeCompany?.id])

  const sigStatus = hasMandate ? 'mandate' : hasCert ? 'cert' : 'none'

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-[#1a1b22] rounded w-40" />
          <div className="flex gap-2">
            <div className="h-9 bg-[#1a1b22] rounded-xl w-28" />
            <div className="h-9 bg-[#1a1b22] rounded-xl w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
              <div className="h-4 bg-[#1a1b22] rounded w-24" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 bg-[#1a1b22] rounded w-20" />
                    <div className="h-9 bg-[#1a1b22] rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-[#1a1b22] rounded w-32" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-9 bg-[#1a1b22] rounded-xl flex-1" />
                  <div className="h-9 bg-[#1a1b22] rounded-xl w-20" />
                  <div className="h-9 bg-[#1a1b22] rounded-xl w-24" />
                  <div className="h-9 bg-[#1a1b22] rounded-xl w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-[#1a1b22] rounded w-20" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 bg-[#1a1b22] rounded w-24" />
                  <div className="h-3 bg-[#1a1b22] rounded w-16" />
                </div>
              ))}
              <div className="h-px bg-[#1a1b22]" />
              <div className="flex justify-between">
                <div className="h-4 bg-[#1a1b22] rounded w-16" />
                <div className="h-4 bg-[#1a1b22] rounded w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No active company
  if (!activeCompany?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center">
          <AlertTriangle size={28} className="text-yellow-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white mb-2">Aucune entreprise sélectionnée</h2>
          <p className="text-sm text-gray-400 max-w-sm">
            Vous devez avoir une entreprise active pour créer des factures.
          </p>
          <Link href="/dashboard/settings" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-lg transition-colors">
            Paramètres
          </Link>
        </div>
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

      <InvoiceScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirm={handleScanConfirm}
      />

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <div className="flex items-center gap-3 flex-wrap">
          {lastSaved && (
            <span className="text-[10px] text-gray-600">
              Sauvegarde {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 bg-[#1a1d24] border border-[#252830] hover:border-[#d4a843]/50 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
          >
            <ScanLine size={13} />
            Scanner
          </button>
        </div>
      </div>

      {submitSuccess && <ConfettiCelebration />}

      {/* AI Draft Invoice */}
      <AIDraftInvoice onApply={applyDraft} />

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

      {/* Duplicate detection warning */}
      {duplicateWarning && !duplicateDismissed && (
        <div className="flex items-center gap-3 bg-yellow-950/30 border border-yellow-900/40 rounded-xl px-4 py-3">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-yellow-400">Possible doublon détecté</p>
            <p className="text-xs text-yellow-300/70 mt-0.5">
              La facture <span className="font-mono font-bold">{duplicateWarning.number}</span> existe déjà pour ce client, cette date et un montant similaire.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href={`/dashboard/invoices/${duplicateWarning.id}`} target="_blank" rel="noreferrer"
              className="text-xs text-yellow-400 hover:text-yellow-200 underline transition-colors">
              Voir →
            </a>
            <button onClick={() => setDuplicateDismissed(true)}
              className="text-xs text-yellow-600 hover:text-yellow-400 transition-colors px-2 py-0.5 rounded-lg hover:bg-yellow-900/20">
              Ignorer
            </button>
          </div>
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
              <div>
                <label className={LC}>Devise</label>
                <select value={currency} onChange={e => setCurrency(e.target.value as 'TND' | 'EUR' | 'USD')} className={IC}>
                  <option value="TND">TND — Dinar Tunisien</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar US</option>
                </select>
              </div>
              {currency !== 'TND' && (
                <div>
                  <label className={LC}>Taux de change (1 {currency} = ? TND)</label>
                  <input type="number" step="0.000001" min="0" value={exchangeRate}
                    onChange={e => setExchangeRate(e.target.value)}
                    className={IC} placeholder="Ex: 3.350" />
                  <p className="text-[10px] text-gray-600 mt-1">Montants saisis en {currency}</p>
                </div>
              )}
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
                  suggestions={pastDescriptions}
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
                  <Link href="/dashboard/settings?tab=signature"
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

              <button type="button" onClick={handleFinalise} disabled={saving || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#d4a843]/40 bg-[#d4a843]/10 text-sm text-[#d4a843] hover:bg-[#d4a843]/20 transition-colors disabled:opacity-50">
                <Save size={15} />
                {saving ? 'Enregistrement...' : 'Finaliser la facture'}
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
              <Link href="/dashboard/settings?tab=signature" onClick={() => setShowSigWarning(false)}
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
