'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Plus, LogOut, Settings, ChevronRight, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { FiduciaireSwitcher } from './FiduciaireSwitcher'
import { NotificationsDropdown } from './NotificationsDropdown'
import { createClient } from '@/lib/supabase/client'

const SEGMENTS: Record<string, string> = {
  dashboard:     'Tableau de bord',
  invoices:      'Factures',
  new:           'Nouvelle facture',
  clients:       'Clients',
  tva:           'TVA & Déclarations',
  financing:     'Flash Financing',
  settings:      'Paramètres',
  mandate:       'Signature',
  'api-keys':    'Clés API',
  notifications: 'Notifications',
  accountant:    'Comptable',
  invitations:   'Invitations',
}

function useBreadcrumb(): { label: string; href?: string }[] {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href?: string }[] = []
  let path = ''
  for (let i = 0; i < parts.length; i++) {
    path += '/' + parts[i]
    const label = SEGMENTS[parts[i]]
    if (!label) continue
    if (i === parts.length - 1) {
      crumbs.push({ label })
    } else if (i > 0) {
      crumbs.push({ label, href: path })
    }
  }
  return crumbs
}

interface Props {
  userEmail: string
  userName: string
  userInitials: string
  onMenuToggle: () => void
}

export function Header({ userEmail, userName, userInitials, onMenuToggle }: Props) {
  const router = useRouter()
  const breadcrumb = useBreadcrumb()
  const [userOpen, setUserOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 border-b border-[#1a1b22] bg-[#0f1118] z-30">

      {/*  Left: hamburger + breadcrumb  */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-[#161b27] transition-colors shrink-0"
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>

        <FiduciaireSwitcher />

        <nav className="flex items-center gap-1 text-sm min-w-0 ml-1">
          {breadcrumb.length === 0 && (
            <span className="text-gray-400 font-medium">Tableau de bord</span>
          )}
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={13} className="text-gray-700 shrink-0" />}
              {crumb.href ? (
                <Link href={crumb.href} className="text-gray-500 hover:text-gray-200 transition-colors truncate max-w-[120px] md:max-w-none">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-200 font-semibold truncate max-w-[140px] md:max-w-none">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/*  Right: actions  */}
      <div className="flex items-center gap-2 shrink-0">
        {/* ⌘K trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#161b27] border border-[#1a1b22] hover:border-[#252830] rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors group"
        >
          <Search size={12} />
          <span>Rechercher...</span>
          <kbd className="ml-1 px-1.5 py-0.5 bg-[#0f1118] border border-[#252830] rounded text-[10px] font-mono text-gray-600 group-hover:text-gray-400">⌘K</kbd>
        </button>

        <Link
          href="/dashboard/invoices/new"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} />
          Nouvelle Facture
        </Link>
        <Link
          href="/dashboard/invoices/new"
          className="sm:hidden w-9 h-9 flex items-center justify-center bg-[#d4a843] hover:bg-[#f0c060] text-black rounded-xl transition-colors"
          aria-label="Nouvelle facture"
        >
          <Plus size={16} strokeWidth={2.5} />
        </Link>

        <ThemeToggle />
        <NotificationsDropdown />

        {/* User avatar dropdown */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setUserOpen(o => !o)}
            className="w-9 h-9 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/25 flex items-center justify-center hover:bg-[#d4a843]/25 transition-colors"
            aria-label="Compte"
          >
            <span className="text-[#d4a843] text-xs font-bold">{userInitials}</span>
          </button>

          {userOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-52 bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1a1b22]">
                  {userName && <div className="text-xs font-semibold text-gray-200 truncate">{userName}</div>}
                  <div className="text-[10px] text-gray-500 truncate">{userEmail}</div>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#161b27] hover:text-white transition-colors"
                  >
                    <Settings size={14} className="text-gray-500" />
                    Paramètres
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-50"
                  >
                    <LogOut size={14} />
                    {signingOut ? 'Déconnexion...' : 'Se déconnecter'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
