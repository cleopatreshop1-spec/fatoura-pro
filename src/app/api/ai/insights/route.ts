import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { type NextRequest } from 'next/server'
import { format, subDays, subMonths, startOfMonth } from 'date-fns'

export const maxDuration = 30

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const cid = (company as any).id
    const db  = supabase as any

    const today     = new Date()
    const todayStr  = format(today, 'yyyy-MM-dd')
    const ago90     = format(subDays(today, 90), 'yyyy-MM-dd')
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
    const prevMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')

    const [r_invoices, r_clients, r_overdue] = await Promise.all([
      db.from('invoices')
        .select('id, number, ttc_amount, ht_amount, status, payment_status, issue_date, created_at, due_date, payment_date, client_id, clients(name)')
        .eq('company_id', cid).gte('created_at', ago90).is('deleted_at', null),

      db.from('clients')
        .select('id, name').eq('company_id', cid).is('deleted_at', null),

      db.from('invoices')
        .select('id, number, ttc_amount, due_date, clients(name)')
        .eq('company_id', cid).in('status', ['valid', 'validated'])
        .neq('payment_status', 'paid').lt('due_date', todayStr).not('due_date', 'is', null)
        .is('deleted_at', null),
    ])

    const invoices  = r_invoices.data  ?? []
    const overdue   = r_overdue.data   ?? []

    const invDate = (i: any) => (i.issue_date ?? i.created_at ?? '').slice(0, 10)

    const thisMonthInvs = invoices.filter((i: any) => invDate(i) >= monthStart)
    const prevMonthInvs = invoices.filter((i: any) => invDate(i) >= prevMonthStart && invDate(i) < monthStart)

    const thisMonthCA = thisMonthInvs.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const prevMonthCA = prevMonthInvs.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const caTrend     = prevMonthCA > 0 ? Math.round(((thisMonthCA - prevMonthCA) / prevMonthCA) * 100) : null

    const overdueTotal = overdue.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
    const overdueCount = overdue.length

    const clientRevMap: Record<string, number> = {}
    for (const inv of invoices) {
      const name = (inv.clients as any)?.name ?? 'Inconnu'
      clientRevMap[name] = (clientRevMap[name] ?? 0) + Number(inv.ttc_amount ?? 0)
    }
    const bestClient = Object.entries(clientRevMap).sort((a, b) => b[1] - a[1])[0]

    const lateClients: Record<string, number> = {}
    for (const inv of overdue) {
      const name = (inv.clients as any)?.name ?? 'Inconnu'
      lateClients[name] = (lateClients[name] ?? 0) + 1
    }
    const habitualLate = Object.entries(lateClients).sort((a, b) => b[1] - a[1])[0]

    const context = {
      thisMonthCA: thisMonthCA.toFixed(3),
      prevMonthCA: prevMonthCA.toFixed(3),
      caTrend,
      overdueCount,
      overdueTotal: overdueTotal.toFixed(3),
      bestClient: bestClient ? { name: bestClient[0], total: bestClient[1].toFixed(3) } : null,
      habitualLate: habitualLate ? habitualLate[0] : null,
      totalInvoices90: invoices.length,
    }

    const prompt = `Tu es un assistant fiscal pour un entrepreneur tunisien.
Voici les données de son activité récente :
- CA ce mois : ${context.thisMonthCA} TND HT
- CA mois dernier : ${context.prevMonthCA} TND HT
- Tendance CA : ${context.caTrend !== null ? context.caTrend + '%' : 'N/A'}
- Factures en retard : ${context.overdueCount} factures pour un total de ${context.overdueTotal} TND
- Meilleur client (90 jours) : ${context.bestClient ? context.bestClient.name + ' (' + context.bestClient.total + ' TND)' : 'N/A'}
- Client à risque (retards fréquents) : ${context.habitualLate ?? 'Aucun'}
- Total factures (90 jours) : ${context.totalInvoices90}

Génère exactement 3 à 4 insights courts et actionnables en français. Chaque insight doit être une phrase courte (max 100 chars).
Réponds UNIQUEMENT en JSON valide :
[{"icon":"emoji","text":"insight court","type":"info|warning|success|tip"}]
Types : success = bonne nouvelle, warning = attention requise, info = information, tip = conseil.`

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    })

    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?|```\n?/g, '').trim()

    let insights: { icon: string; text: string; type: string }[]
    try {
      insights = JSON.parse(raw)
      if (!Array.isArray(insights)) throw new Error('not array')
    } catch {
      insights = [
        { icon: '📊', text: `CA ce mois : ${context.thisMonthCA} TND HT`, type: 'info' },
        { icon: context.overdueCount > 0 ? '⚠️' : '✅', text: context.overdueCount > 0 ? `${context.overdueCount} facture(s) en retard — ${context.overdueTotal} TND` : 'Aucune facture en retard', type: context.overdueCount > 0 ? 'warning' : 'success' },
      ]
    }

    return Response.json({ insights, context })

  } catch (e: any) {
    console.error('[insights]', e)
    return err(e.message ?? 'Erreur IA', 500)
  }
}
