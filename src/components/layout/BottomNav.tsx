'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  UserCog,
  MailOpen,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/invoices', label: 'Factures', icon: FileText },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/tva', label: 'TVA', icon: Receipt },
  { href: '/dashboard/accountant', label: 'Comptables', icon: UserCog },
  { href: '/dashboard/invitations', label: 'Invitations', icon: MailOpen },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-[#1a1b22] bg-[#0a0b0f]/95 backdrop-blur-sm z-50">
      <div className="max-w-2xl mx-auto flex items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors ${
                isActive
                  ? 'text-[#d4a843]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className="text-[9px] font-medium tracking-wide leading-none">
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-[#d4a843] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
