import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

const contextCache = new Map<string, {
  data:      UserContext
  expiresAt: number
}>()

const CACHE_TTL_MS = 5 * 60 * 1000

export type MonthStats = {
  totalHt: number
  totalTva: number
  totalTtc: number
  count: number
  validatedCount: number
  rejectedCount: number
}

export type UnpaidInvoice = {
  number: string | null
  ttc: number
  due_date: string | null
  clientName: string | null
}

export type ClientSummary = {
  id: string
  name: string
  matricule_fiscal: string | null
}

export type UserContext = {
  currentMonth: string
  monthStats: MonthStats
  unpaidInvoices: UnpaidInvoice[]
  pendingCount: number
  clients: ClientSummary[]
  today: string
}

export function invalidateUserContext(companyId: string): void {
  contextCache.delete(companyId)
}

export async function buildUserContext(
  supabase: SupabaseClient,
  companyId: string
): Promise<UserContext> {
  const cached = contextCache.get(companyId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  console.log('[AI Context] Building for company:', companyId)

  const now          = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr     = format(now, 'yyyy-MM-dd')

  const [
    { data: monthRows,  error: monthErr  },
    { data: unpaidRows },
    { data: pendingRows },
    { data: clientRows, error: clientErr },
  ] = await Promise.all([
    (supabase as any).from('invoices')
      .select('status, ht_amount, tva_amount, ttc_amount, payment_status')
      .eq('company_id', companyId)
      .gte('issue_date', firstOfMonth)
      .lte('issue_date', todayStr)
      .is('deleted_at', null),

    (supabase as any).from('invoices')
      .select('number, ttc_amount, due_date, clients(name)')
      .eq('company_id', companyId)
      .eq('payment_status', 'unpaid')
      .eq('status', 'valid')
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .limit(5),

    (supabase as any).from('invoices')
      .select('id')
      .eq('company_id', companyId)
      .in('status', ['draft', 'rejected'])
      .is('deleted_at', null),

    (supabase as any).from('clients')
      .select('id, name, matricule_fiscal')
      .eq('company_id', companyId)
      .order('name')
      .limit(50),
  ])

  const monthStats = (monthRows ?? []).reduce(
    (acc: MonthStats, inv: any) => {
      acc.totalHt  += Number(inv.ht_amount  ?? 0)
      acc.totalTva += Number(inv.tva_amount ?? 0)
      acc.totalTtc += Number(inv.ttc_amount ?? 0)
      acc.count    += 1
      if (inv.status === 'valid')    acc.validatedCount += 1
      if (inv.status === 'rejected') acc.rejectedCount  += 1
      return acc
    },
    { totalHt: 0, totalTva: 0, totalTtc: 0, count: 0, validatedCount: 0, rejectedCount: 0 }
  )

  const unpaidInvoices: UnpaidInvoice[] = (unpaidRows ?? []).map((i: any) => ({
    number:     i.number ?? null,
    ttc:        Number(i.ttc_amount ?? 0),
    due_date:   i.due_date ?? null,
    clientName: (i.clients as any)?.name ?? null,
  }))

  console.log('[AI Context] Month rows:', monthRows?.length ?? 0, 'error:', monthErr?.message ?? null)
  console.log('[AI Context] Clients:', clientRows?.length ?? 0, 'error:', clientErr?.message ?? null)

  const clients: ClientSummary[] = (clientRows ?? []).map((c: any) => ({
    id:               c.id,
    name:             c.name,
    matricule_fiscal: c.matricule_fiscal ?? null,
  }))

  const result: UserContext = {
    currentMonth: now.toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' }),
    monthStats,
    unpaidInvoices,
    pendingCount: (pendingRows ?? []).length,
    clients,
    today: todayStr,
  }

  contextCache.set(companyId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })

  return result
}

