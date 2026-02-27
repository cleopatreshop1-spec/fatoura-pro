import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Page introuvable' }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="text-7xl font-black text-[#1a1b22] select-none">404</div>
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center text-3xl"></div>
        <h1 className="text-lg font-bold text-white">Page introuvable</h1>
        <p className="text-sm text-gray-500">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link href="/dashboard"
            className="px-6 py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors">
            Retour au tableau de bord
          </Link>
          <Link href="/"
            className="px-6 py-3 border border-[#1a1b22] text-sm text-gray-400 hover:text-white rounded-xl transition-colors">
            Page d'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
