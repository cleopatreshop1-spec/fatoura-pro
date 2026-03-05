'use client'

import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Send, Users, ChevronRight } from 'lucide-react'

export function ReferralCard() {
  const [data, setData]         = useState<any>(null)
  const [copied, setCopied]     = useState(false)
  const [email, setEmail]       = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  useEffect(() => {
    fetch('/api/referrals')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
  }, [])

  const appUrl    = data?.appUrl ?? 'https://fatoura.pro'
  const shareUrl  = data?.code ? `${appUrl}/register?ref=${data.code}` : null
  const whatsApp  = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Essayez Fatoura Pro — la facturation TTN tunisienne la plus simple! 🇹🇳\n\nInscrivez-vous avec mon lien et obtenez 30 jours gratuits :\n${shareUrl}`)}`
    : null

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSending(true)
    await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setEmail('')
    setSending(false)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a1b22] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center">
          <Gift size={13} className="text-[#d4a843]" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Programme de parrainage</p>
          <p className="text-[10px] text-gray-500">Invitez un ami → 1 mois offert à chacun</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Amis invités</p>
              <p className="text-xl font-bold text-white">{data.activated + data.pending}</p>
            </div>
            <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Mois gagnés</p>
              <p className="text-xl font-bold text-[#d4a843]">{data.rewardMonths}</p>
            </div>
          </div>
        )}

        {/* Share link */}
        {shareUrl && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Votre lien de parrainage</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2 text-xs text-gray-400 font-mono truncate">
                {shareUrl}
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a843]/10 hover:bg-[#d4a843]/20 border border-[#d4a843]/30 text-[#d4a843] text-xs font-bold rounded-xl transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copié!' : 'Copier'}
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp share */}
        {whatsApp && (
          <a
            href={whatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-bold rounded-xl transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Partager sur WhatsApp
          </a>
        )}

        {/* Email invite */}
        <form onSubmit={sendInvite} className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Inviter par email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@entreprise.tn"
              className="flex-1 bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#d4a843]/50"
            />
            <button
              type="submit"
              disabled={sending || !email}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1b22] hover:bg-[#252830] border border-[#2a2b35] text-gray-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {sent ? <Check size={12} className="text-[#2dd4a0]" /> : sending ? '...' : <Send size={12} />}
              {sent ? 'Envoyé!' : 'Inviter'}
            </button>
          </div>
        </form>

        {/* Code display */}
        {data?.code && (
          <div className="flex items-center justify-between pt-1 border-t border-[#1a1b22]">
            <div className="flex items-center gap-2">
              <Users size={11} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">Code parrain</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#d4a843] tracking-wider">{data.code}</span>
          </div>
        )}
      </div>
    </div>
  )
}
