'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  fiduciaire: 'Fiduciaire',
  enterprise: 'Enterprise',
}

export function PaymentSuccessToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    const status = searchParams.get('payment')
    const plan   = searchParams.get('plan')

    if (status === 'success') {
      fired.current = true
      const planLabel = plan ? PLAN_LABELS[plan] ?? plan : null
      toast.success(
        planLabel
          ? `Abonnement ${planLabel} activé ✓`
          : 'Paiement confirmé ✓',
        {
          description: 'Votre compte est maintenant actif. Bonne facturation !',
          duration: 6000,
        }
      )
      // Clean up query params without re-render loop
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('plan')
      router.replace(url.pathname + url.search)
    } else if (status === 'failed') {
      fired.current = true
      toast.error('Paiement échoué', {
        description: 'Veuillez réessayer ou contacter le support.',
        duration: 6000,
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      router.replace(url.pathname + url.search)
    }
  }, [searchParams, router])

  return null
}
