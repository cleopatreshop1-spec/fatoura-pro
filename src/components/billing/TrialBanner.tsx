'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Gift, AlertTriangle } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'

export function TrialBanner() {
  const { isTrialing, trialDaysLeft, isExpired, plan, loading } = usePlan()
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (loading || dismissed) return null
  if (!isTrialing && !isExpired) return null

  const urgent = (trialDaysLeft !== null && trialDaysLeft <= 3) || isExpired

  if (isExpired) {
    return (
      <div className="bg-red-900/40 border-b border-red-500/40 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <span className="text-red-200 font-medium">
            Votre essai gratuit est terminé — la création de factures est suspendue.
          </span>
          <button
            onClick={() => router.push('/settings/billing')}
            className="text-[#d4a843] font-bold underline underline-offset-2 hover:text-[#f0c060] transition-colors"
          >
            Choisir un plan →
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="text-red-400/60 hover:text-red-300 transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (!isTrialing) return null

  return (
    <div className={`border-b px-4 py-2 flex items-center justify-between gap-4 ${
      urgent
        ? 'bg-red-900/30 border-red-500/30'
        : 'bg-[#d4a843]/8 border-[#d4a843]/20'
    }`}>
      <div className="flex items-center gap-2 text-xs">
        {urgent
          ? <AlertTriangle size={13} className="text-red-400 shrink-0" />
          : <Gift size={13} className="text-[#d4a843] shrink-0" />
        }
        <span className={urgent ? 'text-red-300' : 'text-[#d4a843]/90'}>
          {trialDaysLeft === 0
            ? "Dernier jour d'essai gratuit"
            : trialDaysLeft === 1
            ? "Il vous reste 1 jour d'essai gratuit"
            : `Essai gratuit — Il vous reste ${trialDaysLeft} jours`
          }
        </span>
        <span className="text-gray-600 mx-1">|</span>
        <button
          onClick={() => router.push('/pricing')}
          className="text-[#d4a843] font-semibold hover:text-[#f0c060] transition-colors"
        >
          Choisir un plan →
        </button>
      </div>
      <button onClick={() => setDismissed(true)} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}
