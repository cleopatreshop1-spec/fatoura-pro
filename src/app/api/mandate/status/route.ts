// src/app/api/mandate/status/route.ts
import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)

    const [{ data: mandate }, { data: co }] = await Promise.all([
      (supabase as any).from('mandates').select('*')
        .eq('company_id', company.id).eq('is_active', true)
        .order('accepted_at', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from('companies').select('own_cert_pem').eq('id', company.id).single(),
    ])

    const hasMandate   = !!mandate
    const hasOwnCert   = !!(co as any)?.own_cert_pem
    const mode = hasMandate ? 'mandate' : hasOwnCert ? 'own_certificate' : 'not_configured'

    let isExpiringSoon = false
    if (mandate) {
      const daysLeft = Math.ceil((new Date((mandate as any).seal_valid_until).getTime() - Date.now()) / 86400000)
      isExpiringSoon = daysLeft <= 60
    }

    return success({
      hasMandate,
      hasOwnCert,
      mode,
      mandateAcceptedAt: (mandate as any)?.accepted_at ?? null,
      sealValidUntil:    (mandate as any)?.seal_valid_until ?? null,
      sealIdentifier:    (mandate as any)?.seal_identifier ?? null,
      isExpiringSoon,
    })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
