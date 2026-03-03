'use client'

import { useRef, useState } from 'react'
import { Receipt, Loader2, Check, X, Upload } from 'lucide-react'

type ScannedExpense = {
  date:     string | null
  merchant: string | null
  amount:   number
  category: string
  tva_rate:   number | null
  tva_amount: number | null
}

export function ExpenseScannerButton() {
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ScannedExpense | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [saved, setSaved]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)
    console.log('[ExpenseScanner] Scanning file:', file.name, file.type)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/ai/scan-receipt', { method: 'POST', body: fd })
      const data = await res.json()
      console.log('[ExpenseScanner] Response:', data)
      if (!res.ok) throw new Error(data.error ?? 'Erreur scan')
      setResult(data.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => { setOpen(false); setResult(null); setSaved(false) }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/40 transition-colors"
      >
        <Receipt size={13} />
        Scanner reçu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-[#d4a843]" />
                <span className="text-sm font-bold text-white">Scanner un reçu / note de frais</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#161b27] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Upload zone */}
              {!loading && !result && (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#252830] hover:border-[#d4a843]/50 rounded-2xl p-8 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center">
                    <Upload size={20} className="text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white mb-1">Glissez un reçu ici</p>
                    <p className="text-xs text-gray-500">ou cliquez pour sélectionner</p>
                    <p className="text-[10px] text-gray-600 mt-1">JPG, PNG, PDF • Max 10 MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full bg-[#d4a843]/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-[#d4a843]/30 flex items-center justify-center">
                      <Receipt size={18} className="text-[#d4a843]" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">AI en cours d&apos;analyse...</p>
                  <Loader2 size={14} className="animate-spin text-[#d4a843]" />
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-sm text-red-400">{error}</p>
                  <button onClick={() => { setError(null); fileRef.current?.click() }}
                    className="text-xs text-[#d4a843] hover:underline">Réessayer</button>
                </div>
              )}

              {/* Result */}
              {result && !loading && (
                <div className="space-y-3">
                  <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl p-4 space-y-2.5">
                    <Row label="Marchand"  value={result.merchant ?? '—'} />
                    <Row label="Date"      value={result.date ?? '—'} />
                    <Row label="Catégorie" value={result.category} highlight />
                    {result.tva_rate != null && <Row label="TVA" value={`${result.tva_rate}%${result.tva_amount ? ' — ' + result.tva_amount.toFixed(3) + ' TND' : ''}`} />}
                    <div className="border-t border-[#252830] pt-2 flex justify-between">
                      <span className="text-xs text-gray-500 font-semibold">Montant total</span>
                      <span className="text-sm font-black text-[#d4a843] font-mono">{result.amount.toFixed(3)} TND</span>
                    </div>
                  </div>

                  {saved
                    ? <div className="flex items-center gap-2 justify-center py-2 text-emerald-400 text-sm"><Check size={15} /> Enregistré !</div>
                    : <div className="flex gap-2">
                        <button onClick={() => { setResult(null); setError(null) }}
                          className="flex-1 py-2.5 rounded-xl border border-[#252830] text-sm text-gray-400 hover:text-white transition-colors">
                          Rescanner
                        </button>
                        <button onClick={handleSave}
                          className="flex-1 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors">
                          Enregistrer
                        </button>
                      </div>
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? 'text-[#d4a843]' : 'text-white'}`}>{value}</span>
    </div>
  )
}
