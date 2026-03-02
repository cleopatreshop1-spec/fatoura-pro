import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const sp     = new URL(request.url).searchParams
    const type   = sp.get('type')
    const from   = sp.get('from')
    const to     = sp.get('to')
    const search = sp.get('search')
    const page   = Math.max(1, Number(sp.get('page') ?? 1))
    const limit  = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)))

    let q = (supabase as any)
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (type)   q = q.ilike('action_type', `${type}%`)
    if (from)   q = q.gte('created_at', from)
    if (to)     q = q.lte('created_at', to + 'T23:59:59Z')
    if (search) q = q.ilike('description', `%${search}%`)

    const { data: logs, count, error } = await q
    if (error) return err(error.message, 500)
    return success({ logs, total: count, page, limit })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
