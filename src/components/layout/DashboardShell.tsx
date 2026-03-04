'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CompanyContextBanner } from './CompanyContextBanner'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { CommandPalette } from '@/components/shared/CommandPalette'

interface Props {
  children: React.ReactNode
  userEmail: string
  userName: string
  userInitials: string
}

export function DashboardShell({ children, userEmail, userName, userInitials }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#080a0f] overflow-hidden">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar  fixed left on desktop, slide-in drawer on mobile */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 w-60',
          'transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar
          userEmail={userEmail}
          userName={userName}
          userInitials={userInitials}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main area: offset by sidebar width on desktop */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-60">
        <Header
          userEmail={userEmail}
          userName={userName}
          userInitials={userInitials}
          onMenuToggle={() => setMobileOpen(o => !o)}
        />

        <TrialBanner />
        <CompanyContextBanner />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