export function buildSystemPrompt(company: any, ctx: UserContext): string {
  const clientsList = ctx.clients.length > 0
    ? ctx.clients
        .map(c => `- "${c.name}"${c.matricule_fiscal ? ` (${c.matricule_fiscal})` : ''}`)
        .join('\n')
    : 'Aucun client enregistré'
  const unpaidList = ctx.unpaidInvoices.length > 0
    ? ctx.unpaidInvoices
        .map(i => `${i.clientName ?? 'Client'}: ${i.ttc.toFixed(3)} TND`)
        .join(', ')
    : 'Aucune'

  return `Tu es "Fatoura AI", l'assistant fiscal intégré de Fatoura Pro.
Tu aides les entrepreneurs tunisiens à gérer leur facturation TTN et leur fiscalité.
Sois concis, pratique et chaleureux.

RÈGLE DE LANGUE : Réponds en français par défaut. Si l'utilisateur écrit en arabe tunisien, réponds en arabe tunisien.

DONNÉES DE L'ENTREPRISE :
- Nom : ${company.name ?? 'Non défini'}
- Matricule fiscal : ${company.matricule_fiscal ?? 'Non renseigné'}
- Régime TVA : ${company.tva_regime ?? 'Réel'}

DONNÉES DE ${ctx.currentMonth.toUpperCase()} :
- Chiffre d'affaires HT : ${ctx.monthStats.totalHt.toFixed(3)} TND
- TVA collectée : ${ctx.monthStats.totalTva.toFixed(3)} TND
- Factures émises : ${ctx.monthStats.count}
- Validées TTN : ${ctx.monthStats.validatedCount}
- Rejetées : ${ctx.monthStats.rejectedCount}

ALERTES :
- Factures impayées : ${ctx.unpaidInvoices.length} (${unpaidList})
- Brouillons/rejetés non traités : ${ctx.pendingCount}

FISCALITÉ TUNISIENNE — Données de référence :
- TVA : 19% (standard), 13% (services spéciaux), 7% (réduit), 0% (exonéré)
- Droit de timbre : 0,600 TND fixe par facture
- Format matricule fiscal : 1234567A/A/M/000
- Déclaration TVA : mensuelle (régime réel) ou trimestrielle
- Pénalité facture non conforme : 100-500 TND par facture
- Plateforme TTN/ElFatoora : obligatoire depuis Loi de Finances 2026

RÈGLES STRICTES :
1. Utiliser UNIQUEMENT les données fournies ci-dessus. Ne jamais inventer de chiffres.
2. Pour créer une facture, structurer ta réponse avec un bloc JSON ACTION.
3. Pour les conseils fiscaux complexes ou légaux, recommander un expert-comptable.
4. Reformater les montants en format tunisien : 1 234,500 TND
5. Réponses courtes et actionnables — max 3-4 phrases sauf si question complexe.

CAPACITÉS D'ACTION :
Tu peux créer de vraies factures dans Fatoura Pro.
Quand l'utilisateur demande de créer une facture, réponds en texte naturel PUIS ajoute ce bloc EXACTEMENT :

%%ACTION%%
{"type":"CREATE_INVOICE","data":{"client_name":"nom du client","client_matricule":null,"lines":[{"description":"description","quantity":1,"unit_price":500,"tva_rate":19}],"invoice_date":"${ctx.today}","notes":null,"confidence":90}}
%%END_ACTION%%

RÈGLES ACTIONS :
- Utilise %%ACTION%% SEULEMENT si l'utilisateur demande EXPLICITEMENT de créer une facture (mots : "crée", "aamel", "nouvelle facture", "facture pour", "facturer")
- Si client OU montant manque, pose UNE question avant de retourner l'action
- invoice_date = toujours "${ctx.today}"
- tva_rate = 19 par défaut sauf précision explicite
- unit_price = 0 si non mentionné (jamais null)
- confidence = 100 si tout est clair, moins si tu as deviné
- Si le nom correspond à un client de la liste ci-dessous, utilise son nom EXACT

CLIENTS EXISTANTS :
${clientsList}

Ne jamais inclure des données d'autres entreprises dans tes réponses.`.trim()
}
