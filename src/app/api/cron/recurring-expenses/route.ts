import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const todayDay = today.getDate()

  try {
    const { data: templates, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('active', true)

    if (error) throw error

    let logged = 0

    for (const t of (templates ?? [])) {
      // Only log on the configured day of month (or last day if month is shorter)
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      const targetDay = Math.min(t.day_of_month, daysInMonth)
      if (todayDay !== targetDay) continue

      // Don't log twice in same month
      if (t.last_logged) {
        const lastMonth = t.last_logged.slice(0, 7)
        const thisMonth = todayStr.slice(0, 7)
        if (lastMonth === thisMonth) continue
      }

      const { error: insErr } = await supabase.from('expenses').insert({
        company_id:  t.company_id,
        description: t.description,
        amount:      t.amount,
        category:    t.category,
        notes:       t.notes,
        date:        todayStr,
      })

      if (!insErr) {
        await supabase
          .from('recurring_expenses')
          .update({ last_logged: todayStr })
          .eq('id', t.id)
        logged++
      }
    }

    return Response.json({ ok: true, logged })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
