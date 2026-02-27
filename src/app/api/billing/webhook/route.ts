import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PLAN_LIMITS: Record<string, { invoiceLimit: number | null; planId: string }> = {
  starter:    { invoiceLimit: 50,   planId: 'starter' },
  pro:        { invoiceLimit: null, planId: 'pro' },
  fiduciaire: { invoiceLimit: null, planId: 'fiduciaire' },
}

function extractPlanFromOrderId(orderId: string): { planId: string; billingCycle: 'monthly' | 'yearly' } | null {
  // orderId format: fp_{companyId}_{planId}_{billingCycle}_{timestamp}
  const parts = orderId.split('_')
  if (parts.length < 5) return null
  const planId = parts[2]
  const billingCycle = parts[3] as 'monthly' | 'yearly'
  return { planId, billingCycle }
}

export async function GET(req: NextRequest) {
  // Konnect redirects with ?payment_ref=xxx&type=xxx
  const { searchParams } = new URL(req.url)
  const paymentRef = searchParams.get('payment_ref')

  if (!paymentRef) {
    return NextResponse.redirect(new URL('/dashboard?payment=failed', req.url))
  }

  try {
    const supabase = await createClient()

    // Verify payment with Konnect
    const verifyRes = await fetch(`https://api.konnect.network/api/v2/payments/${paymentRef}`, {
      headers: { 'x-api-key': process.env.KONNECT_API_KEY ?? '' },
    })

    if (!verifyRes.ok) {
      return NextResponse.redirect(new URL('/settings/billing?payment=failed', req.url))
    }

    const paymentData = await verifyRes.json()
    const payment = paymentData.payment ?? paymentData

    if (payment.status !== 'completed') {
      return NextResponse.redirect(new URL('/settings/billing?payment=failed', req.url))
    }

    const orderId: string = payment.orderId ?? ''
    const parsed = extractPlanFromOrderId(orderId)
    if (!parsed) {
      return NextResponse.redirect(new URL('/dashboard?payment=success', req.url))
    }

    const { planId, billingCycle } = parsed

    // Extract companyId from orderId
    const companyId = orderId.split('_')[1]
    if (!companyId) {
      return NextResponse.redirect(new URL('/dashboard?payment=success', req.url))
    }

    const amountTND = (payment.amount ?? 0) / 1000

    const now = new Date()
    const periodEnd = new Date(now)
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // Update subscription
    await supabase
      .from('subscriptions')
      .upsert({
        company_id:           companyId,
        plan_id:              planId,
        status:               'active',
        billing_cycle:        billingCycle,
        payment_provider:     'konnect',
        provider_subscription_id: paymentRef,
        last_payment_at:      now.toISOString(),
        last_payment_amount:  amountTND,
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
        invoices_used_this_month: 0,
        invoices_reset_at:    now.toISOString(),
      }, { onConflict: 'company_id' })

    // Update company current_plan
    await supabase
      .from('companies')
      .update({ current_plan: planId })
      .eq('id', companyId)

    // Update payment record to succeeded
    await supabase
      .from('payments')
      .update({ status: 'succeeded', provider_payment_id: paymentRef })
      .eq('provider_payment_id', paymentRef)

    // Fallback: create payment record if not found
    const month = now.toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' })
    const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', fiduciaire: 'Fiduciaire' }
    await supabase.from('payments').upsert({
      company_id:          companyId,
      amount:              amountTND,
      currency:            'TND',
      status:              'succeeded',
      payment_method:      'card',
      provider_payment_id: paymentRef,
      description:         `Abonnement Fatoura Pro ${planLabels[planId] ?? planId} — ${month}`,
    }, { onConflict: 'provider_payment_id' })

    // Activity log
    await supabase.from('activity_log').insert({
      company_id:  companyId,
      action_type: 'subscription_activated',
      entity_type: 'subscription',
      description: `Abonnement ${planLabels[planId] ?? planId} activé via Konnect`,
    })

    return NextResponse.redirect(new URL(`/dashboard?payment=success&plan=${planId}`, req.url))
  } catch (err) {
    console.error('[billing/webhook]', err)
    return NextResponse.redirect(new URL('/settings/billing?payment=error', req.url))
  }
}

// Konnect also sends POST webhooks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const paymentRef: string = body.payment_ref ?? body.paymentRef ?? ''
    if (!paymentRef) return NextResponse.json({ ok: false }, { status: 400 })

    // Re-use GET logic by constructing URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const fakeUrl = new URL(`${appUrl}/api/billing/webhook?payment_ref=${paymentRef}`)
    return GET(new NextRequest(fakeUrl))
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
