'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { CheckCircle, Circle, X } from 'lucide-react'

type Step = {
  key: string
  title: string
  description: string
  href: string
  cta: string
  checked: boolean
}

export function OnboardingChecklist() {
  const { activeCompany } = useCompany()
  const [steps, setSteps]         = useState<Step[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!activeCompany?.id) return
    const ac = activeCompany as any
    if (ac.onboarding_completed || ac.onboarding_dismissed_at) {
      setDismissed(true)
      setLoading(false)
      return
    }
    fetchSteps()
  }, [activeCompany?.id])

  async function fetchSteps() {
    if (!activeCompany?.id) return
    const supabase = createClient()
    const ac = activeCompany as any

    const [{ count: clientCount }, { count: invoiceCount }, { data: mandate }] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', activeCompany.id),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', activeCompany.id),
      supabase.from('mandates').select('id').eq('company_id', activeCompany.id).eq('is_active', true).maybeSingle(),
    ])

    const s: Step[] = [
      {
        key: 'profile',
        title: 'Complétez votre profil entreprise',
        description: 'Matricule fiscal et adresse requis',
        href: '/dashboard/settings',
        cta: 'Compléter',
        checked: !!(ac.matricule_fiscal && ac.address),
      },
      {
        key: 'signature',
        title: 'Configurez votre signature électronique',
        description: 'Mandat ou certificat ANCE',
        href: '/dashboard/settings?tab=signature',
        cta: 'Configurer',
        checked: !!(mandate || ac.own_cert_pem),
      },
      {
        key: 'client',
        title: 'Ajoutez votre premier client',
        description: 'Requis pour créer une facture',
        href: '/dashboard/clients',
        cta: 'Ajouter un client',
        checked: (clientCount ?? 0) > 0,
      },
      {
        key: 'invoice',
        title: 'Créez votre première facture',
        description: 'Prêt à soumettre à TTN',
        href: '/dashboard/invoices/new',
        cta: 'Créer une facture',
        checked: (invoiceCount ?? 0) > 0,
      },
    ]

    setSteps(s)
    setLoading(false)

    const allDone = s.every(st => st.checked)
    if (allDone) {
      setShowSuccess(true)
      await markCompleted()
      setTimeout(() => setCompleted(true), 3000)
    }
  }

  async function markCompleted() {
    if (!activeCompany?.id) return
    const supabase = createClient()
    await supabase.from('companies').update({ onboarding_completed: true }).eq('id', activeCompany.id)
  }

  async function handleDismiss() {
    if (!activeCompany?.id) return
    const supabase = createClient()
    await supabase.from('companies')
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq('id', activeCompany.id)
    setDismissed(true)
  }

  if (loading || dismissed || completed) return null

  const checkedCount = steps.filter(s => s.checked).length

  if (showSuccess) {
    return (
      <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-6 flex items-center gap-4">
        <div className="text-3xl">🎉</div>
        <div>
          <p className="text-white font-semibold">Tout est prêt !</p>
          <p className="text-green-400 text-sm">Vous pouvez maintenant soumettre vos factures à TTN.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-base">Bienvenue sur Fatoura Pro</h2>
          <p className="text-gray-500 text-sm mt-0.5">Complétez ces étapes pour soumettre votre première facture</p>
        </div>
        <button onClick={handleDismiss} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{checkedCount}/{steps.length} étapes complétées</span>
          <span>{Math.round((checkedCount / steps.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-[#161b27] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d4a843] rounded-full transition-all duration-500"
            style={{ width: `${(checkedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
              step.checked ? 'opacity-60' : 'bg-[#161b27]'
            }`}
          >
            {step.checked
              ? <CheckCircle size={18} className="text-green-400 shrink-0" />
              : <Circle size={18} className="text-gray-600 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.checked ? 'line-through text-gray-500' : 'text-white'}`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{step.description}</p>
            </div>
            {!step.checked && (
              <Link
                href={step.href}
                className="shrink-0 text-xs text-[#d4a843] hover:underline font-medium"
              >
                {step.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
