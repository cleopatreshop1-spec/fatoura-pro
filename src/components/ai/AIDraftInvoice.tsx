'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Wand2, X, ChevronRight } from 'lucide-react'

type DraftLine = {
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
}

type DraftResult = {
  client_id: string | null
  client_name_hint: string | null
  due_date: string | null
  notes: string
  lines: DraftLine[]
}

type Props = {
  onApply: (draft: DraftResult) => void
}

const EXAMPLES = [
  'Développement site web pour Aziz Trading, 5 jours à 400 TND/jour',
  '3 formations Excel pour Société ABC, 2h chacune à 300 TND',
  'Maintenance annuelle serveur + support technique, forfait 1800 TND',
  'Consultation comptable mensuelle pour 2 mois à 600 TND/mois',
]

export function AIDraftInvoice({ onApply }: Props) {
  const [open, setOpen]         = useState(false)
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [preview, setPreview]   = useState<DraftResult | null>(null)

  async function generate() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const res  = await fetch('/api/ai/draft-invoice', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur IA')
      setPreview(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function apply() {
    if (!preview) return
    onApply(preview)
    setOpen(false)
    setText('')
    setPreview(null)
  }

  const fmtTND = (v: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

  const totalHT = preview?.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0) ?? 0

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#d4a843]/20 to-[#f0c060]/10 hover:from-[#d4a843]/30 hover:to-[#f0c060]/20 border border-[#d4a843]/40 hover:border-[#d4a843]/70 text-[#d4a843] text-sm font-semibold rounded-xl transition-all duration-200 group"
      >
        <Wand2 size={15} className="group-hover:rotate-12 transition-transform duration-200" />
        Rédiger avec l&apos;IA
        <span className="text-[10px] bg-[#d4a843]/20 text-[#d4a843] px-1.5 py-0.5 rounded-full font-bold">NOUVEAU</span>
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-[#0f1118] to-[#0d1020] border border-[#d4a843]/30 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center">
            <Sparkles size={15} className="text-[#d4a843]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Rédiger avec l&apos;IA</h3>
            <p className="text-[10px] text-gray-500">Décrivez votre facture en français naturel</p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setPreview(null); setError(null) }}
          className="text-gray-600 hover:text-gray-300 transition-colors p-1">
          <X size={15} />
        </button>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
          placeholder="Ex: Développement application mobile pour Société X, 10 jours à 500 TND/jour avec TVA 19%..."
          rows={3}
          className="w-full bg-[#161b27] border border-[#1a1b22] focus:border-[#d4a843]/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
        />
        {/* Example chips */}
        {!text && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.slice(0, 2).map(ex => (
              <button key={ex} onClick={() => setText(ex)}
                className="text-[10px] text-gray-600 hover:text-gray-300 border border-[#1a1b22] hover:border-[#252830] px-2 py-1 rounded-lg transition-colors truncate max-w-[220px]">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={generate}
        disabled={loading || !text.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-colors"
      >
        {loading
          ? <><Loader2 size={15} className="animate-spin" />Génération en cours...</>
          : <><Wand2 size={15} />Générer la facture<span className="text-[10px] font-medium opacity-60 ml-1">⌘↵</span></>
        }
      </button>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-3 border-t border-[#1a1b22] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-300">Aperçu généré</p>
            <span className="text-[10px] text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 px-2 py-0.5 rounded-full">
              {preview.lines.length} ligne{preview.lines.length > 1 ? 's' : ''}
            </span>
          </div>

          {preview.client_name_hint && !preview.client_id && (
            <div className="flex items-center gap-2 bg-yellow-950/20 border border-yellow-800/30 rounded-xl px-3 py-2">
              <span className="text-[10px] text-yellow-400">⚠ Client « {preview.client_name_hint} » non trouvé — à sélectionner manuellement</span>
            </div>
          )}

          <div className="space-y-1.5">
            {preview.lines.map((l, i) => (
              <div key={i} className="bg-[#161b27] rounded-xl px-3 py-2.5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-200 leading-snug">{l.description}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {l.quantity} × {fmtTND(l.unit_price)} TND · TVA {l.tva_rate}%
                  </p>
                </div>
                <span className="text-xs font-mono text-[#d4a843] shrink-0">
                  {fmtTND(l.quantity * l.unit_price)} HT
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Total HT estimé</span>
            <span className="font-mono font-bold text-white">{fmtTND(totalHT)} TND</span>
          </div>

          {preview.notes && (
            <p className="text-[11px] text-gray-500 italic">Note : {preview.notes}</p>
          )}

          <button
            onClick={apply}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2dd4a0]/15 hover:bg-[#2dd4a0]/25 border border-[#2dd4a0]/30 text-[#2dd4a0] text-sm font-bold rounded-xl transition-colors"
          >
            <ChevronRight size={15} />
            Appliquer à la facture
          </button>
        </div>
      )}
    </div>
  )
}
