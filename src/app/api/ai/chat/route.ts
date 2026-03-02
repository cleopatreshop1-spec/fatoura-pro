import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const maxDuration = 30

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    // Rate limit: 20 messages per 10 minutes per company
    const rl = await applyRateLimit(rateLimiters.api, `ai:${co.id}:${getClientIp(request)}`)
    if (rl) return rl

    const body = await request.json()
    const message: string          = (body.message ?? '').trim()
    const history: Message[]       = Array.isArray(body.conversationHistory) ? body.conversationHistory : []

    if (!message) return err('Message vide', 400)
    if (!process.env.ANTHROPIC_API_KEY) return err('ANTHROPIC_API_KEY manquante', 500)

    const now       = new Date()
    const currentMonth = format(now, 'MMMM yyyy', { locale: fr })
    const monthStart   = format(now, 'yyyy-MM-01')
    const todayStr     = format(now, 'yyyy-MM-dd')
    const qtr          = Math.floor(now.getMonth() / 3)
    const qtrStart     = `${now.getFullYear()}-${String(qtr * 3 + 1).padStart(2, '0')}-01`

    // Fetch contextual data in parallel
    const [
      { data: thisMonthInvoices },
      { data: unpaidInvoices },
      { data: tvaQtrRows },
      { data: recentClients },
      { data: alertRows },
    ] = await Promise.all([
      (supabase as any).from('invoices')
        .select('id, ht_amount, tva_amount, ttc_amount, status')
        .eq('company_id', co.id).gte('issue_date', monthStart)
        .lte('issue_date', todayStr).is('deleted_at', null),

      (supabase as any).from('invoices')
        .select('id, ttc_amount, due_date, clients(name)')
        .eq('company_id', co.id).eq('status', 'valid')
        .neq('payment_status', 'paid').is('deleted_at', null).limit(10),

      (supabase as any).from('invoices')
        .select('tva_amount')
        .eq('company_id', co.id).eq('status', 'valid')
        .gte('issue_date', qtrStart).is('deleted_at', null),

      (supabase as any).from('clients')
        .select('id, name').eq('company_id', co.id)
        .order('created_at', { ascending: false }).limit(5),

      (supabase as any).from('invoices')
        .select('id, number, status, issue_date')
        .eq('company_id', co.id).in('status', ['pending', 'rejected'])
        .is('deleted_at', null).limit(5),
    ])

    const inv = (thisMonthInvoices ?? []) as any[]
    const monthlyData = {
      totalHt:        inv.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0).toFixed(3),
      totalTva:       inv.reduce((s: number, i: any) => s + Number(i.tva_amount ?? 0), 0).toFixed(3),
      invoiceCount:   inv.length,
      validatedCount: inv.filter((i: any) => i.status === 'valid').length,
      rejectedCount:  inv.filter((i: any) => i.status === 'rejected').length,
    }

    const unpaidArr = (unpaidInvoices ?? []) as any[]
    const unpaidData = {
      count:    unpaidArr.length,
      totalTtc: unpaidArr.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0).toFixed(3),
    }

    const tvaQtr = (tvaQtrRows ?? []).reduce((s: number, i: any) => s + Number(i.tva_amount ?? 0), 0).toFixed(3)

    const alerts: string[] = []
    const pending = (alertRows ?? []).filter((i: any) => i.status === 'pending')
    const rejected= (alertRows ?? []).filter((i: any) => i.status === 'rejected')
    if (pending.length > 0)  alerts.push(`${pending.length} facture(s) en attente de soumission TTN`)
    if (rejected.length > 0) alerts.push(`${rejected.length} facture(s) rejetée(s) à corriger`)

    const overdueUnpaid = unpaidArr.filter((i: any) => i.due_date && i.due_date < todayStr)
    if (overdueUnpaid.length > 0) {
      const names = overdueUnpaid.slice(0, 3).map((i: any) => (i.clients as any)?.name ?? 'Client').join(', ')
      alerts.push(`${overdueUnpaid.length} facture(s) impayée(s) en retard : ${names}`)
    }

    const lastClient = ((recentClients ?? []) as any[])[0]?.name ?? 'votre dernier client'

    const systemPrompt = `Tu es "Fatoura AI", l'assistant fiscal intégré de Fatoura Pro.
Tu aides les entrepreneurs tunisiens à gérer leur facturation TTN et leur fiscalité.
Tu réponds toujours en français sauf si l'utilisateur écrit en arabe (répondre alors en arabe tunisien).
Sois concis, précis et actionnable. Maximum 3 paragraphes sauf si l'utilisateur demande plus de détails.

DONNÉES DE L'ENTREPRISE :
- Nom : ${co.name ?? 'Non défini'}
- Matricule fiscal : ${co.matricule_fiscal ?? 'Non renseigné'}
- Régime TVA : ${(co as any).tva_regime ?? 'Standard'}

DONNÉES DU MOIS EN COURS (${currentMonth}) :
- CA HT : ${monthlyData.totalHt} TND
- TVA collectée : ${monthlyData.totalTva} TND
- Factures émises : ${monthlyData.invoiceCount}
- Factures validées TTN : ${monthlyData.validatedCount}
- Factures rejetées : ${monthlyData.rejectedCount}
- Factures impayées : ${unpaidData.count} (${unpaidData.totalTtc} TND)

TVA CE TRIMESTRE T${qtr + 1} :
- Total TVA collectée : ${tvaQtr} TND

ALERTES ACTIVES :
${alerts.length > 0 ? alerts.map(a => `- ${a}`).join('\n') : '- Aucune alerte active'}

DERNIER CLIENT : ${lastClient}

CONTEXTE TVA TUNISIE :
- Taux TVA : 19% (standard), 13% (services spéciaux), 7% (réduit), 0% (exonéré)
- Droit de timbre : 0,600 TND par facture
- Déclaration mensuelle ou trimestrielle selon le régime
- Délai soumission TTN : dans les 7 jours suivant l'émission

RÈGLES STRICTES :
1. Ne jamais inventer des chiffres. Utiliser uniquement les données fournies ci-dessus.
2. Si l'utilisateur veut créer une facture, termine ta réponse par un bloc JSON séparé par "---ACTION---" :
   {"action":"create_invoice","data":{"client_name":"...","lines":[{"description":"...","quantity":1,"unit_price":0,"tva_rate":19}]}}
3. Pour les conseils fiscaux complexes, recommander un expert-comptable.
4. Ne jamais divulguer de données d'autres entreprises.
5. Si une question ne concerne pas la fiscalité/facturation, recentrer poliment.`

    const anthropicMessages = [
      ...history.slice(-10), // keep last 10 messages for context window
      { role: 'user' as const, content: message },
    ]

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('[AI] Anthropic error', anthropicRes.status, errBody)
      const msg = anthropicRes.status === 401
        ? 'Clé API Anthropic invalide ou absente.'
        : anthropicRes.status === 429
        ? 'Limite de requêtes atteinte. Réessayez dans quelques secondes.'
        : `Erreur Anthropic (${anthropicRes.status}). Réessayez.`
      return err(msg, 502)
    }

    const anthropicData = await anthropicRes.json()
    const rawContent: string = anthropicData.content?.[0]?.text ?? ''

    // Parse optional structured action
    let textContent = rawContent
    let action: Record<string, any> | null = null

    const actionSep = rawContent.indexOf('---ACTION---')
    if (actionSep !== -1) {
      textContent = rawContent.slice(0, actionSep).trim()
      try {
        const jsonStr = rawContent.slice(actionSep + 12).trim()
        action = JSON.parse(jsonStr)
      } catch { /* ignore malformed JSON */ }
    } else {
      // Also attempt to detect inline JSON block at end
      const jsonMatch = rawContent.match(/```json\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          if (parsed.action) {
            action = parsed
            textContent = rawContent.replace(jsonMatch[0], '').trim()
          }
        } catch { /* ignore */ }
      }
    }

    // Mark suggestions as read if user is engaging
    await (supabase as any).from('ai_suggestions')
      .update({ is_read: true })
      .eq('company_id', co.id).eq('is_read', false)

    return Response.json({ text: textContent, action })
  } catch (e: any) {
    return err(e.message, e.status ?? 500)
  }
}
