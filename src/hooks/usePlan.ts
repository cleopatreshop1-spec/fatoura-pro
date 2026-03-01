'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

export interface PlanPermissions {
  plan: 'trialing' | 'starter' | 'pro' | 'fiduciaire' | 'enterprise' | 'free'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null
  canCreateInvoice: boolean
  canSubmitToTTN: boolean
  canUseMandate: boolean
  canAccessFinancing: boolean
  canManageMultiClients: boolean
  canUseAPI: boolean
  invoicesRemaining: number | null
  invoicesUsed: number
  invoiceLimit: number | null
  trialDaysLeft: number | null
  isTrialing: boolean
  isExpired: boolean
  subscriptionId: string | null
  billingCycle: 'monthly' | 'yearly'
  nextRenewalDate: string | null
  lastPaymentAmount: number | null
}

const DEFAULT_PERMISSIONS: PlanPermissions = {
  plan: 'trialing',
  status: 'trialing',
  canCreateInvoice: true,
  canSubmitToTTN: true,
  canUseMandate: false,
  canAccessFinancing: false,
  canManageMultiClients: false,
  canUseAPI: false,
  invoicesRemaining: 20,
  invoicesUsed: 0,
  invoiceLimit: 20,
  trialDaysLeft: 14,
  isTrialing: true,
  isExpired: false,
  subscriptionId: null,
  billingCycle: 'monthly',
  nextRenewalDate: null,
  lastPaymentAmount: null,
}

function computePermissions(sub: any, plan: any): PlanPermissions {
  if (!sub || !plan) return DEFAULT_PERMISSIONS

  const planId = plan.id as PlanPermissions['plan']
  const status = sub.status as PlanPermissions['status']
  const isTrialing = status === 'trialing'
  const isActive = status === 'active' || isTrialing
  const isExpired = status === 'canceled' || status === 'paused' ||
    (isTrialing && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date())

  const trialDaysLeft = isTrialing && sub.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  const invoiceLimit = plan.invoice_limit ?? null
  const invoicesUsed = sub.invoices_used_this_month ?? 0
  const invoicesRemaining = invoiceLimit !== null ? Math.max(0, invoiceLimit - invoicesUsed) : null

  const canCreate = !isExpired && (invoiceLimit === null || invoicesUsed < invoiceLimit)
  const features = plan.features ?? {}

  return {
    plan: planId,
    status,
    canCreateInvoice: canCreate,
    canSubmitToTTN: !isExpired && !!features.ttn,
    canUseMandate: !isExpired && !!features.mandate,
    canAccessFinancing: !isExpired && !!features.financing,
    canManageMultiClients: !isExpired && !!features.multi_clients,
    canUseAPI: !isExpired && !!features.api,
    invoicesRemaining,
    invoicesUsed,
    invoiceLimit,
    trialDaysLeft,
    isTrialing,
    isExpired,
    subscriptionId: sub.id,
    billingCycle: sub.billing_cycle ?? 'monthly',
    nextRenewalDate: sub.current_period_end ?? null,
    lastPaymentAmount: sub.last_payment_amount ?? null,
  }
}

export function usePlan(): PlanPermissions & { loading: boolean; refresh: () => void } {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [perms, setPerms] = useState<PlanPermissions>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!activeCompany?.id) { setLoading(false); return }
    setLoading(true)

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('company_id', activeCompany.id)
      .single()

    if (sub) {
      setPerms(computePermissions(sub, sub.plan))
    }
    setLoading(false)
  }, [activeCompany?.id]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  return { ...perms, loading, refresh: fetch }
}
