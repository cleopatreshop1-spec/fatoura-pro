import { GoogleGenerativeAI } from '@google/generative-ai'
import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { captureError } from '@/lib/monitoring/sentry'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const maxDuration = 30

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[Gemini] GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

export async function POST(request: NextRequest) {
  try {
    const limited = await applyRateLimit(rateLimiters.summaries, getClientIp(request))
    if (limited) return limited

    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const plan = await getCompanyPlan(supabase as any, co.id)
    if (!canUseFeature(plan, 'fiduciaire_summary')) return upgradeRequiredResponse('fiduciaire_summary')
    if (!co.is_fiduciaire) return err('Accès réservé aux fiduciaires', 403)

    const body = await request.json()
    const { clientCompanyId } = body as { clientCompanyId: string }
    if (!clientCompanyId) return err('clientCompanyId requis', 400)

    // Verify fiduciaire relationship
    const { data: relation } = await (supabase as any)
      .from('fiduciaire_clients')
      .select('id')
      .eq('fiduciaire_company_id', co.id)
      .eq('client_company_id', clientCompanyId)
      .eq('status', 'active')
      .single()

    if (!relation) return err('Client non trouvé dans votre portefeuille', 404)

    // Check daily cache — 1 summary per client per day
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: cached } = await (supabase as any)
      .from('ai_suggestions')
      .select('message, created_at')
      .eq('company_id', clientCompanyId)
      .eq('type', 'fiduciaire_summary')
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .single()

    if (cached) {
      return Response.json({ summary: cached.message, cached: true })
    }

    // Load client company data
    const { data: clientCompany } = await (supabase as any)
      .from('companies')
      .select('name, matricule_fiscal')
      .eq('id', clientCompanyId)
      .single()

    const now = new Date()
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const todayFull = now.toISOString().split('T')[0]
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const firstOfPrevMonth = prevMonth.toISOString().split('T')[0]
    const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const [
      { data: thisMonthInvoices },
      { data: prevMonthInvoices },
      { data: unpaidInvoices },
      { data: topClients },
    ] = await Promise.all([
      (supabase as any).from('invoices')
        .select('ht_amount, tva_amount, ttc_amount, status, client_id')
        .eq('company_id', clientCompanyId)
        .gte('issue_date', firstOfMonth)
        .lte('issue_date', todayFull)
        .is('deleted_at', null),

      (supabase as any).from('invoices')
        .select('ht_amount, status')
        .eq('company_id', clientCompanyId)
        .gte('issue_date', firstOfPrevMonth)
        .lte('issue_date', lastOfPrevMonth)
        .is('deleted_at', null),

      (supabase as any).from('invoices')
        .select('ttc_amount, due_date, clients(name)')
        .eq('company_id', clientCompanyId)
        .eq('payment_status', 'unpaid')
        .eq('status', 'valid')
        .is('deleted_at', null)
        .order('due_date', { ascending: true })
        .limit(3),

      (supabase as any).from('invoices')
        .select('ttc_amount, clients(name)')
        .eq('company_id', clientCompanyId)
        .gte('issue_date', firstOfMonth)
        .is('deleted_at', null)
        .limit(20),
    ])

    const cur = (thisMonthInvoices ?? []) as any[]
    const prev = (prevMonthInvoices ?? []) as any[]
    const curCA = cur.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const prevCA = prev.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const caGrowth = prevCA > 0 ? Math.round((curCA - prevCA) / prevCA * 100) : null
    const validated = cur.filter((i: any) => i.status === 'valid').length
    const ttnRate = cur.length > 0 ? Math.round(validated / cur.length * 100) : 100

    // Top client by CA
    const clientTotals: Record<string, number> = {}
    for (const inv of (topClients ?? []) as any[]) {
      const name = (inv.clients as any)?.name ?? 'Inconnu'
      clientTotals[name] = (clientTotals[name] ?? 0) + Number(inv.ttc_amount ?? 0)
    }
    const sortedClients = Object.entries(clientTotals).sort(([, a], [, b]) => b - a)
    const topClient = sortedClients[0]
    const topConcentration = topClient && curCA > 0
      ? Math.round(topClient[1] / (curCA * 1.19) * 100)
      : null

    const unpaidTotal = (unpaidInvoices ?? []).reduce(
      (s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0
    )
    const unpaidCount = (unpaidInvoices ?? []).length

    const currentMonth = format(now, 'MMMM yyyy', { locale: fr })

    const prompt = `Tu es l'assistant d'un expert-comptable tunisien. Rédige un résumé de situation en 4-6 phrases pour ce client PME.

CLIENT : ${clientCompany?.name ?? 'N/A'} — ${currentMonth}

DONNÉES :
- CA HT ce mois : ${curCA.toFixed(3)} TND${caGrowth !== null ? ` (${caGrowth > 0 ? '+' : ''}${caGrowth}% vs mois dernier)` : ''}
- Factures émises : ${cur.length} dont ${validated} validées TTN (${ttnRate}%)
- Impayés : ${unpaidCount} facture(s) — ${unpaidTotal.toFixed(3)} TND TTC${topClient && topConcentration ? `\n- Client principal : "${topClient[0]}" représente ${topConcentration}% du CA` : ''}

Le résumé doit :
1. Commencer par un point positif ou neutre
2. Mentionner les chiffres clés (CA, nb factures, taux TTN)
3. Identifier le principal risque ou point d'attention
4. Terminer par 1 action concrète recommandée

Ton : professionnel mais lisible. Texte fluide, pas de bullet points. En français uniquement.`

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
    })

    const result = await model.generateContent(prompt)
    const summary = result.response.text().trim()

    // Cache in ai_suggestions
    await (supabase as any).from('ai_suggestions').insert({
      company_id: clientCompanyId,
      message:    summary,
      type:       'fiduciaire_summary',
      is_read:    true,
    })

    return Response.json({
      summary,
      cached: false,
      clientName: clientCompany?.name,
      generatedAt: now.toISOString(),
    })

  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
      return err(error.message, error.status)
    }
    captureError(error, { action: 'fiduciaire_client_summary' })
    return err('Impossible de générer le résumé. Réessayez.', 500)
  }
}
