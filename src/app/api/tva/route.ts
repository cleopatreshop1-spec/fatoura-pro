import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'
import { STAMP_DUTY } from '@/lib/utils/tva-calculator'

const MONTHS_FR = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec']

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const sp   = new URL(request.url).searchParams
    const from = sp.get('from')
    const to   = sp.get('to')

    if (!from || !to) return err('Parametres from et to requis (ISO date)', 400)

    const { data: invoices, error } = await (supabase as any)
      .from('invoices')
      .select('id, issue_date, ht_amount, tva_amount, ttc_amount, invoice_line_items(tva_rate, line_ht, line_tva)')
      .eq('company_id', company.id)
      .eq('status', 'valid')
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date')

    if (error) return err(error.message, 500)

    const list = (invoices ?? []) as any[]

    // Aggregation by TVA rate (from line items)
    const rateMap: Record<number, { base: number; tva: number; count: number }> = { 19: { base:0,tva:0,count:0 }, 13: { base:0,tva:0,count:0 }, 7: { base:0,tva:0,count:0 }, 0: { base:0,tva:0,count:0 } }
    const monthMap: Record<string, { totalHT: number; totalTVA: number; count: number }> = {}

    for (const inv of list) {
      for (const line of (inv.invoice_line_items ?? []) as any[]) {
        const r = Number(line.tva_rate ?? 19)
        if (!rateMap[r]) rateMap[r] = { base: 0, tva: 0, count: 0 }
        rateMap[r].base  += Number(line.line_ht  ?? 0)
        rateMap[r].tva   += Number(line.line_tva ?? 0)
        rateMap[r].count += 1
      }
      const m = (inv.issue_date ?? '').slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { totalHT: 0, totalTVA: 0, count: 0 }
      monthMap[m].totalHT  += Number(inv.ht_amount  ?? 0)
      monthMap[m].totalTVA += Number(inv.tva_amount ?? 0)
      monthMap[m].count    += 1
    }

    const totalHT  = list.reduce((s, i) => s + Number(i.ht_amount  ?? 0), 0)
    const totalTVA = list.reduce((s, i) => s + Number(i.tva_amount ?? 0), 0)
    const totalTTC = list.reduce((s, i) => s + Number(i.ttc_amount ?? 0), 0)

    const byRate = [19, 13, 7, 0].map(rate => ({
      rate,
      baseHT:    Math.round((rateMap[rate]?.base ?? 0) * 1000) / 1000,
      tvaAmount: Math.round((rateMap[rate]?.tva  ?? 0) * 1000) / 1000,
      count:     rateMap[rate]?.count ?? 0,
    }))

    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => {
        const [y, m] = month.split('-')
        const label = `${MONTHS_FR[Number(m) - 1]} ${y}`
        return { month, label, totalHT: Math.round(d.totalHT * 1000) / 1000, totalTVA: Math.round(d.totalTVA * 1000) / 1000, count: d.count }
      })

    return success({
      totalHT:     Math.round(totalHT  * 1000) / 1000,
      totalTVA:    Math.round(totalTVA * 1000) / 1000,
      totalTTC:    Math.round(totalTTC * 1000) / 1000,
      invoiceCount: list.length,
      stampDuty:   Math.round(list.length * STAMP_DUTY * 1000) / 1000,
      byRate,
      byMonth,
    })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
