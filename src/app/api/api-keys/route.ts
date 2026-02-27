import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const { data, error } = await (supabase as any)
      .from('api_keys')
      .select('id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
    if (error) return err(error.message, 500)
    return success({ apiKeys: data })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const body = await request.json()
    const { name, permissions, expires_at } = body

    if (!name?.trim()) return err('Nom requis', 422)
    if (!permissions?.length) return err('Au moins une permission requise', 422)

    // Generate: fp_live_ + 32 random hex chars
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)
    const rawKey = `fp_live_${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`
    const prefix = rawKey.slice(0, 14) // fp_live_XXXXXX

    // SHA-256 hash  store only hash, never the raw key
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

    const { data, error } = await (supabase as any)
      .from('api_keys')
      .insert({
        company_id:  company.id,
        created_by:  user.id,
        name:        name.trim(),
        key_hash:    keyHash,
        key_prefix:  prefix,
        permissions: permissions,
        is_active:   true,
        expires_at:  expires_at ?? null,
      })
      .select('id, name, key_prefix, permissions, expires_at, created_at')
      .single()

    if (error) return err(error.message, 500)

    await logActivity(supabase as any, company.id, user.id, 'api_key_created', 'api_key', (data as any).id, `Cle API "${name}" creee`)

    // Return the raw key ONCE  it will never be shown again
    return success({ apiKey: data, rawKey }, 201)
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
