import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'
import { differenceInDays, addDays } from 'date-fns'

export const maxDuration = 15

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params
    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const plan = await getCompanyPlan(supabase as any, co.id)
    if (!canUseFeature(plan, 'payment_prediction')) {
      return upgradeRequiredResponse('payment_prediction')
    }

    // Verify client belongs to this company
    const { data: client } = await (supabase as any)
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .eq('company_id', co.id)
      .single()

    if (!client) return err('Client introuvable', 404)

    // Fetch payment history — last 24 invoices (≈ 2 years)
    const { data: history } = await (supabase as any)
      .from('invoices')
      .select('invoice_date, due_date, payment_date, payment_status, ttc_amount')
      .eq('client_id', clientId)
      .eq('company_id', co.id)
      .eq('status', 'valid')
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false })
      .limit(24)

    const rows = (history ?? []) as any[]
    const today = new Date()

    const paid = rows.filter((i: any) => i.payment_status === 'paid' && i.payment_date)
    const overdue = rows.filter((i: any) =>
      i.payment_status !== 'paid' &&
      i.due_date &&
      new Date(i.due_date) < today
    )

    // Average days from invoice_date → payment_date
    let avgPaymentDays: number | null = null
    if (paid.length > 0) {
      const total = paid.reduce((sum: number, i: any) => {
        return sum + differenceInDays(new Date(i.payment_date), new Date(i.invoice_date))
      }, 0)
      avgPaymentDays = Math.round(total / paid.length)
    }

    // On-time rate = paid before or on due_date
    let onTimeRate: number | null = null
    if (paid.length > 0) {
      const onTime = paid.filter(
        (i: any) => i.due_date && new Date(i.payment_date) <= new Date(i.due_date)
      ).length
      onTimeRate = onTime / paid.length
    }

    // Risk level
    const riskLevel: 'high' | 'medium' | 'low' =
      overdue.length >= 2                             ? 'high'   :
      overdue.length === 1                            ? 'medium' :
      onTimeRate !== null && onTimeRate < 0.5         ? 'medium' :
      'low'

    // Estimated payment date for current unpaid invoice
    // Use latest unpaid invoice's invoice_date + avgPaymentDays
    const latestUnpaid = rows.find((i: any) => i.payment_status !== 'paid')
    const estimatedPaymentDate = avgPaymentDays !== null && latestUnpaid
      ? addDays(new Date(latestUnpaid.invoice_date), avgPaymentDays).toISOString().split('T')[0]
      : null

    return Response.json({
      clientId,
      clientName: client.name,
      avgPaymentDays,
      onTimeRate,
      overdueCount: overdue.length,
      riskLevel,
      estimatedPaymentDate,
      invoiceCount: rows.length,
      paidCount: paid.length,
    })

  } catch (error: any) {
    return err(error.message ?? 'Erreur interne', error.status ?? 500)
  }
}
