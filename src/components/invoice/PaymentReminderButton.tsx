'use client'

import { useState } from 'react'
import { Mail, Loader2, Copy, Check, X, MessageCircle, Send } from 'lucide-react'

interface Props {
  invoiceId:    string
  invoiceNumber: string
  clientName:   string
  clientEmail?: string | null
  clientPhone?: string | null
  shareToken?:  string | null
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

export function PaymentReminderButton({ invoiceId, invoiceNumber, clientName, clientEmail, clientPhone, shareToken, amount, dueDate, daysOverdue = 0 }: Props) {
  const [open, setOpen]       = useState(false)
  const [tone, setTone]       = useState('professional')
  const [lang, setLang]       = useState('fr')
  const [loading, setLoading] = useState(false)
  const [letter, setLetter]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const fmtTND = (n: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

  const shareUrl = shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${shareToken}`
    : null

  function buildQuickMessage() {
    const overdueStr = daysOverdue > 0 ? ` (${daysOverdue} jours de retard)` : dueDate ? ` (échéance : ${new Date(dueDate).toLocaleDateString('fr-FR')})` : ''
    const linkStr = shareUrl ? `\n\nLien de la facture : ${shareUrl}` : ''
    return `Bonjour ${clientName},\n\nNous vous rappelons que la facture ${invoiceNumber} d'un montant de ${fmtTND(amount)} TND est en attente de règlement${overdueStr}.${linkStr}\n\nMerci de votre prompte attention.`
  }

  function sendWhatsApp() {
    const msg = letter ?? buildQuickMessage()
    const phone = clientPhone?.replace(/\D/g, '') ?? ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function sendEmail() {
    const body = letter ?? buildQuickMessage()
    const subject = `Rappel de paiement — Facture ${invoiceNumber}`
    const mailto = clientEmail
      ? `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto)
  }

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

              {/* Quick send row — always visible */}
              <div className="flex gap-2">
                <button
                  onClick={sendWhatsApp}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={sendEmail}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#4a9eff]/10 hover:bg-[#4a9eff]/20 border border-[#4a9eff]/25 text-[#4a9eff] text-xs font-semibold transition-colors"
                >
                  <Send size={12} />
                  Email
                </button>
              </div>

              {/* AI letter section */}
              <div className="border-t border-[#1a1b22] pt-3">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">✦ Lettre IA personnalisée</p>

              {/* Generate button */}
              {!letter && (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843]/15 hover:bg-[#d4a843]/25 border border-[#d4a843]/30 text-[#d4a843] text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />Génération en cours...</>
                    : <><Mail size={14} />Générer avec l&apos;IA</>}
                </button>
              )}

              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

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
                    rows={8}
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-xs text-gray-300 font-mono outline-none resize-none leading-relaxed"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={sendWhatsApp}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Envoyer via WhatsApp
                    </button>
                    <button onClick={sendEmail}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#4a9eff]/10 hover:bg-[#4a9eff]/20 border border-[#4a9eff]/25 text-[#4a9eff] text-xs font-semibold transition-colors">
                      <Send size={11} />
                      Envoyer par Email
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
