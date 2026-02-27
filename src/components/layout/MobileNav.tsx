'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const NAV = [
  { href: '/dashboard',           label: 'Accueil',   icon: '⬛' },
  { href: '/dashboard/invoices',  label: 'Factures',  icon: '🧾' },
  { href: '/dashboard/clients',   label: 'Clients',   icon: '👥' },
  { href: '/dashboard/tva',       label: 'TVA',       icon: '📊' },
  { href: '/dashboard/settings',  label: 'Réglages',  icon: '⚙️' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0b0f] border-t border-[#1a1b22] flex">
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors',
              active ? 'text-[#d4a843]' : 'text-gray-500'
            )}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
