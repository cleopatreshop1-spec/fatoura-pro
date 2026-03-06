import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!code || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  // Temporary response used to set cookies; we will re-redirect after checking company
  const tempResponse = NextResponse.redirect(new URL('/dashboard', url.origin))

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          tempResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !user) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  // Check if user already has a company — if not, send to onboarding wizard
  const { count } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)

  const redirectTo = (count ?? 0) === 0 ? '/onboarding' : next
  const finalResponse = NextResponse.redirect(new URL(redirectTo, url.origin))

  // Copy session cookies to final response
  tempResponse.cookies.getAll().forEach(cookie =>
    finalResponse.cookies.set(cookie.name, cookie.value, { path: '/' })
  )

  return finalResponse
}
