import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, subDays, subMonths } from 'date-fns'
import { captureError } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now      = new Date()
  const today    = format(now, 'yyyy-MM-dd')
  const ago5     = format(subDays(now, 5),  'yyyy-MM-dd')
  const ago60    = format(subDays(now, 60), 'yyyy-MM-dd')
  const monthStart = format(now, 'yyyy-MM-01')
  const prevMonthStart = format(subMonths(now, 1), 'yyyy-MM-01')
  const prevMonthEnd   = monthStart
  const qtr      = Math.floor(now.getMonth() / 3)
  const daysUntilQtrEnd = [2, 1, 0].map(offset => {
    const qtrEndMonth = (qtr + 1) * 3
    const qtrEnd = new Date(now.getFullYear(), qtrEndMonth, 0)
    return Math.ceil((qtrEnd.getTime() - now.getTime()) / 86400000)
  })[0]

  const { data: companies } = await supabase.from('companies').select('id, name')
  let total = 0

  for (const company of companies ?? []) {
    try {
      const cid = (company as any).id
      const suggestions: { company_id: string; message: string; type: string }[] = []

      const [
        { data: staleDrafts },
        { data: overdueClients },
        { data: thisMonthValid },
        { data: prevMonthValid },
      ] = await Promise.all([
        supabase.from('invoices').select('id, number')
          .eq('company_id', cid).eq('status', 'draft')
          .is('deleted_at', null).lte('created_at', ago5).limit(10),

        supabase.from('invoices').select('id, ttc_amount, clients(name)')
          .eq('company_id', cid).eq('status', 'valid')
          .neq('payment_status', 'paid').is('deleted_at', null)
          .lte('due_date', ago60).limit(5),

        supabase.from('invoices').select('ht_amount')
          .eq('company_id', cid).eq('status', 'valid')
          .gte('issue_date', monthStart).lte('issue_date', today)
          .is('deleted_at', null),

        supabase.from('invoices').select('ht_amount')
          .eq('company_id', cid).eq('status', 'valid')
          .gte('issue_date', prevMonthStart).lt('issue_date', prevMonthEnd)
          .is('deleted_at', null),
      ])

      // Trigger: stale drafts > 5 days
      const draftCount = (staleDrafts ?? []).length
      if (draftCount > 0) {
        suggestions.push({
          company_id: cid,
          type: 'warning',
          message: `Vous avez ${draftCount} brouillon${draftCount > 1 ? 's' : ''} non soumis depuis plus de 5 jours. Soumettez-les avant la date limite TTN.`,
        })
      }

      // Trigger: overdue clients > 60 days
      for (const inv of (overdueClients ?? []).slice(0, 2)) {
        const clientName = ((inv as any).clients as any)?.name ?? 'un client'
        const amount     = Number((inv as any).ttc_amount ?? 0).toFixed(3)
        suggestions.push({
          company_id: cid,
          type: 'action',
          message: `Relancer ${clientName} ? Une facture de ${amount} TND est impayée depuis plus de 60 jours.`,
        })
      }

      // Trigger: CA decline 2 consecutive months
      const thisCA = (thisMonthValid ?? []).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
      const prevCA = (prevMonthValid ?? []).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
      if (prevCA > 0 && thisCA < prevCA * 0.8) {
        const drop = Math.round(((prevCA - thisCA) / prevCA) * 100)
        suggestions.push({
          company_id: cid,
          type: 'info',
          message: `Votre CA a baissé de ${drop}% par rapport au mois précédent (${thisCA.toFixed(3)} vs ${prevCA.toFixed(3)} TND). Souhaitez-vous analyser les causes ?`,
        })
      }

      // Trigger: TVA declaration approaching (5 days to end of quarter)
      if (daysUntilQtrEnd <= 5 && daysUntilQtrEnd >= 0) {
        const qtrLabel = `T${qtr + 1} ${now.getFullYear()}`
        suggestions.push({
          company_id: cid,
          type: 'info',
          message: `Votre déclaration TVA ${qtrLabel} est dans ${daysUntilQtrEnd} jour${daysUntilQtrEnd !== 1 ? 's' : ''}. Exportez votre rapport TVA maintenant.`,
        })
      }

      if (suggestions.length === 0) continue

      // Delete old unread suggestions for this company first (keep fresh)
      await supabase.from('ai_suggestions')
        .delete()
        .eq('company_id', cid).eq('is_read', false)

      await supabase.from('ai_suggestions').insert(suggestions.slice(0, 3))
      total += suggestions.length
    } catch (e) {
      captureError(e, { action: 'cron_ai_suggestions', companyId: (company as any).id })
    }
  }

  return Response.json({ success: true, total })
}
