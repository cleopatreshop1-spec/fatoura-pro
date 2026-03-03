'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, ExternalLink, AlertTriangle, Edit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { InvoiceAction } from '@/lib/ai/action-parser'

interface InvoiceActionCardProps {
  action: InvoiceAction
  onSuccess: (invoiceId: string, invoiceNumber: string) => void
  onEdit: () => void
}

type CardState = 'pending' | 'creating' | 'success' | 'error'

export function InvoiceActionCard({ action, onSuccess, onEdit }: InvoiceActionCardProps) {
  const [cardState, setCardState] = useState<CardState>('pending')
  const [error, setError]         = useState<string | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<{ id: string; number: string } | null>(null)
  const [clientNameInput, setClientNameInput] = useState(action.data.client_name ?? '')
  const router = useRouter()

  const { data } = action
  // Use the locally-edited client name (may have been filled in by user)
  const resolvedClientName = clientNameInput.trim() || null

  const totalHt  = data.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const totalTva = data.lines.reduce((sum, l) => sum + l.quantity * l.unit_price * l.tva_rate / 100, 0)
  const totalTtc = totalHt + totalTva + 0.600

  const handleCreate = async () => {
    setCardState('creating')
    setError(null)

    const payload = {
      client_name:      resolvedClientName,
      client_matricule: data.client_matricule,
      invoice_date:     data.invoice_date,
      notes:            data.notes,
      source:           'ai',
      lines: data.lines.map((l, i) => ({
        sort_order:  i,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tva_rate:    l.tva_rate,
      })),
    }

    console.log('[AI Invoice] Step 1 — Payload built:', payload)

    try {
      console.log('[AI Invoice] Step 2 — Calling POST /api/invoices...')
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[AI Invoice] Step 3 — HTTP status:', response.status)
      const result = await response.json()
      console.log('[AI Invoice] Step 4 — Response body:', result)

      if (!response.ok) {
        throw new Error(result.error || `Erreur HTTP ${response.status}`)
      }

      const inv = result.invoice
      if (!inv?.id) throw new Error('Réponse invalide: invoice manquante dans la réponse')

      console.log('[AI Invoice] Step 5 — Invoice saved ✓ id:', inv.id, 'number:', inv.number)
      setCreatedInvoice({ id: inv.id, number: inv.number })
      setCardState('success')
      onSuccess(inv.id, inv.number)

    } catch (err) {
      console.error('[AI Invoice] FAILED:', err)
      setError((err as Error).message)
      setCardState('error')
    }
  }

  if (cardState === 'pending') {
    return (
      <div className="mt-2 bg-[#161b27] border border-[#d4a843]/30 rounded-xl overflow-hidden w-full max-w-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-sm">📄</span>
          <span className="text-[#e8eaf0] text-sm font-semibold">Nouvelle facture</span>
          {data.confidence < 80 && (
            <span className="ml-auto flex items-center gap-1 text-[#fbbf24] text-xs">
              <AlertTriangle size={12} />
              Vérifiez
            </span>
          )}
        </div>

        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[#6b7280] shrink-0">Client</span>
            {data.client_name ? (
              <span className="text-[#e8eaf0] font-medium text-right">{data.client_name}</span>
            ) : (
              <input
                value={clientNameInput}
                onChange={e => setClientNameInput(e.target.value)}
                placeholder="Entrez le nom du client…"
                className="flex-1 bg-[#0f1118] border border-[#e05a5a]/60 focus:border-[#d4a843] rounded-lg px-2 py-1 text-xs text-white outline-none text-right placeholder-gray-600 transition-colors"
              />
            )}
          </div>

          <div className="border-t border-white/5 pt-2 space-y-1">
            {data.lines.map((line, i) => (
              <div key={i} className="flex justify-between items-start gap-2">
                <span className="text-[#6b7280] text-xs flex-1 leading-tight">
                  {line.description}
                  {line.quantity !== 1 && <span className="text-[#6b7280]"> ×{line.quantity}</span>}
                </span>
                <span className="text-[#e8eaf0] text-xs font-mono flex-shrink-0">
                  {(line.quantity * line.unit_price).toFixed(3)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#6b7280]">TVA</span>
              <span className="text-[#e8eaf0] font-mono">{totalTva.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6b7280]">Timbre</span>
              <span className="text-[#e8eaf0] font-mono">0,600 TND</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-[#6b7280] text-xs">TOTAL TTC</span>
              <span className="text-[#d4a843] font-mono">{totalTtc.toFixed(3)} TND</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-white/5">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1118] border border-white/7 text-[#6b7280] rounded-[8px] text-xs hover:text-white hover:border-white/20 transition-colors"
          >
            <Edit2 size={12} />
            Modifier
          </button>
          <button
            onClick={handleCreate}
            disabled={!resolvedClientName}
            title={!resolvedClientName ? 'Entrez le nom du client avant de créer' : undefined}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#d4a843] text-black font-bold rounded-[8px] text-xs hover:bg-[#f0c060] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✓ Créer la facture
          </button>
        </div>
      </div>
    )
  }

  if (cardState === 'creating') {
    return (
      <div className="mt-2 bg-[#161b27] border border-[#d4a843]/30 rounded-xl px-4 py-4 flex items-center gap-3 w-full max-w-sm">
        <Loader2 size={18} className="animate-spin text-[#d4a843]" />
        <span className="text-[#e8eaf0] text-sm">Création en cours...</span>
      </div>
    )
  }

  if (cardState === 'success' && createdInvoice) {
    return (
      <div className="mt-2 bg-[#2dd4a0]/10 border border-[#2dd4a0]/30 rounded-xl overflow-hidden w-full max-w-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-[#2dd4a0]" />
            <span className="text-[#2dd4a0] text-sm font-semibold">Facture créée ✓</span>
          </div>
          <p className="text-[#6b7280] text-xs">{createdInvoice.number} — Brouillon enregistré</p>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => router.push(`/dashboard/invoices/${createdInvoice.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#2dd4a0] text-black font-bold rounded-[8px] text-xs hover:bg-[#2dd4a0]/90 transition-colors"
          >
            <ExternalLink size={12} />
            Voir et soumettre TTN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 bg-[#e05a5a]/10 border border-[#e05a5a]/30 rounded-xl px-4 py-3 w-full max-w-sm">
      <p className="text-[#e05a5a] text-sm font-medium">Erreur lors de la création</p>
      <p className="text-[#6b7280] text-xs mt-1">{error}</p>
      <button
        onClick={() => setCardState('pending')}
        className="mt-2 text-xs text-[#d4a843] hover:underline"
      >
        Réessayer →
      </button>
    </div>
  )
}
