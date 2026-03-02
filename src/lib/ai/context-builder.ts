import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

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

export type UserContext = {
  currentMonth: string
  monthStats: MonthStats
  unpaidInvoices: UnpaidInvoice[]
  pendingCount: number
}

export async function buildUserContext(
  supabase: SupabaseClient,
  companyId: string
): Promise<UserContext> {
  const now          = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr     = format(now, 'yyyy-MM-dd')

  const [
    { data: monthRows },
    { data: unpaidRows },
    { data: pendingRows },
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

  return {
    currentMonth: now.toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' }),
    monthStats,
    unpaidInvoices,
    pendingCount: (pendingRows ?? []).length,
  }
}

export function buildSystemPrompt(company: any, ctx: UserContext): string {
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

FORMAT ACTION (pour création de facture) :
Si l'utilisateur veut créer une facture, inclure À LA FIN de ta réponse :
ACTION:CREATE_INVOICE:{"client_name":"...","lines":[{"description":"...","quantity":1,"unit_price":500,"tva_rate":19}]}

Ne jamais inclure des données d'autres entreprises dans tes réponses.`.trim()
}
