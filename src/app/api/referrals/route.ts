import { NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCompany } from '@/lib/api-helpers'

function generateCode(companyId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seed  = companyId.replace(/-/g, '').slice(0, 8)
  let code = 'FP-'
  for (let i = 0; i < 6; i++) {
    code += chars[parseInt(seed[i % 8]!, 16) % chars.length]
  }
  return code
}

export async function GET() {
  let company: any, user: any
  try {
    const supabase = await createServerClient()
    const result = await getAuthenticatedCompany()
    company = result.company
    user    = result.user
  } catch {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let { data: referral } = await sb
    .from('referrals')
    .select('*')
    .eq('referrer_company_id', company.id)
    .is('referee_company_id', null)
    .maybeSingle()

  if (!referral) {
    const code = generateCode(company.id)
    const { data: newRef } = await sb.from('referrals').insert({
      referrer_company_id: company.id,
      referral_code:       code,
      status:              'active',
    }).select().single()
    referral = newRef
  }

  const { data: allReferrals } = await sb
    .from('referrals')
    .select('id, referee_email, status, activated_at, created_at')
    .eq('referrer_company_id', company.id)
    .not('referee_email', 'is', null)

  const activatedCount = (allReferrals ?? []).filter((r: any) => r.status === 'rewarded' || r.status === 'activated').length
  const pendingCount   = (allReferrals ?? []).filter((r: any) => r.status === 'pending').length

  return Response.json({
    code:           (referral as any)?.referral_code ?? null,
    activated:      activatedCount,
    pending:        pendingCount,
    rewardMonths:   activatedCount,
    appUrl:         process.env.NEXT_PUBLIC_APP_URL ?? 'https://fatoura.pro',
  })
}

export async function POST(request: NextRequest) {
  let company: any
  try {
    const result = await getAuthenticatedCompany()
    company = result.company
  } catch {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { email } = await request.json()
  if (!email || !email.includes('@')) return Response.json({ error: 'Email invalide' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const code = generateCode(company.id)
  await sb.from('referrals').insert({
    referrer_company_id: company.id,
    referral_code:       `${code}-${Date.now()}`,
    referee_email:       email,
    status:              'pending',
  })

  return Response.json({ success: true })
}
