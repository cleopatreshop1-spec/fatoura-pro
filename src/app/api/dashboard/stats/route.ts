import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'
import { format, subDays, addDays, eachWeekOfInterval, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'

export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const cid = company.id
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()

    const todayStr      = format(now, 'yyyy-MM-dd')
    const monthStart    = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const prevM         = m === 0 ? 11 : m - 1
    const prevY         = m === 0 ? y - 1 : y
    const prevStart     = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`
    const prevEnd       = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const qtr           = Math.floor(m / 3)
    const qtrStart      = `${y}-${String(qtr * 3 + 1).padStart(2, '0')}-01`
    const in90          = format(addDays(now, 90), 'yyyy-MM-dd')
    const ago90         = format(subDays(now, 90), 'yyyy-MM-dd')
    const ago30         = format(subDays(now, 30), 'yyyy-MM-dd')
    const ago7          = format(subDays(now, 7), 'yyyy-MM-dd')

    const [
      { data: thisMonthInvoices },
      { data: prevMonthInvoices },
      { data: unpaidValid },
      { data: paidThisMonth },
      { data: paidLastMonth },
      { data: validQtr },
      { data: allInvoices },
      { data: upcomingDue },
      { data: recentPaid },
      { data: companyData },
    ] = await Promise.all([
      // This month all invoices
      (supabase as any).from('invoices')
        .select('id, ht_amount, tva_amount, ttc_amount, status, payment_status, issue_date, created_at, validated_at')
        .eq('company_id', cid).gte('issue_date', monthStart).lte('issue_date', todayStr)
        .is('deleted_at', null),

      // Prev month invoices
      (supabase as any).from('invoices')
        .select('id, ht_amount, status')
        .eq('company_id', cid).gte('issue_date', prevStart).lt('issue_date', prevEnd)
        .is('deleted_at', null),

      // Unpaid valid invoices (À encaisser)
      (supabase as any).from('invoices')
        .select('id, ttc_amount, due_date, payment_status')
        .eq('company_id', cid).eq('status', 'valid').neq('payment_status', 'paid')
        .is('deleted_at', null),

      // Paid this month
      (supabase as any).from('invoices')
        .select('id, ttc_amount, payment_date')
        .eq('company_id', cid).eq('payment_status', 'paid')
        .gte('payment_date', monthStart).lte('payment_date', todayStr)
        .is('deleted_at', null),

      // Paid last month (for avg daily rate)
      (supabase as any).from('invoices')
        .select('id, ttc_amount')
        .eq('company_id', cid).eq('payment_status', 'paid')
        .gte('payment_date', prevStart).lt('payment_date', prevEnd)
        .is('deleted_at', null),

      // Valid this quarter (TVA)
      (supabase as any).from('invoices')
        .select('tva_amount, ht_amount')
        .eq('company_id', cid).eq('status', 'valid')
        .gte('issue_date', qtrStart).is('deleted_at', null),

      // All invoices last 90 days (for fiscal score + chart)
      (supabase as any).from('invoices')
        .select('id, status, payment_status, issue_date, created_at, validated_at, due_date, payment_date, ttc_amount, ht_amount')
        .eq('company_id', cid).gte('issue_date', ago90).is('deleted_at', null),

      // Upcoming due dates (next 90 days)
      (supabase as any).from('invoices')
        .select('id, ttc_amount, due_date')
        .eq('company_id', cid).eq('status', 'valid').neq('payment_status', 'paid')
        .gte('due_date', todayStr).lte('due_date', in90)
        .is('deleted_at', null),

      // Recently paid (last 30 days) for cashflow chart
      (supabase as any).from('invoices')
        .select('id, ttc_amount, payment_date')
        .eq('company_id', cid).eq('payment_status', 'paid')
        .gte('payment_date', ago30).lte('payment_date', todayStr)
        .is('deleted_at', null),

      // Company profile completeness
      (supabase as any).from('companies')
        .select('matricule_fiscal, address, logo_url, bank_rib, name')
        .eq('id', cid).single(),
    ])

    // ── KPIs ──────────────────────────────────────────────────────────────
    const thisValidInvoices = (thisMonthInvoices ?? []).filter((i: any) => i.status === 'valid')
    const caHT    = thisValidInvoices.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const prevCaHT= (prevMonthInvoices ?? []).filter((i: any) => i.status === 'valid')
                      .reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
    const caTrend = prevCaHT > 0 ? Math.round(((caHT - prevCaHT) / prevCaHT) * 100) : null

    const tvaQtr         = (validQtr ?? []).reduce((s: number, i: any) => s + Number(i.tva_amount ?? 0), 0)
    const validThisMonth = thisValidInvoices.length
    const paidThisMonthAmt = (paidThisMonth ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)

    const unpaidTotal = (unpaidValid ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
    const unpaidCount = (unpaidValid ?? []).length

    // Average days overdue for unpaid invoices
    const overdueInvoices = (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < todayStr)
    const avgOverdueDays = overdueInvoices.length > 0
      ? Math.round(overdueInvoices.reduce((s: number, i: any) =>
          s + Math.max(0, Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000)), 0)
          / overdueInvoices.length)
      : 0

    // ── À encaisser + trésorerie 30j ─────────────────────────────────────
    const dailyRate = (paidLastMonth ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0) / 30
    const dueNext30 = (upcomingDue ?? [])
      .filter((i: any) => i.due_date <= format(addDays(now, 30), 'yyyy-MM-dd'))
      .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
    const treasury30 = dailyRate * 30 + dueNext30

    // ── Cashflow chart (weekly buckets, last 90 days + next 30 days) ──────
    const weeks90Start = subDays(now, 90)
    const weeks30End   = addDays(now, 30)
    const weekStarts   = eachWeekOfInterval({ start: weeks90Start, end: weeks30End }, { weekStartsOn: 1 })

    const cashflowData = weekStarts.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const wStartStr = format(weekStart, 'yyyy-MM-dd')
      const wEndStr   = format(weekEnd,   'yyyy-MM-dd')
      const label     = format(weekStart, 'd MMM', { locale: fr })
      const isPast    = weekEnd < now

      const encaisse = isPast
        ? (recentPaid ?? [])
            .filter((i: any) => i.payment_date >= wStartStr && i.payment_date <= wEndStr)
            .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
        : null

      const attendu = !isPast
        ? (upcomingDue ?? [])
            .filter((i: any) => i.due_date >= wStartStr && i.due_date <= wEndStr)
            .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
        : null

      return { date: wStartStr, label, encaisse, attendu }
    })

    // Simple linear trend over past 8 weeks
    const pastWeeks = cashflowData.filter(w => w.encaisse !== null).slice(-8)
    let tendance: (number | null)[] = cashflowData.map(() => null)
    if (pastWeeks.length >= 2) {
      const avg = pastWeeks.reduce((s, w) => s + (w.encaisse ?? 0), 0) / pastWeeks.length
      const trend = (pastWeeks[pastWeeks.length - 1].encaisse ?? 0) - (pastWeeks[0].encaisse ?? 0)
      const weeklyGrowth = pastWeeks.length > 1 ? trend / (pastWeeks.length - 1) : 0
      let lastVal = avg
      tendance = cashflowData.map((w, i) => {
        const t = lastVal
        lastVal += weeklyGrowth * 0.5
        return Math.max(0, Math.round(t))
      })
    }

    const chartData = cashflowData.map((w, i) => ({
      ...w,
      tendance: tendance[i],
    }))

    // ── Fiscal Health Score ───────────────────────────────────────────────
    const allInvArr = (allInvoices ?? []) as any[]
    const totalCreated = allInvArr.length

    // A: TTN submission within 7 days (40 pts)
    const submittedFast = allInvArr.filter(i =>
      i.validated_at && i.created_at &&
      differenceInDaysRaw(i.created_at, i.validated_at) <= 7
    ).length
    const scoreA = totalCreated > 0 ? (submittedFast / totalCreated) * 40 : 20

    // B: First-time validation rate (30 pts)
    const submitted = allInvArr.filter(i => ['valid', 'rejected'].includes(i.status)).length
    const validated = allInvArr.filter(i => i.status === 'valid').length
    const scoreB = submitted > 0 ? (validated / submitted) * 30 : 15

    // C: On-time payment rate (20 pts)
    const paidInvs = allInvArr.filter(i => i.payment_status === 'paid' && i.payment_date && i.due_date)
    const paidOnTime = paidInvs.filter(i => i.payment_date <= i.due_date).length
    const scoreC = paidInvs.length > 0 ? (paidOnTime / paidInvs.length) * 20 : 10

    // D: Profile completeness (10 pts)
    const co = companyData as any
    const fields = [co?.matricule_fiscal, co?.address, co?.logo_url, co?.bank_rib]
    const scoreD = (fields.filter(Boolean).length / 4) * 10

    const score = Math.round(scoreA + scoreB + scoreC + scoreD)
    const grade = score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D'
    const scoreColor = score >= 90 ? '#2dd4a0' : score >= 75 ? '#d4a843' : score >= 55 ? '#4a9eff' : score >= 35 ? '#f59e0b' : '#e05a5a'

    // ── New user check ───────────────────────────────────────────────────
    const isNewUser = totalCreated < 5

    return success({
      kpis: {
        caHT, caTrend, validThisMonth,
        tvaQtr, qtr: qtr + 1, year: y,
        unpaidTotal, unpaidCount, avgOverdueDays,
        paidThisMonth: paidThisMonthAmt,
      },
      hero: {
        unpaidTotal, unpaidCount, treasury30, isNewUser,
      },
      cashflow: chartData,
      fiscalScore: { score, grade, scoreColor, scoreA, scoreB, scoreC, scoreD },
      companyName: co?.name ?? '',
    })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}

function differenceInDaysRaw(from: string, to: string): number {
  try {
    const a = parseISO(from)
    const b = parseISO(to)
    if (!isValid(a) || !isValid(b)) return 999
    return Math.abs(Math.floor((b.getTime() - a.getTime()) / 86400000))
  } catch { return 999 }
}
