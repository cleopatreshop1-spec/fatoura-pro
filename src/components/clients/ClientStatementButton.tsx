'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'

interface Props {
  clientId: string
  clientName: string
}

export function ClientStatementButton({ clientId, clientName }: Props) {
  const [loading, setLoading] = useState(false)

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

  return (
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
  )
}
