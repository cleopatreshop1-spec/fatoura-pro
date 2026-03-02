import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

interface AnomalyInsert {
  company_id: string
  invoice_id: string | null
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const results: { company_id: string; found: number }[] = []

  try {
    // Get all active companies
    const { data: companies } = await (supabase as any)
      .from('companies')
      .select('id, name')
      .limit(200)

    if (!companies?.length) {
      return Response.json({ message: 'No companies', results: [] })
    }

    // Clear today's anomalies before re-detecting (idempotent)
    const todayStr = new Date().toISOString().split('T')[0]
    await (supabase as any)
      .from('anomalies')
      .delete()
      .gte('created_at', `${todayStr}T00:00:00Z`)

    for (const company of companies as any[]) {
      const anomalies: AnomalyInsert[] = []
      const companyId: string = company.id

      // Fetch recent invoices — last 90 days
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const { data: invoices } = await (supabase as any)
        .from('invoices')
        .select('id, number, status, ttc_amount, ht_amount, issue_date, due_date, payment_date, payment_status, client_id, tva_amount, invoice_line_items(tva_rate)')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('issue_date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('number', { ascending: true })

      const rows = (invoices ?? []) as any[]
      const today = new Date()

      // RULE 1: Duplicates — same client + same TTC ± 1 TND + same month
      const seen = new Map<string, any>()
      for (const inv of rows) {
        const month = (inv.issue_date as string).slice(0, 7)
        const key = `${inv.client_id}:${month}:${Math.round(Number(inv.ttc_amount))}`
        if (seen.has(key)) {
          const other = seen.get(key)!
          anomalies.push({
            company_id: companyId,
            invoice_id: inv.id,
            type: 'duplicate',
            severity: 'high',
            message: `Doublon probable : ${inv.number} et ${other.number} — même client, même montant (${Number(inv.ttc_amount).toFixed(3)} TND), même mois`,
          })
        } else {
          seen.set(key, inv)
        }
      }

      // RULE 2: Unusual TVA rate for a client (different from last 3 invoices)
      const clientTvaHistory: Record<string, number[]> = {}
      const sortedByDate = [...rows].sort((a, b) =>
        (a.issue_date as string).localeCompare(b.issue_date as string)
      )
      for (const inv of sortedByDate) {
        const lines = (inv.invoice_line_items ?? []) as any[]
        if (lines.length === 0) continue
        const dominantRate = lines[0]?.tva_rate
        if (dominantRate == null) continue

        const hist = clientTvaHistory[inv.client_id] ?? []
        if (hist.length >= 3) {
          const lastThree = hist.slice(-3)
          const allSame = lastThree.every(r => r === lastThree[0])
          if (allSame && dominantRate !== lastThree[0]) {
            anomalies.push({
              company_id: companyId,
              invoice_id: inv.id,
              type: 'unusual_tva',
              severity: 'medium',
              message: `TVA inhabituelle sur ${inv.number} : taux ${dominantRate}% alors que les 3 dernières factures utilisaient ${lastThree[0]}%`,
            })
          }
        }
        clientTvaHistory[inv.client_id] = [...hist, dominantRate]
      }

      // RULE 3: Suspicious amount (> 3× average for this client)
      const clientAmounts: Record<string, number[]> = {}
      for (const inv of sortedByDate) {
        const amounts = clientAmounts[inv.client_id] ?? []
        if (amounts.length >= 3) {
          const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length
          if (Number(inv.ttc_amount) > avg * 3) {
            anomalies.push({
              company_id: companyId,
              invoice_id: inv.id,
              type: 'amount_suspect',
              severity: 'medium',
              message: `Montant suspect sur ${inv.number} : ${Number(inv.ttc_amount).toFixed(3)} TND est plus de 3× la moyenne client (${avg.toFixed(3)} TND)`,
            })
          }
        }
        clientAmounts[inv.client_id] = [...(clientAmounts[inv.client_id] ?? []), Number(inv.ttc_amount)]
      }

      // RULE 4: B2B clients without matricule fiscal — check all clients
      const { data: b2bClients } = await (supabase as any)
        .from('clients')
        .select('id, name, type, matricule_fiscal')
        .eq('company_id', companyId)
        .eq('type', 'entreprise')
        .is('matricule_fiscal', null)

      for (const client of (b2bClients ?? []) as any[]) {
        const clientInvoiceCount = rows.filter(
          (i: any) => i.client_id === client.id && i.status === 'valid'
        ).length
        if (clientInvoiceCount >= 3) {
          anomalies.push({
            company_id: companyId,
            invoice_id: null,
            type: 'missing_matricule',
            severity: 'high',
            message: `Client B2B "${client.name}" sans matricule fiscal — ${clientInvoiceCount} factures soumises TTN → risque de rejet`,
          })
        }
      }

      // RULE 5: Orphan unpaid invoices > 120 days
      for (const inv of rows) {
        if (inv.payment_status !== 'paid' && inv.status === 'valid' && inv.issue_date) {
          const daysSince = Math.floor(
            (today.getTime() - new Date(inv.issue_date).getTime()) / 86_400_000
          )
          if (daysSince > 120) {
            anomalies.push({
              company_id: companyId,
              invoice_id: inv.id,
              type: 'orphan_unpaid',
              severity: 'medium',
              message: `Facture ${inv.number} impayée depuis ${daysSince} jours (${Number(inv.ttc_amount).toFixed(3)} TND TTC) — aucune relance enregistrée`,
            })
          }
        }
      }

      // Batch insert anomalies for this company
      if (anomalies.length > 0) {
        await (supabase as any).from('anomalies').insert(anomalies)
      }

      results.push({ company_id: companyId, found: anomalies.length })
    }

    return Response.json({ message: 'Anomaly detection complete', results })

  } catch (error: any) {
    console.error('[detect-anomalies]', error?.message)
    return Response.json({ error: error?.message }, { status: 500 })
  }
}
