'use client'

import { useState } from 'react'
import { FileDown, Mail } from 'lucide-react'

interface Props {
  clientId: string
  clientName: string
  clientEmail?: string | null
}

export function ClientStatementButton({ clientId, clientName, clientEmail }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)

  async function download() {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/statement`)
      if (!res.ok) { alert('Erreur génération relevé'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `releve_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  async function sendEmail() {
    const email = clientEmail || window.prompt(`Email du client ${clientName} :`)
    if (!email) return
    setSending(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/statement/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clientName }),
      })
      if (res.ok) { setSent(true); setTimeout(() => setSent(false), 3000) }
      else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erreur envoi email') }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={download}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1a1b22] text-xs text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors disabled:opacity-50"
        title="Télécharger le relevé de compte PDF"
      >
        {loading
          ? <div className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          : <FileDown size={12} />}
        Relevé PDF
      </button>
      <button
        onClick={sendEmail}
        disabled={sending}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors disabled:opacity-50 ${
          sent
            ? 'border-[#2dd4a0]/40 text-[#2dd4a0] bg-[#2dd4a0]/10'
            : 'border-[#1a1b22] text-gray-400 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30'
        }`}
        title={clientEmail ? `Envoyer à ${clientEmail}` : 'Envoyer par email'}
      >
        {sending
          ? <div className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          : <Mail size={12} />}
        {sent ? 'Envoyé ✓' : 'Email'}
      </button>
    </div>
  )
}
