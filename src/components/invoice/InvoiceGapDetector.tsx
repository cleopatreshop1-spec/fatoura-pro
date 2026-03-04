'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

type Invoice = { number: string | null; status: string }

interface Props {
  invoices: Invoice[]
  prefix: string
}

function extractSeq(num: string, prefix: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = num.match(new RegExp(`^${escaped}[-/]?(\\d+)`, 'i'))
  return m ? parseInt(m[1], 10) : null
}

export function InvoiceGapDetector({ invoices, prefix }: Props) {
  const [open, setOpen] = useState(false)

  const gaps = useMemo(() => {
    const numbered = invoices
      .filter(i => i.number && i.status !== 'draft')
      .map(i => extractSeq(i.number!, prefix))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b)

    if (numbered.length < 2) return []

    const missing: number[] = []
    for (let i = 0; i < numbered.length - 1; i++) {
      for (let n = numbered[i] + 1; n < numbered[i + 1]; n++) {
        missing.push(n)
        if (missing.length >= 20) return missing
      }
    }
    return missing
  }, [invoices, prefix])

  if (gaps.length === 0) return null

  return (
    <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-yellow-950/10 transition-colors"
      >
        <AlertTriangle size={13} className="text-yellow-500 shrink-0" />
        <span className="text-xs font-semibold text-yellow-400 flex-1">
          {gaps.length} numéro{gaps.length > 1 ? 's' : ''} manquant{gaps.length > 1 ? 's' : ''} dans la séquence
        </span>
        <span className="text-xs text-yellow-700 font-mono">
          {gaps.slice(0, 3).map(n => `${prefix}-${String(n).padStart(3, '0')}`).join(', ')}
          {gaps.length > 3 ? ' ...' : ''}
        </span>
        {open ? <ChevronUp size={13} className="text-yellow-600" /> : <ChevronDown size={13} className="text-yellow-600" />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-yellow-900/20 pt-2">
          <p className="text-[10px] text-yellow-700 mb-2">
            Des numéros de factures manquants peuvent indiquer des suppressions ou des erreurs de numérotation.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {gaps.map(n => (
              <span key={n} className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-yellow-950/40 text-yellow-400 border border-yellow-900/30">
                {prefix}-{String(n).padStart(3, '0')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
