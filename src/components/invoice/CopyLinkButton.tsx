'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

export function CopyLinkButton({ invoiceId }: { invoiceId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/dashboard/invoices/${invoiceId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copier le lien de cette facture"
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        copied
          ? 'border-[#2dd4a0]/40 text-[#2dd4a0] bg-[#2dd4a0]/5'
          : 'border-[#252830] text-gray-500 hover:text-white hover:border-[#3a3f4a]'
      }`}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
      {copied ? 'Copié !' : 'Copier le lien'}
    </button>
  )
}
