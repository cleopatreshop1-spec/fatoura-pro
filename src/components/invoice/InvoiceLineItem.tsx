'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { fmtTND } from '@/lib/utils/tva-calculator'

export type TvaRate = 0 | 7 | 13 | 19

export type InvLine = {
  id: string
  description: string
  quantity: number
  unit_price: number
  tva_rate: TvaRate
  line_ht: number
  line_ttc: number
  category?: string
}

interface Props {
  line: InvLine
  index: number
  isOnly: boolean
  onChange: (id: string, field: keyof InvLine, value: any) => void
  onRemove: (id: string) => void
}

const TVA_OPTIONS: { value: TvaRate; label: string }[] = [
  { value: 19, label: '19%  Normal' },
  { value: 13, label: '13%  Reduit (services)' },
  { value: 7,  label: '7%   Reduit special' },
  { value: 0,  label: '0%   Exonere' },
]

const NI = 'bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-[#d4a843] transition-colors font-mono w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'
const TI = 'bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-[#d4a843] transition-colors w-full'

export function InvoiceLineItem({ line, index, isOnly, onChange, onRemove }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)

  const handleAISuggest = async () => {
    const keyword = line.description.trim()
    if (!keyword) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/suggest-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur IA')
      if (data.description) onChange(line.id, 'description', data.description)
      if (data.unit_price)  onChange(line.id, 'unit_price',  data.unit_price)
      if (data.tva_rate != null) onChange(line.id, 'tva_rate', data.tva_rate)
      if (data.category)    onChange(line.id, 'category',   data.category)
    } catch (e: any) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const showAiBtn = line.description.trim().length >= 3

  return (
    <div className="border-b border-[#1a1b22] last:border-0 py-3 space-y-1.5">
      <div className="grid gap-2 items-start"
        style={{ gridTemplateColumns: '1fr 80px 100px 130px 90px 90px 28px' }}>

      {/* Description + AI button */}
      <div className="relative">
        <input
          value={line.description}
          onChange={e => onChange(line.id, 'description', e.target.value)}
          placeholder="Prestation de service, produit..."
          className={`${TI} ${showAiBtn ? 'pr-8' : ''}`}
        />
        {showAiBtn && (
          <button
            type="button"
            onClick={handleAISuggest}
            disabled={aiLoading}
            title="Générer description et prix avec l'IA"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#d4a843] hover:text-[#f0c060] disabled:opacity-40 transition-colors"
          >
            {aiLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Sparkles size={13} />}
          </button>
        )}
      </div>

      {/* Quantity */}
      <input
        type="number" min="0.001" step="0.001"
        value={line.quantity === 0 ? '' : line.quantity}
        onChange={e => onChange(line.id, 'quantity', parseFloat(e.target.value) || 0)}
        placeholder="1"
        className={NI}
      />

      {/* Unit price */}
      <div className="relative">
        <input
          type="number" min="0" step="0.001"
          value={line.unit_price === 0 ? '' : line.unit_price}
          onChange={e => onChange(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
          placeholder="0.000"
          className={`${NI} pr-9`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 pointer-events-none">TND</span>
      </div>

      {/* TVA rate */}
      <select
        value={line.tva_rate}
        onChange={e => onChange(line.id, 'tva_rate', Number(e.target.value) as TvaRate)}
        className={`${TI} text-xs`}
      >
        {TVA_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* HT (read-only) */}
      <div className="bg-[#0a0b0f]/50 border border-[#1a1b22]/50 rounded-lg px-2.5 py-2 text-xs font-mono text-gray-500 text-right">
        {fmtTND(line.line_ht)}
      </div>

      {/* TTC (read-only) */}
      <div className="bg-[#0a0b0f]/50 border border-[#1a1b22]/50 rounded-lg px-2.5 py-2 text-xs font-mono text-gray-300 text-right font-bold">
        {fmtTND(line.line_ttc)}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(line.id)}
        disabled={isOnly}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed mt-0.5"
        title="Supprimer la ligne"
      >
        ✕
      </button>
      </div>

      {/* Category badge + AI error */}
      <div className="flex items-center gap-2 px-0.5">
        {line.category && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-[#252830] text-gray-500 bg-[#161b27] uppercase tracking-wide">
            {line.category}
          </span>
        )}
        {aiError && <p className="text-[10px] text-red-400">{aiError}</p>}
      </div>
    </div>
  )
}
