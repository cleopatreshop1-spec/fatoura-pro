'use client'

import { useState } from 'react'
import { Mail, Loader2, Copy, Check, X } from 'lucide-react'

interface Props {
  invoiceId:    string
  invoiceNumber: string
  clientName:   string
  amount:       number
  dueDate?:     string | null
  daysOverdue?: number
}

const TONES = [
  { value: 'professional', label: 'Professionnel' },
  { value: 'friendly',     label: 'Amical' },
  { value: 'firm',         label: 'Ferme' },
]
const LANGS = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
]

export function PaymentReminderButton({ invoiceId, invoiceNumber, clientName, amount, dueDate, daysOverdue = 0 }: Props) {
  const [open, setOpen]       = useState(false)
  const [tone, setTone]       = useState('professional')
  const [lang, setLang]       = useState('fr')
  const [loading, setLoading] = useState(false)
  const [letter, setLetter]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setLetter(null)
    try {
      const res = await fetch('/api/ai/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:       'payment_reminder',
          invoice_id: invoiceId,
          tone,
          language:   lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur IA')
      setLetter(data.letter)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!letter) return
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SL = 'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/40 transition-colors"
      >
        <Mail size={13} />
        Relance
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-[#d4a843]" />
                <span className="text-sm font-bold text-white">Rédiger une relance</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#161b27] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Invoice info */}
              <div className="flex gap-3 text-xs text-gray-500 bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5">
                <span className="text-white font-mono">{invoiceNumber}</span>
                <span>•</span>
                <span>{clientName}</span>
                <span>•</span>
                <span className="font-mono text-[#d4a843]">{amount.toFixed(3)} TND</span>
                {daysOverdue > 0 && <><span>•</span><span className="text-red-400">{daysOverdue}j de retard</span></>}
              </div>

              {/* Tone & Lang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Ton</p>
                  <div className="space-y-1">
                    {TONES.map(t => (
                      <button key={t.value} onClick={() => setTone(t.value)}
                        className={`${SL} ${tone === t.value ? 'bg-[#d4a843]/15 border border-[#d4a843]/30 text-[#d4a843]' : 'bg-[#161b27] border border-[#1a1b22] text-gray-400 hover:text-white'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Langue</p>
                  <div className="space-y-1">
                    {LANGS.map(l => (
                      <button key={l.value} onClick={() => setLang(l.value)}
                        className={`${SL} ${lang === l.value ? 'bg-[#d4a843]/15 border border-[#d4a843]/30 text-[#d4a843]' : 'bg-[#161b27] border border-[#1a1b22] text-gray-400 hover:text-white'}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate button */}
              {!letter && (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />AI en cours d&apos;analyse...</>
                    : <><Mail size={14} />Générer la relance</>}
                </button>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Result */}
              {letter && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-medium">✓ Lettre générée</span>
                    <div className="flex gap-2">
                      <button onClick={handleCopy}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-[#161b27]">
                        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                      <button onClick={() => setLetter(null)}
                        className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 rounded-lg hover:bg-[#161b27] transition-colors">
                        Regénérer
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={letter}
                    rows={10}
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-xs text-gray-300 font-mono outline-none resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
