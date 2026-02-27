'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, X, Sparkles } from 'lucide-react'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  featureName: string
  requiredPlan: 'starter' | 'pro' | 'fiduciaire' | 'enterprise'
  featureBenefit?: string
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  fiduciaire: 'Fiduciaire',
  enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  pro: 'text-[#d4a843] bg-[#d4a843]/10 border-[#d4a843]/30',
  fiduciaire: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  enterprise: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
}

export function UpgradeModal({ open, onClose, featureName, requiredPlan, featureBenefit }: UpgradeModalProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const planLabel = PLAN_LABELS[requiredPlan] ?? requiredPlan
  const planColor = PLAN_COLORS[requiredPlan] ?? PLAN_COLORS.pro

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-8 max-w-sm w-full relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Animated lock icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center relative">
            <Lock size={28} className="text-gray-500" />
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#d4a843] flex items-center justify-center">
              <Sparkles size={10} className="text-black" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-3 mb-6">
          <h2 className="text-lg font-black text-white">{featureName}</h2>
          <p className="text-sm text-gray-400">
            Cette fonctionnalité est incluse dans le plan{' '}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${planColor}`}>
              {planLabel}
            </span>
          </p>
          {featureBenefit && (
            <p className="text-xs text-gray-500 leading-relaxed bg-[#161b27] rounded-xl px-4 py-3">
              {featureBenefit}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => { router.push('/pricing'); onClose() }}
            className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black font-black text-sm rounded-xl transition-colors"
          >
            Upgrade maintenant
          </button>
          <button
            onClick={() => { router.push('/pricing'); onClose() }}
            className="w-full py-2.5 text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors"
          >
            Voir tous les plans →
          </button>
        </div>
      </div>
    </div>
  )
}
