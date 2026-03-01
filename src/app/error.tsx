'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[Error]', error) }, [error])

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950/30 border border-red-900/40 flex items-center justify-center text-3xl">⚠️</div>
        <h1 className="text-lg font-bold text-white">Une erreur est survenue</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Une erreur inattendue s&apos;est produite. Nos équipes ont été notifiées.
        </p>
        {error?.digest && (
          <p className="font-mono text-[10px] text-gray-700">Ref: {error.digest}</p>
        )}
        <div className="flex flex-col gap-3 pt-2">
          <button onClick={reset}
            className="px-6 py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            Réessayer
          </button>
          <Link href="/dashboard"
            className="px-6 py-3 border border-[#1a1b22] text-sm text-gray-400 hover:text-white rounded-xl transition-colors">
            Retour au tableau de bord
          </Link>
          <a href="mailto:support@fatoura.pro"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Contacter le support →
          </a>
        </div>
      </div>
    </div>
  )
}
