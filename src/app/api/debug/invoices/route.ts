import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCompany } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const cid = company.id

    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const todayStr = now.toISOString().slice(0, 10)

    // Test 1: typed client with .in()
    const r1 = await supabase.from('invoices')
      .select('id, ht_amount, status, issue_date, created_at')
      .eq('company_id', cid).in('status', ['validated', 'valid'] as any)
      .is('deleted_at', null)

    // Test 2: any-cast client with .in()
    const r2 = await (supabase as any).from('invoices')
      .select('id, ht_amount, status, issue_date, created_at')
      .eq('company_id', cid).in('status', ['validated', 'valid'])
      .is('deleted_at', null)

    // Test 3: plain eq for validated only
    const r3 = await (supabase as any).from('invoices')
      .select('id, ht_amount, status')
      .eq('company_id', cid).eq('status', 'validated')
      .is('deleted_at', null)

    const caHT_r2 = (r2.data ?? []).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)

    return NextResponse.json({
      monthStart, todayStr,
      typed_in_count: r1.data?.length, typed_in_error: r1.error,
      any_in_count: r2.data?.length, any_in_error: r2.error,
      eq_validated_count: r3.data?.length, eq_validated_error: r3.error,
      caHT_from_any_in: caHT_r2,
      sample_r2: r2.data?.slice(0, 3),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
