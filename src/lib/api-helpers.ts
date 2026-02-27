import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedCompany(request?: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw Object.assign(new Error('Non authentifie'), { status: 401 })

  const { data: company, error: coErr } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (coErr || !company) throw Object.assign(new Error('Societe introuvable'), { status: 404 })

  return { user, company: company as any, supabase }
}

export function success(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  actionType: string,
  entityType: string,
  entityId: string,
  description?: string,
) {
  try {
    await (supabase as any).from('activity_log').insert({
      company_id: companyId,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      description: description ?? null,
      created_at: new Date().toISOString(),
    })
  } catch {}
}

export async function insertNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  type: string,
  title: string,
  message?: string,
) {
  try {
    await (supabase as any).from('notifications').insert({
      company_id: companyId,
      type,
      title,
      message: message ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    })
  } catch {}
}

/** Handle async route errors uniformly */
export function withErrorHandler(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx?: any) => {
    try {
      return await handler(req, ctx)
    } catch (e: any) {
      const status = e?.status ?? 500
      return err(e?.message ?? 'Erreur interne', status)
    }
  }
}
