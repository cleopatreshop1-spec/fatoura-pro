'use client'

import { useState } from 'react'
import { ChevronDown, Building2, Check, UserPlus } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import Link from 'next/link'

export function FiduciaireSwitcher() {
  const { ownCompany, allCompanies, activeCompany, isGuestView, isFiduciaire, switchCompany, exitGuestView } = useCompany()
  const [open, setOpen] = useState(false)

  if (!isFiduciaire && allCompanies.length <= 1) return null

  const clientCompanies = allCompanies.filter(c => c.id !== ownCompany?.id)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
          isGuestView
            ? 'bg-[#d4a843]/10 border-[#d4a843]/40 text-[#d4a843]'
            : 'bg-[#161b27] border-[#252830] text-gray-300 hover:text-white hover:border-[#3a3d4a]'
        }`}
      >
        <Building2 size={12} className="shrink-0" />
        <span className="max-w-[120px] truncate">
          {isGuestView ? activeCompany?.name ?? 'Client' : ownCompany?.name ?? 'Mon cabinet'}
        </span>
        <ChevronDown size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-64 bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

            {/* Own company */}
            <div className="px-3 py-2 border-b border-[#1a1b22]">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 px-1">Mon cabinet</div>
              <button
                onClick={() => { exitGuestView(); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left text-sm transition-colors ${
                  !isGuestView ? 'bg-[#d4a843]/10 text-[#d4a843]' : 'text-gray-300 hover:bg-[#161b27] hover:text-white'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-[#d4a843]/20 border border-[#d4a843]/30 flex items-center justify-center text-[10px] font-black text-[#d4a843] shrink-0">
                  {(ownCompany?.name?.[0] ?? 'C').toUpperCase()}
                </div>
                <span className="truncate flex-1">{ownCompany?.name ?? 'Mon cabinet'}</span>
                {!isGuestView && <Check size={12} className="shrink-0" />}
              </button>
            </div>

            {/* Client PMEs */}
            {clientCompanies.length > 0 && (
              <div className="px-3 py-2 border-b border-[#1a1b22] max-h-60 overflow-y-auto">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 px-1">Clients PME</div>
                {clientCompanies.map(co => (
                  <button
                    key={co.id}
                    onClick={() => { switchCompany(co.id); setOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left text-sm transition-colors ${
                      activeCompany?.id === co.id ? 'bg-[#d4a843]/10 text-[#d4a843]' : 'text-gray-300 hover:bg-[#161b27] hover:text-white'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#4a9eff]/15 border border-[#4a9eff]/20 flex items-center justify-center text-[10px] font-bold text-[#4a9eff] shrink-0">
                      {(co.name?.[0] ?? 'P').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs">{co.name}</div>
                      {(co as any).matricule_fiscal && (
                        <div className="text-[10px] text-gray-600 font-mono truncate">{(co as any).matricule_fiscal}</div>
                      )}
                    </div>
                    {activeCompany?.id === co.id && <Check size={12} className="shrink-0 text-[#d4a843]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Invite client */}
            {isFiduciaire && (
              <div className="px-3 py-2">
                <Link href="/dashboard/accountant" onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-[#161b27] transition-colors">
                  <UserPlus size={13} />
                  Gérer le portefeuille
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
