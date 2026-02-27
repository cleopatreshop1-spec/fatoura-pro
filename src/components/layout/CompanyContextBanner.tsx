'use client'

import { useCompany } from '@/contexts/CompanyContext'
import { ArrowLeft, Building2 } from 'lucide-react'

export function CompanyContextBanner() {
  const { isGuestView, activeCompany, ownCompany, isFiduciaire, exitGuestView } = useCompany()

  if (!isGuestView) return null

  return (
    <div className={`border-b ${isFiduciaire ? 'bg-[#d4a843]/8 border-[#d4a843]/25' : 'bg-purple-950/40 border-purple-900/40'}`}>
      <div className="px-4 md:px-8 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 size={13} className={isFiduciaire ? 'text-[#d4a843] shrink-0' : 'text-purple-400 shrink-0'} />
          <div className="min-w-0">
            <span className={`text-xs font-bold ${isFiduciaire ? 'text-[#d4a843]' : 'text-purple-300'}`}>
              Mode {isFiduciaire ? 'Fiduciaire' : 'invité'} {' '}
            </span>
            <span className={`text-xs ${isFiduciaire ? 'text-[#d4a843]/80' : 'text-purple-200'} truncate`}>
              {activeCompany?.name ?? 'Client'}
            </span>
          </div>
          {(activeCompany as any)?.matricule_fiscal && (
            <span className="hidden md:inline text-[10px] font-mono text-gray-600">
              MF: {(activeCompany as any).matricule_fiscal}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={exitGuestView}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
            isFiduciaire
              ? 'border-[#d4a843]/30 text-[#d4a843] hover:bg-[#d4a843]/10'
              : 'border-purple-800/60 text-purple-200 hover:text-white'
          }`}
        >
          <ArrowLeft size={11} />
          Retour: {ownCompany?.name ?? 'Cabinet'}
        </button>
      </div>
    </div>
  )
}
