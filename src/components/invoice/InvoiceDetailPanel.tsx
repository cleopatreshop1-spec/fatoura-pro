'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Send, Trash2, AlertTriangle, CheckCircle, Clock, RefreshCw, FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { nextInvoiceNumber } from '@/lib/utils/invoice-number'
import { PaymentReminderButton } from '@/components/invoice/PaymentReminderButton'
import { InvoiceTranslator } from '@/components/invoice/InvoiceTranslator'

type InvoiceData = {
  id: string; number: string | null; status: string
  issue_date: string | null; due_date: string | null
  ttn_id: string | null; ttn_rejection_reason: string | null
  payment_status: string | null; paid_at: string | null
  created_at: string; submitted_at: string | null; validated_at: string | null
  company_id: string
  ttc_amount?: number | null
  client_name?: string | null
}

interface Props {
  invoice: InvoiceData
  companyPrefix: string
}

type PayStatus = 'unpaid' | 'partial' | 'paid'

export function InvoiceDetailPanel({ invoice: initial, companyPrefix }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [inv, setInv] = useState(initial)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [payStatus, setPayStatus] = useState<PayStatus>((initial.payment_status as PayStatus) ?? 'unpaid')
  const [savingPay, setSavingPay] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`invoice-${inv.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `id=eq.${inv.id}` },
        (payload) => {
          setInv(prev => ({ ...prev, ...(payload.new as Partial<InvoiceData>) }))
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [inv.id, supabase])

  function showToast(msg: string, type: 'ok'|'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function copyTTN() {
    if (!inv.ttn_id) return
    await navigator.clipboard.writeText(inv.ttn_id)
    showToast('TTN_ID copie !')
  }

  async function handleSubmitTTN() {
    setSubmitting(true)
    const res = await fetch('/api/invoices/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: inv.id }),
    })
    const d = await res.json()
    setSubmitting(false)
    if (res.ok) showToast('Facture soumise a TTN')
    else showToast(d.error ?? 'Erreur soumission', 'err')
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('invoices').delete().eq('id', inv.id)
    setDeleting(false); setConfirmDelete(false)
    router.push('/dashboard/invoices')
  }

  async function handleDuplicate() {
    const { data: lastInv } = await supabase.from('invoices').select('number')
      .eq('company_id', inv.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const num = nextInvoiceNumber((lastInv as any)?.number, companyPrefix)
    const { data: srcInv } = await (supabase as any).from('invoices').select('ht_amount,tva_amount,stamp_amount,ttc_amount,total_in_words,client_id,notes').eq('id', inv.id).single()
    const { data: newInv } = await (supabase as any).from('invoices').insert({
      company_id: inv.company_id, number: num, status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      client_id:      srcInv?.client_id ?? null,
      ht_amount:      srcInv?.ht_amount ?? 0,
      tva_amount:     srcInv?.tva_amount ?? 0,
      stamp_amount:   srcInv?.stamp_amount ?? 0.600,
      ttc_amount:     srcInv?.ttc_amount ?? 0,
      total_in_words: srcInv?.total_in_words ?? null,
      notes:          srcInv?.notes ?? null,
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

  async function handleDownloadPDF() {
    setDownloadingPdf(true)
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error ?? 'Erreur generation PDF', 'err'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Facture-${inv.number ?? inv.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Erreur PDF', 'err') } finally { setDownloadingPdf(false) }
  }

  async function handlePayStatus(s: PayStatus) {
    setPayStatus(s); setSavingPay(true)
    await supabase.from('invoices').update({
      payment_status: s,
      paid_at: s === 'paid' ? new Date().toISOString() : null,
    }).eq('id', inv.id)
    setSavingPay(false)
    showToast('Statut paiement mis a jour')
  }

  // Timeline events
  const timeline = [
    inv.created_at   && { label: 'Facture creee',      date: inv.created_at,   color: 'text-gray-400',  dot: 'bg-gray-500' },
    inv.submitted_at && { label: 'Soumise a TTN',       date: inv.submitted_at, color: 'text-[#4a9eff]', dot: 'bg-[#4a9eff]' },
    inv.status === 'valid'    && inv.validated_at && { label: 'Validee par TTN',  date: inv.validated_at, color: 'text-[#2dd4a0]', dot: 'bg-[#2dd4a0]' },
    inv.status === 'rejected' && inv.validated_at && { label: 'Rejetee par TTN', date: inv.validated_at, color: 'text-[#e05a5a]',  dot: 'bg-[#e05a5a]' },
  ].filter(Boolean) as { label: string; date: string; color: string; dot: string }[]

  const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-2xl border ${
          toast.type === 'ok' ? 'bg-[#0f1118] border-[#2dd4a0]/40 text-[#2dd4a0]' : 'bg-[#0f1118] border-red-500/40 text-red-400'
        }`}>{toast.msg}</div>
      )}

      {/* TTN Status Card */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
        <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Statut TTN</div>
        <div className="mb-4"><InvoiceStatusBadge status={inv.status} size="md" /></div>

        {inv.status === 'valid' && inv.ttn_id && (
          <div className="bg-[#161b27] rounded-xl px-3 py-2.5 mb-3">
            <div className="text-[10px] text-gray-600 uppercase mb-1">TTN_ID</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#d4a843] truncate flex-1">{inv.ttn_id}</span>
              <button onClick={copyTTN} className="text-gray-500 hover:text-[#d4a843] transition-colors p-1">
                <Copy size={13} />
              </button>
            </div>
          </div>
        )}

        {inv.status === 'rejected' && inv.ttn_rejection_reason && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2.5 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-[10px] font-bold text-red-400 uppercase">Raison du rejet</span>
            </div>
            <p className="text-xs text-red-300">{inv.ttn_rejection_reason}</p>
          </div>
        )}

        {inv.status === 'pending' && (
          <div className="flex items-center gap-2 text-xs text-[#4a9eff] bg-[#4a9eff]/10 border border-[#4a9eff]/20 rounded-xl px-3 py-2.5 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#4a9eff] animate-pulse" />
            Soumission en cours...
          </div>
        )}

        {inv.status === 'queued' && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#161b27] rounded-xl px-3 py-2.5 mb-3">
            <Clock size={13} />
            Nouvelle tentative programmee
          </div>
        )}

        {inv.status === 'validated' && (
          <div className="flex items-center gap-2 text-xs text-[#d4a843] bg-[#d4a843]/10 border border-[#d4a843]/20 rounded-xl px-3 py-2.5 mb-3">
            <CheckCircle size={13} />
            Facture finalisée — prête à soumettre à TTN
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Historique</div>
            {timeline.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full ${e.dot} mt-1.5 shrink-0`} />
                <div>
                  <div className={`text-xs font-medium ${e.color}`}>{e.label}</div>
                  <div className="text-[10px] text-gray-600">{fmtDate(e.date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Status */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
        <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Statut paiement</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([['unpaid','Non payee','border-[#1a1b22] text-gray-400'],['partial','Partielle','border-yellow-700/50 text-yellow-400'],['paid','Payee','border-[#2dd4a0]/50 text-[#2dd4a0]']] as [PayStatus,string,string][]).map(([s, label, cls]) => (
            <button key={s} onClick={() => handlePayStatus(s)} disabled={savingPay}
              className={`py-2 rounded-xl border text-xs font-bold transition-all ${payStatus===s ? cls + ' bg-opacity-10 ' + cls.replace('border-','bg-').replace(' text-',' bg-').split(' bg-')[0] : 'border-[#1a1b22] text-gray-600 hover:border-[#252830]'}`}>
              {label}
            </button>
          ))}
        </div>
        {payStatus === 'paid' && inv.paid_at && (
          <div className="mt-2 text-[10px] text-gray-600">
            Payee le {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-2">
        <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Actions</div>

        {['draft', 'validated'].includes(inv.status) && (
          <Link href={`/dashboard/invoices/new?edit=${inv.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#252830] bg-[#161b27] text-sm text-gray-300 hover:text-white transition-colors">
            Modifier
          </Link>
        )}

        {['draft', 'validated', 'rejected'].includes(inv.status) && (
          <button onClick={handleSubmitTTN} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors disabled:opacity-50">
            {submitting ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Soumission...</> : <><Send size={14} />Soumettre à TTN</>}
          </button>
        )}

        <button onClick={handleDownloadPDF} disabled={downloadingPdf}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#d4a843]/40 bg-[#d4a843]/5 text-sm text-[#d4a843] hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50">
          {downloadingPdf ? <><div className="w-3.5 h-3.5 border-2 border-[#d4a843]/30 border-t-[#d4a843] rounded-full animate-spin" />Generation...</> : <><FileDown size={14} />Telecharger PDF</>}
        </button>

        <button onClick={handleDuplicate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-400 hover:text-white hover:bg-[#161b27] transition-colors">
          <RefreshCw size={14} />Dupliquer
        </button>

        {/* ── AI Tools ── */}
        <div className="pt-1 border-t border-[#1a1b22]">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Outils IA</p>
          <div className="flex gap-2 flex-wrap">
            {inv.payment_status !== 'paid' && (
              <PaymentReminderButton
                invoiceId={inv.id}
                invoiceNumber={inv.number ?? ''}
                clientName={inv.client_name ?? 'Client'}
                amount={Number(inv.ttc_amount ?? 0)}
                dueDate={inv.due_date}
              />
            )}
            <InvoiceTranslator invoiceData={inv as Record<string, unknown>} />
          </div>
        </div>

        {['draft', 'validated'].includes(inv.status) && (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-900/30 text-sm text-red-400 hover:bg-red-950/20 transition-colors">
            <Trash2 size={14} />Supprimer
          </button>
        )}
      </div>

      <ConfirmDialog open={confirmDelete} title="Supprimer cette facture ?" description="Cette action est irreversible."
        confirmLabel="Supprimer" dangerous loading={deleting}
        onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
    </div>
  )
}
