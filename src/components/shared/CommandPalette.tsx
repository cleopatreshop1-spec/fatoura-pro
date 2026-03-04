'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Plus, Users, Calculator, Settings, LayoutDashboard,
  RefreshCw, Zap, Search, ArrowRight, Clock, Star,
} from 'lucide-react'

type CommandItem = {
  id: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
  group: string
  pinned?: boolean
}

const GROUPS = ['Navigation', 'Actions', 'Récent', 'Paramètres']

const GROUP_COLORS: Record<string, string> = {
  Navigation:   'text-blue-400',
  Actions:      'text-[#d4a843]',
  Récent:       'text-purple-400',
  Paramètres:   'text-gray-400',
}

export function CommandPalette() {
  const router  = useRouter()
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  const go = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }, [router])

  const COMMANDS: CommandItem[] = [
    // Navigation
    { id: 'dash',      group: 'Navigation', label: 'Tableau de bord',     icon: <LayoutDashboard size={15} />, action: () => go('/dashboard'),           keywords: ['dashboard','accueil','home'] },
    { id: 'invoices',  group: 'Navigation', label: 'Factures',             icon: <FileText size={15} />,        action: () => go('/dashboard/invoices'),  keywords: ['factures','liste'] },
    { id: 'clients',   group: 'Navigation', label: 'Clients',              icon: <Users size={15} />,           action: () => go('/dashboard/clients'),   keywords: ['clients','entreprises'] },
    { id: 'tva',       group: 'Navigation', label: 'TVA & Déclarations',   icon: <Calculator size={15} />,     action: () => go('/dashboard/tva'),       keywords: ['tva','declarations','fiscal'] },
    { id: 'recurring', group: 'Navigation', label: 'Factures récurrentes', icon: <RefreshCw size={15} />,       action: () => go('/dashboard/recurring'), keywords: ['recurrentes','abonnement'] },
    { id: 'financing', group: 'Navigation', label: 'Flash Financing',      icon: <Zap size={15} />,             action: () => go('/dashboard/financing'), keywords: ['financement','credit'] },
    // Actions
    { id: 'new-inv',   group: 'Actions',    label: 'Nouvelle facture',     sublabel: 'Créer une facture maintenant', icon: <Plus size={15} />, action: () => go('/dashboard/invoices/new'), keywords: ['nouvelle','creer','create','facture'], pinned: true },
    { id: 'new-client',group: 'Actions',    label: 'Nouveau client',       sublabel: 'Ajouter un client',            icon: <Plus size={15} />, action: () => go('/dashboard/clients?new=1'),  keywords: ['nouveau','client','ajouter'] },
    // Settings
    { id: 'settings',  group: 'Paramètres', label: 'Paramètres',           sublabel: 'Profil & compte',              icon: <Settings size={15} />, action: () => go('/dashboard/settings'),     keywords: ['parametres','settings','profil'] },
    { id: 'settings-notif', group: 'Paramètres', label: 'Notifications',   sublabel: 'Gérer les notifications',      icon: <Settings size={15} />, action: () => go('/dashboard/settings?tab=notifications'), keywords: ['notifications','emails'] },
    { id: 'settings-api',   group: 'Paramètres', label: 'Clés API',        sublabel: 'Accès développeur',            icon: <Settings size={15} />, action: () => go('/dashboard/settings?tab=api'),           keywords: ['api','cles','developer'] },
  ]

  const filtered = query.trim() === ''
    ? COMMANDS.filter(c => c.pinned || c.group === 'Navigation')
    : COMMANDS.filter(c => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          (c.sublabel ?? '').toLowerCase().includes(q) ||
          c.keywords.some(k => k.includes(q))
        )
      })

  // Group the filtered results
  const grouped = GROUPS.reduce<Record<string, CommandItem[]>>((acc, g) => {
    const items = filtered.filter(c => c.group === g)
    if (items.length) acc[g] = items
    return acc
  }, {})

  const flat = Object.values(grouped).flat()

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
      }
      if (!open) return
      if (e.key === 'Escape')    { setOpen(false); setQuery('') }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
      if (e.key === 'Enter' && flat[active]) { flat[active].action() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flat, active])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) { setOpen(false); setQuery('') } }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 bg-[#0d0f17] border border-[#252830] rounded-2xl shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1a1b22]">
          <Search size={16} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher ou taper une commande..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-[#1a1b22] border border-[#252830] rounded text-[10px] text-gray-600 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              Aucun résultat pour &ldquo;{query}&rdquo;
            </div>
          ) : (
            (() => {
              let globalIdx = 0
              return Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-4 py-1.5 flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${GROUP_COLORS[group] ?? 'text-gray-600'}`}>
                      {group}
                    </span>
                  </div>
                  {items.map(item => {
                    const idx = globalIdx++
                    const isActive = active === idx
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => item.action()}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-[#d4a843]/10 text-white' : 'text-gray-400 hover:bg-[#161b27]'
                        }`}
                      >
                        <span className={`shrink-0 ${isActive ? 'text-[#d4a843]' : 'text-gray-600'}`}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {item.label}
                          </span>
                          {item.sublabel && (
                            <span className="text-xs text-gray-600 ml-2">{item.sublabel}</span>
                          )}
                        </div>
                        {isActive && <ArrowRight size={13} className="text-[#d4a843] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              ))
            })()
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[#1a1b22] flex items-center gap-4 text-[10px] text-gray-700">
          <span className="flex items-center gap-1"><kbd className="font-mono bg-[#1a1b22] px-1 rounded">↑↓</kbd> naviguer</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-[#1a1b22] px-1 rounded">↵</kbd> ouvrir</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-[#1a1b22] px-1 rounded">Esc</kbd> fermer</span>
          <span className="ml-auto flex items-center gap-1"><kbd className="font-mono bg-[#1a1b22] px-1 rounded">⌘K</kbd> ouvrir</span>
        </div>
      </div>
    </div>
  )
}
