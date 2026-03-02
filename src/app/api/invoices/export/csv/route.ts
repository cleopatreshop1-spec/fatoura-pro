import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const limited = await applyRateLimit(rateLimiters.export, company.id)
    if (limited) return limited

    const sp  = new URL(request.url).searchParams
    const status   = sp.get('status')
    const from     = sp.get('from')
    const to       = sp.get('to')
    const clientId = sp.get('client_id')

    let q = (supabase as any)
      .from('invoices')
      .select('*, clients(name, matricule_fiscal)')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })

    if (status)   q = q.eq('status', status)
    if (clientId) q = q.eq('client_id', clientId)
    if (from)     q = q.gte('issue_date', from)
    if (to)       q = q.lte('issue_date', to)

    const { data: invoices, error } = await q
    if (error) return err(error.message, 500)

    const headers = [
      'N° Facture', 'Client', 'Matricule Client', 'Date', 'Échéance',
      'Total HT', 'TVA', 'Droit Timbre', 'Total TTC',
      'Statut', 'TTN_ID', 'Statut Paiement', 'Date Paiement',
    ]

    const fmt = (n: number | null | undefined) =>
      n != null ? String(Number(n).toFixed(3)).replace('.', ',') : '0,000'

    const rows = (invoices ?? []).map((inv: any) => [
      inv.number ?? '',
      inv.clients?.name ?? '',
      inv.clients?.matricule_fiscal ?? '',
      inv.issue_date ?? '',
      inv.due_date ?? '',
      fmt(inv.ht_amount),
      fmt(inv.tva_amount),
      fmt(inv.stamp_amount),
      fmt(inv.ttc_amount),
      inv.status ?? '',
      inv.ttn_id ?? '',
      inv.payment_status ?? 'unpaid',
      inv.payment_date ?? '',
    ])

    const escape = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v

    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map((r: string[]) => r.map(escape).join(',')),
    ]
    const csvString = '\uFEFF' + csvLines.join('\r\n')

    const dateRange = from && to ? `${from}_${to}` : new Date().toISOString().slice(0, 10)

    return new Response(csvString, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="factures_${dateRange}.csv"`,
      },
    })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
