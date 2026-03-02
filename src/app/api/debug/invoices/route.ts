import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCompany } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const cid = company.id

    const { data, error } = await (supabase as any)
      .from('invoices')
      .select('id, number, status, issue_date, created_at, ht_amount, deleted_at')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ companyId: cid, error, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
