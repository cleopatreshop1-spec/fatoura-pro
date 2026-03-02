'use client'

import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { AIChatPanel } from './AIChatPanel'

export function FloatingAIButton() {
  const [open, setOpen]                         = useState(false)
  const [unreadCount, setUnreadCount]           = useState(0)
  const [proactiveSuggestions, setProactive]    = useState<string[]>([])

  // Fetch unread AI suggestions on mount
  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res  = await fetch('/api/ai/suggestions')
        const data = await res.json()
        if (res.ok) {
          setUnreadCount(data.count ?? 0)
          setProactive((data.suggestions ?? []).map((s: any) => s.message))
        }
      } catch { /* silent */ }
    }
    fetchSuggestions()
  }, [])

  // Clear badge when panel opens
  function handleOpen() {
    setOpen(true)
    setUnreadCount(0)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        aria-label="Ouvrir Fatoura AI"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#d4a843] hover:bg-[#f0c060] shadow-2xl shadow-[#d4a843]/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <Sparkles className="w-6 h-6 text-black" />

        {/* Pulsing badge for unread suggestions */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-[#0a0b0f] flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
            <span className="relative text-[9px] font-black text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
          />
          <AIChatPanel
            onClose={() => setOpen(false)}
            proactiveSuggestions={proactiveSuggestions}
          />
        </>
      )}
    </>
  )
}
