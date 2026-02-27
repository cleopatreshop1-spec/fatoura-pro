'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User, ChevronDown } from 'lucide-react'

interface Props {
  email: string
}

export function TopHeader({ email }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b border-[#1a1b22] bg-[#0a0b0f]/95 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="text-sm font-bold text-[#d4a843] tracking-wide">
          Fatoura Pro
        </span>

        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-[#d4a843]/20 border border-[#d4a843]/40 flex items-center justify-center text-[10px] font-bold text-[#d4a843]">
              {initials}
            </span>
            <span className="hidden sm:block max-w-[140px] truncate text-xs text-gray-400">
              {email}
            </span>
            <ChevronDown size={14} className="text-gray-500" />
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-9 z-50 w-48 bg-[#111318] border border-[#252830] rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#252830]">
                  <div className="text-[10px] text-gray-500 uppercase">Connecté en tant que</div>
                  <div className="text-xs text-gray-200 truncate mt-0.5">{email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {loading ? 'Déconnexion...' : 'Se déconnecter'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
