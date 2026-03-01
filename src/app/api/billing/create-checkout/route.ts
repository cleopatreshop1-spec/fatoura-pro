import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PLAN_PRICES: Record<string, Record<'monthly' | 'yearly', number>> = {
  starter:    { monthly: 29_000,   yearly: 295_000  },
  pro:        { monthly: 79_000,   yearly: 805_000  },
  fiduciaire: { monthly: 199_000,  yearly: 2_030_000 },
}
const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  fiduciaire: 'Fiduciaire',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const planId: string = body.planId
    const billingCycle: 'monthly' | 'yearly' = body.billingCycle ?? 'monthly'

    if (!PLAN_PRICES[planId]) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (!company) return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 })

    const amountMillimes = PLAN_PRICES[planId][billingCycle]
    const cycleLabel = billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'
    const description = `Abonnement Fatoura Pro ${PLAN_LABELS[planId]} — ${cycleLabel}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Create payment session with Konnect
    const konnectRes = await fetch('https://api.konnect.network/api/v2/payments/init-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.KONNECT_API_KEY ?? '',
      },
      body: JSON.stringify({
        receiverWalletId: process.env.KONNECT_WALLET_ID,
        token: 'TND',
        amount: amountMillimes,
        type: 'immediate',
        description,
        acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
        lifespan: 10,
        checkoutForm: true,
        addPaymentFeesToAmount: false,
        firstName: user.user_metadata?.first_name ?? '',
        lastName:  user.user_metadata?.last_name  ?? '',
        email:     user.email ?? '',
        orderId:   `fp_${company.id}_${planId}_${billingCycle}_${Date.now()}`,
        webhook:   `${appUrl}/api/billing/webhook`,
        successUrl: `${appUrl}/dashboard?payment=success&plan=${planId}`,
        failUrl:    `${appUrl}/dashboard/settings?tab=billing&payment=failed`,
        theme: 'dark',
      }),
    })

    if (!konnectRes.ok) {
      const err = await konnectRes.text()
      console.error('[Konnect] init-payment error:', err)
      return NextResponse.json({ error: 'Erreur Konnect — réessayez ou contactez le support.' }, { status: 502 })
    }

    const konnectData = await konnectRes.json()
    const paymentUrl = konnectData.payUrl ?? konnectData.payment?.payUrl

    if (!paymentUrl) {
      return NextResponse.json({ error: 'Konnect n\'a pas retourné d\'URL de paiement.' }, { status: 502 })
    }

    // Store pending payment record
    await supabase.from('payments').insert({
      company_id:         company.id,
      amount:             amountMillimes / 1000,
      currency:           'TND',
      status:             'pending',
      payment_method:     'card',
      provider_payment_id: konnectData.paymentRef ?? null,
      description,
    })

    return NextResponse.json({ paymentUrl })
  } catch (err) {
    console.error('[billing/create-checkout]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
