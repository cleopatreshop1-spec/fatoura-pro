'use client'

import { useState } from 'react'
import { Languages, Loader2, Copy, Check } from 'lucide-react'

interface Props {
  invoiceData: Record<string, unknown>
}

const LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇹🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

export function InvoiceTranslator({ invoiceData }: Props) {
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<Record<string, unknown> | null>(null)
  const [lang, setLang]         = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const handleTranslate = async (targetLanguage: string) => {
    setLang(targetLanguage)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/translate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceData, targetLanguage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur IA')
      setResult(data.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-white hover:border-[#d4a843]/40 transition-colors"
        title="Traduire la facture"
      >
        <Languages size={13} />
        Traduire
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1b22] flex items-center gap-2">
            <Languages size={13} className="text-[#d4a843]" />
            <span className="text-sm font-semibold text-white">Traduire la facture</span>
          </div>

          <div className="p-3 space-y-2">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => handleTranslate(l.code)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#161b27] border border-[#1a1b22] text-sm text-gray-300 hover:text-white hover:border-[#d4a843]/40 disabled:opacity-50 transition-colors"
              >
                <span className="text-base">{l.flag}</span>
                <span>{l.label}</span>
                {loading && lang === l.code && (
                  <Loader2 size={12} className="animate-spin ml-auto text-[#d4a843]" />
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="px-4 pb-3 text-xs text-red-400">{error}</div>
          )}

          {loading && (
            <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={11} className="animate-spin text-[#d4a843]" />
              AI en cours d&apos;analyse...
            </div>
          )}

          {result && !loading && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">✓ Traduction prête</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copied ? 'Copié !' : 'Copier JSON'}
                </button>
              </div>
              <pre className="text-[9px] text-gray-500 bg-[#161b27] border border-[#1a1b22] rounded-lg p-2 overflow-auto max-h-32 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
