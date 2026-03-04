'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'

const SHORTCUTS = [
  { keys: ['⌘', 'K'],   label: 'Palette',     action: 'palette' },
  { keys: ['⌘', 'N'],   label: 'Nouvelle facture', action: 'new-invoice' },
  { keys: ['⌘', '/'],   label: 'Rechercher',   action: 'search' },
]

export function KeyboardShortcutsBar() {
  const router   = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey

      // ⌘N → new invoice (unless already on new page or in an input)
      if (meta && e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        router.push('/dashboard/invoices/new')
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  // Only show on desktop, after first interaction
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="hidden xl:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-30 items-center gap-4 px-4 py-2 bg-[#0f1118]/90 backdrop-blur-md border border-[#1a1b22] rounded-full shadow-xl">
      {SHORTCUTS.map(s => (
        <div key={s.action} className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {s.keys.map(k => (
              <kbd key={k} className="px-1.5 py-0.5 bg-[#161b27] border border-[#252830] rounded text-[10px] font-mono text-gray-500">{k}</kbd>
            ))}
          </div>
          <span className="text-[10px] text-gray-600">{s.label}</span>
        </div>
      ))}
      <button
        onClick={() => setVisible(false)}
        className="ml-1 text-gray-700 hover:text-gray-500 text-[10px] transition-colors"
        title="Masquer"
      >
        ✕
      </button>
    </div>
  )
}
