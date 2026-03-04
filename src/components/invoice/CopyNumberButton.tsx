'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyNumberButton({ number }: { number: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copier le numéro de facture"
      className="p-1 rounded-lg text-gray-600 hover:text-[#d4a843] hover:bg-[#d4a843]/10 transition-colors print:hidden"
    >
      {copied ? <Check size={12} className="text-[#2dd4a0]" /> : <Copy size={12} />}
    </button>
  )
}
