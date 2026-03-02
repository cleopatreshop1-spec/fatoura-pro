import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'
import { linearRegression } from 'simple-statistics'

export const maxDuration = 15

type ForecastMonth = {
  period: string
  predicted: number
  low: number
  high: number
  confidence: number
}

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const plan = await getCompanyPlan(supabase as any, co.id)
    if (!canUseFeature(plan, 'forecast')) return upgradeRequiredResponse('forecast')

    // Fetch monthly snapshots — last 18 months
    const { data: snapshots } = await (supabase as any)
      .from('monthly_snapshots')
      .select('period, ca_ht')
      .eq('company_id', co.id)
      .order('period', { ascending: true })
      .limit(18)

    // Fallback: compute from invoices if no snapshots table
    let dataPoints: { period: string; ca_ht: number }[] = []

    if (snapshots && snapshots.length >= 3) {
      dataPoints = snapshots.map((s: any) => ({
        period: s.period,
        ca_ht: Number(s.ca_ht ?? 0),
      }))
    } else {
      // Build from invoices grouped by month
      const eighteenMonthsAgo = new Date()
      eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18)
      const { data: invoices } = await (supabase as any)
        .from('invoices')
        .select('issue_date, ht_amount')
        .eq('company_id', co.id)
        .eq('status', 'valid')
        .is('deleted_at', null)
        .gte('issue_date', eighteenMonthsAgo.toISOString().split('T')[0])
        .order('issue_date', { ascending: true })

      if (!invoices || invoices.length === 0) {
        return Response.json({ available: false, reason: "Pas assez d'historique (min 3 mois)" })
      }

      const byMonth: Record<string, number> = {}
      for (const inv of invoices as any[]) {
        const month = (inv.issue_date as string).slice(0, 7) // YYYY-MM
        byMonth[month] = (byMonth[month] ?? 0) + Number(inv.ht_amount ?? 0)
      }

      dataPoints = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, ca_ht]) => ({ period: `${period}-01`, ca_ht }))
    }

    if (dataPoints.length < 3) {
      return Response.json({ available: false, reason: "Pas assez d'historique (min 3 mois)" })
    }

    const y = dataPoints.map(d => d.ca_ht)
    const x = dataPoints.map((_, i) => i)
    const pairs: [number, number][] = x.map((xi, i) => [xi, y[i]])

    const reg = linearRegression(pairs)

    // Standard deviation of residuals for confidence interval
    const residuals = y.map((yi, i) => yi - (reg.m * i + reg.b))
    const variance  = residuals.reduce((s, r) => s + r * r, 0) / residuals.length
    const std       = Math.sqrt(variance)
    const ci80      = 1.28 * std

    // Predict next 3 months
    const lastPeriod = new Date(dataPoints[dataPoints.length - 1].period)
    const forecasts: ForecastMonth[] = [1, 2, 3].map(offset => {
      const nextX     = dataPoints.length + offset - 1
      const predicted = reg.m * nextX + reg.b

      const forecastDate = new Date(lastPeriod)
      forecastDate.setMonth(forecastDate.getMonth() + offset)

      const baseForConfidence = Math.abs(reg.b) > 1 ? reg.b : 1
      const confidence = Math.min(95, Math.max(40, Math.round(100 - (std / baseForConfidence) * 100)))

      return {
        period:     forecastDate.toISOString().split('T')[0].slice(0, 7) + '-01',
        predicted:  Math.max(0, Math.round(predicted)),
        low:        Math.max(0, Math.round(predicted - ci80)),
        high:       Math.round(predicted + ci80),
        confidence,
      }
    })

    const trend: 'hausse' | 'baisse' | 'stable' =
      reg.m > 100 ? 'hausse' : reg.m < -100 ? 'baisse' : 'stable'

    return Response.json({
      available: true,
      forecasts,
      historicalData: dataPoints,
      trend,
      monthsOfData: dataPoints.length,
    })

  } catch (error: any) {
    return err(error.message ?? 'Erreur interne', error.status ?? 500)
  }
}
