export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RealtimeProvider } from '@/components/dashboard/RealtimeProvider'
import { PaymentSuccessToast } from '@/components/billing/PaymentSuccessToast'
import { HeroWidget } from '@/components/dashboard/HeroWidget'
import { KpiCards } from '@/components/dashboard/KpiCards'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { FiscalHealthScore } from '@/components/dashboard/FiscalHealthScore'
import { RemindersPanel } from '@/components/dashboard/RemindersPanel'
import { AIInsightsPanel } from '@/components/dashboard/AIInsightsPanel'
import { RecentInvoicesTable } from '@/components/dashboard/RecentInvoicesTable'
import type { InvoiceTableRow } from '@/components/dashboard/RecentInvoicesTable'
import { InvoiceAgingReport } from '@/components/dashboard/InvoiceAgingReport'
import { ProfitLossWidget } from '@/components/dashboard/ProfitLossWidget'
import { TopClientsWidget } from '@/components/dashboard/TopClientsWidget'
import { RevenueComparisonChart } from '@/components/dashboard/RevenueComparisonChart'
import { ExpenseCategoryDonut } from '@/components/dashboard/ExpenseCategoryDonut'
import { RevenueGoalWidget } from '@/components/dashboard/RevenueGoalWidget'
import { PendingActionsWidget } from '@/components/dashboard/PendingActionsWidget'
import { InvoiceStatusDonut } from '@/components/dashboard/InvoiceStatusDonut'
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed'
import type { ActivityItem } from '@/components/dashboard/RecentActivityFeed'
import { format, subDays, addDays, parseISO, endOfWeek, eachWeekOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, matricule_fiscal, address, logo_url, bank_rib, monthly_revenue_goal, annual_revenue_goal')
    .eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1)
  const company: any = (companies as any)?.[0]
  const companyId: string | undefined = company?.id

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="text-4xl">🏢</div>
          <p className="text-gray-400 text-sm">Aucune société configurée.</p>
          <a href="/register/company" className="text-[#d4a843] hover:underline text-sm">Créer mon entreprise</a>
        </div>
      </div>
    )
  }

  const now       = new Date()
  const y         = now.getFullYear()
  const m         = now.getMonth()
  const todayStr  = format(now, 'yyyy-MM-dd')
  const monthStart= `${y}-${String(m + 1).padStart(2, '0')}-01`
  const prevM     = m === 0 ? 11 : m - 1
  const prevY     = m === 0 ? y - 1 : y
  const prevStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`
  const prevEnd   = monthStart
  const qtr       = Math.floor(m / 3)
  const qtrStart  = `${y}-${String(qtr * 3 + 1).padStart(2, '0')}-01`
  const ago90     = format(subDays(now, 90), 'yyyy-MM-dd')
  const ago30     = format(subDays(now, 30), 'yyyy-MM-dd')
  const ago14     = format(subDays(now, 14), 'yyyy-MM-dd')
  const in90      = format(addDays(now, 90), 'yyyy-MM-dd')

  const db = supabase as any

  const [
    r_thisMonthV, r_thisMonthVld,
    r_prevMonthV, r_prevMonthVld,
    r_unpaidValid,
    r_paidThisMonth,
    r_paidLastMonth,
    r_tvaQtrV, r_tvaQtrVld,
    r_recent,
    r_all90,
    r_upcomingDue,
    r_recentPaid,
    r_expenses,
    r_expenses6m,
    r_clients,
    r_expensesPrev,
  ] = await Promise.all([
    db.from('invoices').select('id, ht_amount, status, issue_date, created_at').eq('company_id', companyId).eq('status', 'valid').is('deleted_at', null),
    db.from('invoices').select('id, ht_amount, status, issue_date, created_at').eq('company_id', companyId).eq('status', 'validated').is('deleted_at', null),
    db.from('invoices').select('id, ht_amount, issue_date, created_at').eq('company_id', companyId).eq('status', 'valid').is('deleted_at', null),
    db.from('invoices').select('id, ht_amount, issue_date, created_at').eq('company_id', companyId).eq('status', 'validated').is('deleted_at', null),
    db.from('invoices').select('id, ttc_amount, due_date, payment_status').eq('company_id', companyId).in('status', ['valid', 'validated']).neq('payment_status', 'paid').is('deleted_at', null),
    db.from('invoices').select('id, ttc_amount, payment_date').eq('company_id', companyId).eq('payment_status', 'paid').gte('payment_date', monthStart).lte('payment_date', todayStr).is('deleted_at', null),
    db.from('invoices').select('id, ttc_amount').eq('company_id', companyId).eq('payment_status', 'paid').gte('payment_date', prevStart).lt('payment_date', prevEnd).is('deleted_at', null),
    db.from('invoices').select('tva_amount, issue_date, created_at').eq('company_id', companyId).eq('status', 'valid').is('deleted_at', null),
    db.from('invoices').select('tva_amount, issue_date, created_at').eq('company_id', companyId).eq('status', 'validated').is('deleted_at', null),
    db.from('invoices').select('id, number, status, issue_date, ttc_amount, payment_status, clients(name)').eq('company_id', companyId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    db.from('invoices').select('id, status, payment_status, issue_date, created_at, validated_at, due_date, payment_date, ttc_amount, ht_amount').eq('company_id', companyId).gte('created_at', ago90).is('deleted_at', null),
    db.from('invoices').select('id, ttc_amount, due_date').eq('company_id', companyId).in('status', ['valid', 'validated']).neq('payment_status', 'paid').gte('due_date', todayStr).lte('due_date', in90).is('deleted_at', null),
    db.from('invoices').select('id, ttc_amount, payment_date').eq('company_id', companyId).eq('payment_status', 'paid').gte('payment_date', ago90).lte('payment_date', todayStr).is('deleted_at', null),
    db.from('expenses').select('amount, category, date').eq('company_id', companyId).gte('date', monthStart).lte('date', todayStr),
    db.from('expenses').select('amount, date').eq('company_id', companyId).gte('date', format(subDays(now, 180), 'yyyy-MM-dd')).lte('date', todayStr),
    db.from('invoices').select('client_id, ttc_amount, payment_status, clients(id, name)').eq('company_id', companyId).in('status', ['valid','validated']).is('deleted_at', null),
    db.from('expenses').select('amount').eq('company_id', companyId).gte('date', prevStart).lt('date', prevEnd),
  ])

  const thisMonthValid  = [...(r_thisMonthV.data ?? []),   ...(r_thisMonthVld.data ?? [])]
  const prevMonthValid  = [...(r_prevMonthV.data ?? []),   ...(r_prevMonthVld.data ?? [])]
  const unpaidValid     = r_unpaidValid.data    ?? []
  const paidThisMonth   = r_paidThisMonth.data  ?? []
  const paidLastMonth   = r_paidLastMonth.data  ?? []
  const tvaQtrRows      = [...(r_tvaQtrV.data ?? []),      ...(r_tvaQtrVld.data ?? [])]
  const recentRaw       = r_recent.data         ?? []
  const allInvoices90   = r_all90.data          ?? []
  const upcomingDue     = r_upcomingDue.data     ?? []
  const recentPaid30    = r_recentPaid.data      ?? []
  const expensesMonth   = r_expenses.data        ?? []
  const expenses6mRaw   = r_expenses6m.data       ?? []
  const clientInvRaw    = r_clients.data          ?? []
  const expensesPrevMonth = r_expensesPrev.data   ?? []

  // ── KPIs ──────────────────────────────────────────────────────────────
  // Use issue_date when set, fall back to created_at (handles invoices saved without a date)
  const invDate = (i: any) => (i.issue_date ?? i.created_at ?? '').slice(0, 10)
  const caHT       = (thisMonthValid ?? []).filter((i: any) => { const d = invDate(i); return d >= monthStart && d <= todayStr }).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
  const prevCaHT   = (prevMonthValid  ?? []).filter((i: any) => { const d = invDate(i); return d >= prevStart && d < prevEnd  }).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
  const caTrend    = prevCaHT > 0 ? Math.round(((caHT - prevCaHT) / prevCaHT) * 100) : null
  const ytdStart   = `${y}-01-01`
  const ytdAll     = [...(r_thisMonthV.data ?? []), ...(r_thisMonthVld.data ?? [])]
  const ytdFiltered = ytdAll.filter((i: any) => { const d = invDate(i); return d >= ytdStart && d <= todayStr })
  const ytdHT      = ytdFiltered.reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
  const ytdInvCount= ytdFiltered.length
  // Best month this year
  const monthlyHT: Record<string, number> = {}
  for (const inv of ytdFiltered) {
    const key = invDate(inv).slice(0, 7) // 'YYYY-MM'
    monthlyHT[key] = (monthlyHT[key] ?? 0) + Number(inv.ht_amount ?? 0)
  }
  const bestMonthEntry = Object.entries(monthlyHT).sort((a, b) => b[1] - a[1])[0] ?? null
  const bestMonthLabel = bestMonthEntry
    ? new Date(bestMonthEntry[0] + '-01').toLocaleDateString('fr-FR', { month: 'short' })
    : null
  const tvaQtr     = (tvaQtrRows ?? []).filter((i: any) => invDate(i) >= qtrStart).reduce((s: number, i: any) => s + Number(i.tva_amount ?? 0), 0)
  const paidAmt    = (paidThisMonth ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)

  const unpaidTotal = (unpaidValid ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const unpaidCount = (unpaidValid ?? []).length
  const overdueInvs = (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < todayStr)

  // ── Invoice Aging Buckets ──────────────────────────────────────────────
  const ago60 = format(subDays(now, 60), 'yyyy-MM-dd')
  const aging = {
    current: (unpaidValid ?? []).filter((i: any) => !i.due_date || i.due_date >= todayStr),
    late30:  (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < todayStr && i.due_date >= ago30),
    late60:  (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < ago30  && i.due_date >= ago60),
    late90p: (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < ago60),
  }
  const agingBuckets = [
    {
      label: 'Non échu',
      count: aging.current.length,
      amount: aging.current.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      color: 'text-[#2dd4a0]', bg: 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20',
      bar: 'bg-[#2dd4a0]',
      href: '/dashboard/invoices',
    },
    {
      label: '0–30 jours',
      count: aging.late30.length,
      amount: aging.late30.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      color: 'text-[#f59e0b]', bg: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
      bar: 'bg-[#f59e0b]',
      href: '/dashboard/invoices',
    },
    {
      label: '31–60 jours',
      count: aging.late60.length,
      amount: aging.late60.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      color: 'text-orange-400', bg: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      bar: 'bg-orange-500',
      href: '/dashboard/invoices',
    },
    {
      label: '+60 jours',
      count: aging.late90p.length,
      amount: aging.late90p.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      color: 'text-red-400', bg: 'text-red-400 bg-red-950/30 border-red-900/40',
      bar: 'bg-red-500',
      href: '/dashboard/invoices',
    },
  ].filter(b => b.count > 0)
  const avgOverdue  = overdueInvs.length > 0
    ? Math.round(overdueInvs.reduce((s: number, i: any) =>
        s + Math.max(0, Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000)), 0)
        / overdueInvs.length)
    : 0

  // ── Hero: treasury 30d ────────────────────────────────────────────────
  const dailyRate  = (paidLastMonth ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0) / 30
  const dueNext30  = (upcomingDue ?? [])
    .filter((i: any) => i.due_date <= format(addDays(now, 30), 'yyyy-MM-dd'))
    .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const treasury30 = dailyRate * 30 + dueNext30

  const totalInvCount = (allInvoices90 ?? []).length
  const isNewUser     = totalInvCount < 5

  // ── Draft count ───────────────────────────────────────────────────────
  const draftCount = (allInvoices90 ?? []).filter((i: any) => i.status === 'draft').length

  // ── Pending TTN alert ─────────────────────────────────────────────────
  const stalePending = (allInvoices90 ?? []).filter((i: any) =>
    i.status === 'pending' && i.issue_date && i.issue_date < ago14
  )
  const hasAlert       = stalePending.length > 0
  const alertMessage   = hasAlert
    ? `${stalePending.length} facture${stalePending.length > 1 ? 's' : ''} non soumise${stalePending.length > 1 ? 's' : ''} à TTN depuis plus de 14 jours — risque de pénalité 200–1 000 TND`
    : undefined
  const alertInvoiceId = hasAlert ? stalePending[0]?.id : undefined

  // ── Fiscal Health Score ───────────────────────────────────────────────
  const allInvArr = (allInvoices90 ?? []) as any[]
  const submitted = allInvArr.filter(i => ['valid','rejected'].includes(i.status)).length
  const validated = allInvArr.filter(i => i.status === 'valid').length
  const fastSub   = allInvArr.filter(i => {
    if (!i.validated_at || !i.created_at) return false
    try {
      const diff = Math.abs(parseISO(i.validated_at).getTime() - parseISO(i.created_at).getTime()) / 86400000
      return diff <= 7
    } catch { return false }
  }).length
  const paidInvs   = allInvArr.filter(i => i.payment_status === 'paid' && i.payment_date && i.due_date)
  const paidOnTime = paidInvs.filter(i => i.payment_date <= i.due_date).length
  const fields     = [company.matricule_fiscal, company.address, company.logo_url, company.bank_rib]
  const scoreA = totalInvCount > 0 ? (fastSub / totalInvCount) * 40 : 20
  const scoreB = submitted    > 0 ? (validated / submitted) * 30 : 15
  const scoreC = paidInvs.length > 0 ? (paidOnTime / paidInvs.length) * 20 : 10
  const scoreD = (fields.filter(Boolean).length / 4) * 10
  const score  = Math.round(scoreA + scoreB + scoreC + scoreD)
  const grade  = score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D'
  const scoreColor = score >= 90 ? '#2dd4a0' : score >= 75 ? '#d4a843' : score >= 55 ? '#4a9eff' : score >= 35 ? '#f59e0b' : '#e05a5a'

  // ── Cashflow chart (weekly buckets) ───────────────────────────────────
  // For past weeks: show paid invoices (by payment_date) OR finalized invoices
  //   (validated/valid by issue_date/created_at) — whichever has data.
  // For future weeks: show upcoming due amounts.
  const allFinalized90 = (allInvoices90 ?? []).filter((i: any) =>
    ['validated', 'valid'].includes(i.status)
  )
  const weeks = eachWeekOfInterval(
    { start: subDays(now, 90), end: addDays(now, 30) },
    { weekStartsOn: 1 }
  )
  const cashflowData = weeks.map(weekStart => {
    const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 })
    const wStartStr = format(weekStart, 'yyyy-MM-dd')
    const wEndStr   = format(weekEnd,   'yyyy-MM-dd')
    const isPast    = weekEnd < now

    let encaisse: number | null = null
    if (isPast) {
      // Primary: actual cash received (payment_date)
      const paidAmt = (recentPaid30 ?? [])
        .filter((i: any) => i.payment_date >= wStartStr && i.payment_date <= wEndStr)
        .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      // Fallback: factured amount (validated/valid invoices by issue_date or created_at)
      const facturé = allFinalized90
        .filter((i: any) => {
          const d = (i.issue_date ?? i.created_at ?? '').slice(0, 10)
          return d >= wStartStr && d <= wEndStr
        })
        .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      encaisse = paidAmt > 0 ? paidAmt : facturé > 0 ? facturé : 0
    }

    const attendu = !isPast
      ? (upcomingDue ?? [])
          .filter((i: any) => i.due_date >= wStartStr && i.due_date <= wEndStr)
          .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      : null

    return {
      date: wStartStr,
      label: format(weekStart, 'd MMM', { locale: fr }),
      encaisse, attendu, tendance: null as number | null,
    }
  })

  // ── Recent invoices ───────────────────────────────────────────────────
  const recentInvoices: InvoiceTableRow[] = (recentRaw ?? []).map((r: any) => ({
    id:          r.id,
    number:      r.number,
    clientName:  (r.clients as any)?.name ?? null,
    date:        r.issue_date,
    ttc:         Number(r.ttc_amount ?? 0),
    status:      r.status ?? 'draft',
    paymentStatus: r.payment_status ?? 'unpaid',
  }))

  // ── Profit / Loss ─────────────────────────────────────────────────────
  const EXPENSE_LABELS: Record<string, string> = {
    loyer: 'Loyer', salaires: 'Salaires', materiel: 'Matériel',
    transport: 'Transport', telecom: 'Télécom', fournitures: 'Fournitures',
    marketing: 'Marketing', comptabilite: 'Comptabilité', impots: 'Impôts', autre: 'Autre',
  }
  const expensesTotal     = (expensesMonth as any[]).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
  const expensesPrevTotal = (expensesPrevMonth as any[]).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
  const expenseMoM        = expensesPrevTotal > 0 ? Math.round(((expensesTotal - expensesPrevTotal) / expensesPrevTotal) * 100) : null
  const expByCat = Object.entries(
    (expensesMonth as any[]).reduce((acc: Record<string, number>, e: any) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount ?? 0)
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({ label: EXPENSE_LABELS[cat] ?? cat, amount: amt as number, color: 'red' }))

  const topExpCat  = expByCat[0] ?? null
  const monthLabel = new Date(monthStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // ── 6-month monthly expense sparkline ────────────────────────────────
  const expSparkline6m = Array.from({ length: 6 }, (_, i) => {
    const d = subDays(now, (5 - i) * 30)
    const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const mEnd   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`
    const amt = (expenses6mRaw as any[])
      .filter((e: any) => (e.date ?? '') >= mStart && (e.date ?? '') <= mEnd)
      .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
    return { label: format(d, 'MMM', { locale: fr }), amount: amt }
  })

  // ── Monthly Revenue Comparison (current vs prev, daily cumulative HT) ─────────
  const daysInCurrentMonth = new Date(y, m + 1, 0).getDate()
  const daysInPrevMonth    = new Date(prevY, prevM + 1, 0).getDate()
  const maxDays = Math.max(daysInCurrentMonth, daysInPrevMonth)

  // Build day-level HT for current and prev month from all validated/valid invoices
  const allValidated = [...(r_thisMonthV.data ?? []), ...(r_thisMonthVld.data ?? [])]
  const prevValidated = [...(r_prevMonthV.data ?? []), ...(r_prevMonthVld.data ?? [])]

  const currentDayHT: number[] = Array(maxDays + 1).fill(0)
  for (const inv of allValidated) {
    const d = invDate(inv)
    if (d >= `${y}-${String(m+1).padStart(2,'0')}-01` && d <= todayStr) {
      const day = parseInt(d.slice(8, 10))
      if (day >= 1 && day <= maxDays) currentDayHT[day] += Number(inv.ht_amount ?? 0)
    }
  }
  const prevDayHT: number[] = Array(maxDays + 1).fill(0)
  for (const inv of prevValidated) {
    const d = invDate(inv)
    const pm = String(prevM + 1).padStart(2, '0')
    if (d >= `${prevY}-${pm}-01` && d < prevEnd) {
      const day = parseInt(d.slice(8, 10))
      if (day >= 1 && day <= maxDays) prevDayHT[day] += Number(inv.ht_amount ?? 0)
    }
  }

  const todayDay = now.getDate()
  let cumCurrent = 0, cumPrev = 0
  const revenueComparisonData = Array.from({ length: maxDays }, (_, i) => {
    const day = i + 1
    cumCurrent += currentDayHT[day]
    cumPrev    += prevDayHT[day]
    return {
      day,
      current: day <= todayDay ? cumCurrent : null,
      prev:    cumPrev > 0 || day <= daysInPrevMonth ? cumPrev : null,
    }
  })
  const currentMonthLabel = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  const prevMonthLabel    = new Date(prevY, prevM, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

  // ── 4-week WoW cash collected sparkline ─────────────────────────────
  const cashSparkline4w = Array.from({ length: 4 }, (_, i) => {
    const wEnd   = format(subDays(now, i * 7),     'yyyy-MM-dd')
    const wStart = format(subDays(now, i * 7 + 6), 'yyyy-MM-dd')
    const amt = (recentPaid30 as any[])
      .filter((inv: any) => (inv.payment_date ?? '') >= wStart && (inv.payment_date ?? '') <= wEnd)
      .reduce((s: number, inv: any) => s + Number(inv.ttc_amount ?? 0), 0)
    return { day: `S-${i === 0 ? 'cette' : i}`, amount: amt }
  }).reverse()

  // ── 7-day Revenue Sparkline ──────────────────────────────────────────
  const sparkline7d = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(now, 6 - i), 'yyyy-MM-dd')
    const amt = (allInvoices90 as any[])
      .filter((inv: any) => {
        const date = (inv.issue_date ?? inv.created_at ?? '').slice(0, 10)
        return date === d && ['valid', 'validated'].includes(inv.status)
      })
      .reduce((s: number, inv: any) => s + Number(inv.ht_amount ?? 0), 0)
    return { day: format(subDays(now, 6 - i), 'EEE', { locale: fr }), amount: amt }
  })

  // ── Top 5 Clients ───────────────────────────────────────────────
  const clientMap: Record<string, { id: string; name: string; totalTTC: number; unpaid: number; invoiceCount: number }> = {}
  for (const inv of clientInvRaw as any[]) {
    const cl = inv.clients as any
    if (!cl?.id) continue
    if (!clientMap[cl.id]) clientMap[cl.id] = { id: cl.id, name: cl.name, totalTTC: 0, unpaid: 0, invoiceCount: 0 }
    clientMap[cl.id].totalTTC += Number(inv.ttc_amount ?? 0)
    clientMap[cl.id].invoiceCount += 1
    if (inv.payment_status !== 'paid') clientMap[cl.id].unpaid += Number(inv.ttc_amount ?? 0)
  }
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.totalTTC - a.totalTTC)
    .slice(0, 5)

  // ── Worst overdue client ─────────────────────────────────────────────
  const overdueByClient: Record<string, { id: string; name: string; overdue: number; count: number }> = {}
  for (const inv of clientInvRaw as any[]) {
    const cl = inv.clients as any
    if (!cl?.id || inv.payment_status === 'paid') continue
    if (!inv.due_date || inv.due_date >= todayStr) continue
    if (!overdueByClient[cl.id]) overdueByClient[cl.id] = { id: cl.id, name: cl.name, overdue: 0, count: 0 }
    overdueByClient[cl.id].overdue += Number(inv.ttc_amount ?? 0)
    overdueByClient[cl.id].count   += 1
  }
  const worstOverdue = Object.values(overdueByClient).sort((a, b) => b.overdue - a.overdue)[0] ?? null

  // ── Invoice Aging Summary (TTC amounts by bucket) ─────────────────────
  const agingSummaryAmt = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  for (const inv of clientInvRaw as any[]) {
    if (inv.payment_status === 'paid') continue
    if (!inv.due_date) { agingSummaryAmt.current += Number(inv.ttc_amount ?? 0); continue }
    const daysLate = Math.floor((new Date(todayStr).getTime() - new Date(inv.due_date).getTime()) / 86400000)
    if (daysLate <= 0)      agingSummaryAmt.current += Number(inv.ttc_amount ?? 0)
    else if (daysLate <= 30) agingSummaryAmt.d30     += Number(inv.ttc_amount ?? 0)
    else if (daysLate <= 60) agingSummaryAmt.d60     += Number(inv.ttc_amount ?? 0)
    else if (daysLate <= 90) agingSummaryAmt.d90     += Number(inv.ttc_amount ?? 0)
    else                     agingSummaryAmt.d90plus += Number(inv.ttc_amount ?? 0)
  }
  const agingSummaryTotal = agingSummaryAmt.current + agingSummaryAmt.d30 + agingSummaryAmt.d60 + agingSummaryAmt.d90 + agingSummaryAmt.d90plus

  // ── Invoice status counts for donut ───────────────────────────────
  const draftCount2   = (allInvoices90 as any[]).filter(i => i.status === 'draft').length
  const validatedCount = (allInvoices90 as any[]).filter(i => i.status === 'validated' || i.status === 'valid').filter((i: any) => i.payment_status !== 'paid').length
  const paidCount      = (allInvoices90 as any[]).filter(i => i.payment_status === 'paid').length
  const overdueCount90 = (allInvoices90 as any[]).filter(i => i.payment_status !== 'paid' && i.due_date && i.due_date < todayStr).length

  // ── Pending actions ─────────────────────────────────────────────────
  const overdueInvsAll = (clientInvRaw as any[]).filter(i => i.payment_status !== 'paid' && i.due_date && i.due_date < todayStr)
  const overdueAmtAll  = overdueInvsAll.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const unpaidOld60    = (clientInvRaw as any[]).filter(i => i.payment_status !== 'paid' && i.due_date && Math.floor((new Date(todayStr).getTime() - new Date(i.due_date).getTime()) / 86400000) > 60).length
  const expiredTTN     = (allInvoices90 as any[]).filter(i => i.ttn_rejection_reason).length
  const missingFields: string[] = []
  if (!company.matricule_fiscal) missingFields.push('MF')
  if (!company.address)          missingFields.push('Adresse')
  if (!company.bank_rib)         missingFields.push('RIB')

  const firstName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'vous'

  // ── Top 3 urgent unpaid invoices ─────────────────────────────────────
  const top3Pending = (allInvoices90 as any[])
    .filter(i => i.payment_status !== 'paid' && ['valid', 'validated'].includes(i.status) && i.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3)

  // ── Net Cash Position (this month) ───────────────────────────────────
  const cashCollectedMonth = (paidThisMonth as any[]).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const netCash = cashCollectedMonth - expensesTotal
  const netCashPct = cashCollectedMonth > 0 ? Math.round((netCash / cashCollectedMonth) * 100) : 0

  // ── Fiscal Health Score (0-100) ───────────────────────────────────────
  let fiscalScore = 100
  const totalCA = (clientInvRaw as any[]).filter(i => i.status !== 'draft').reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  if (totalCA > 0) fiscalScore -= Math.min(30, Math.round((overdueAmtAll / totalCA) * 60))
  fiscalScore -= Math.min(20, unpaidOld60 * 5)
  fiscalScore -= missingFields.length * 5
  fiscalScore -= Math.min(15, expiredTTN * 5)
  if (netCash < 0) fiscalScore -= 10
  fiscalScore = Math.max(0, Math.min(100, fiscalScore))
  const fiscalLabel  = fiscalScore >= 80 ? 'Excellent' : fiscalScore >= 60 ? 'Correct' : fiscalScore >= 40 ? 'À surveiller' : 'Critique'
  const fiscalColor  = fiscalScore >= 80 ? 'text-[#2dd4a0]' : fiscalScore >= 60 ? 'text-[#d4a843]' : fiscalScore >= 40 ? 'text-[#f59e0b]' : 'text-red-400'
  const fiscalBg     = fiscalScore >= 80 ? 'bg-[#2dd4a0]' : fiscalScore >= 60 ? 'bg-[#d4a843]' : fiscalScore >= 40 ? 'bg-[#f59e0b]' : 'bg-red-500'
  const fiscalBorder = fiscalScore >= 80 ? 'border-[#2dd4a0]/20' : fiscalScore >= 60 ? 'border-[#d4a843]/20' : fiscalScore >= 40 ? 'border-[#f59e0b]/20' : 'border-red-900/30'

  // ── 7-day cash collected sparkline ───────────────────────────────────
  const cashSparkline7d = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(now, 6 - i), 'yyyy-MM-dd')
    const amt = (recentPaid30 as any[])
      .filter((inv: any) => (inv.payment_date ?? '').slice(0, 10) === d)
      .reduce((s: number, inv: any) => s + Number(inv.ttc_amount ?? 0), 0)
    return { day: format(subDays(now, 6 - i), 'EEE', { locale: fr }), amount: amt }
  })
  const cashMax7d = Math.max(...cashSparkline7d.map(p => p.amount), 1)
  const cashTotal7d = cashSparkline7d.reduce((s, p) => s + p.amount, 0)

  // ── Recent activity feed (last 14 days) ───────────────────────────
  const activityItems: ActivityItem[] = []
  for (const inv of (allInvoices90 as any[]).filter(i => (i.created_at ?? '') >= ago14).slice(0, 6)) {
    activityItems.push({
      id:     'inv-c-' + inv.id,
      type:   'invoice_created',
      label:  inv.number ? `Facture ${inv.number}` : 'Nouvelle facture',
      sub:    inv.clients?.name ?? '',
      amount: Number(inv.ttc_amount ?? 0),
      date:   (inv.created_at ?? inv.issue_date ?? '').slice(0, 10),
      href:   `/dashboard/invoices/${inv.id}`,
    })
  }
  for (const inv of (allInvoices90 as any[]).filter(i => i.payment_status === 'paid' && (i.payment_date ?? '') >= ago14).slice(0, 4)) {
    activityItems.push({
      id:     'inv-p-' + inv.id,
      type:   'invoice_paid',
      label:  inv.number ? `Payée : ${inv.number}` : 'Facture payée',
      sub:    inv.clients?.name ?? '',
      amount: Number(inv.ttc_amount ?? 0),
      date:   (inv.payment_date ?? inv.paid_at ?? '').slice(0, 10),
      href:   `/dashboard/invoices/${inv.id}`,
    })
  }
  activityItems.sort((a, b) => b.date.localeCompare(a.date))
  const recentActivity = activityItems.slice(0, 8)

  return (
    <div>
      <Suspense fallback={null}><PaymentSuccessToast /></Suspense>
      <RealtimeProvider companyId={companyId} />

      {/* Main cockpit grid: 65% left / 35% right — stacks on mobile */}
      <div className="flex flex-col xl:flex-row gap-5 xl:items-start">

        {/* ── LEFT COLUMN ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* WIDGET 1 — Hero */}
          <HeroWidget
            firstName={firstName}
            unpaidTotal={unpaidTotal}
            unpaidCount={unpaidCount}
            treasury30={treasury30}
            isNewUser={isNewUser}
            hasAlert={hasAlert}
            alertMessage={alertMessage}
            alertInvoiceId={alertInvoiceId}
          />

          {/* Quick-action row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { href: '/dashboard/invoices/new', icon: '📄', label: 'Nouvelle facture',  color: 'border-[#d4a843]/30 hover:border-[#d4a843]/60 hover:bg-[#d4a843]/5', badge: draftCount > 0 ? draftCount : null },
              { href: '/dashboard/clients',      icon: '👤', label: 'Ajouter un client', color: 'border-[#2dd4a0]/20 hover:border-[#2dd4a0]/50 hover:bg-[#2dd4a0]/5', badge: null },
              { href: '/dashboard/expenses',     icon: '💸', label: 'Saisir une dépense',color: 'border-[#f59e0b]/20 hover:border-[#f59e0b]/50 hover:bg-[#f59e0b]/5', badge: null },
              { href: '/dashboard/invoices',     icon: '📋', label: 'Voir les factures', color: 'border-[#4a9eff]/20 hover:border-[#4a9eff]/50 hover:bg-[#4a9eff]/5', badge: unpaidCount > 0 ? unpaidCount : null },
            ] as { href: string; icon: string; label: string; color: string; badge: number | null }[]).map(a => (
              <a key={a.href} href={a.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 bg-[#0f1118] border rounded-xl transition-all group ${a.color}`}>
                <span className="text-base leading-none">{a.icon}</span>
                <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors leading-tight flex-1">{a.label}</span>
                {a.badge !== null && (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                    {a.badge}
                  </span>
                )}
              </a>
            ))}
          </div>

          {/* WIDGET: Pending Actions */}
          <PendingActionsWidget
            overdueCount={overdueInvsAll.length}
            overdueTotal={overdueAmtAll}
            draftCount={draftCount}
            missingProfile={missingFields}
            unpaidOld={unpaidOld60}
            expiredTTN={expiredTTN}
          />

          {/* WIDGET 4 — KPI Cards */}
          <KpiCards
            caHT={caHT}
            caTrend={caTrend}
            ytdHT={ytdHT}
            ytdInvCount={ytdInvCount}
            tvaQtr={tvaQtr}
            qtr={qtr + 1}
            year={y}
            unpaidTotal={unpaidTotal}
            avgOverdueDays={avgOverdue}
            sparkline7d={sparkline7d}
            bestMonthLabel={bestMonthLabel}
          />

          {/* WIDGET: Profit / Loss */}
          <ProfitLossWidget
            revenueHT={caHT}
            expensesTotal={expensesTotal}
            expensesByCategory={expByCat}
            month={monthLabel}
            monthlyExpenses={expSparkline6m}
          />

          {/* WIDGET: Fiscal Health Score */}
          <div className={`bg-[#0f1118] border ${fiscalBorder} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Score de santé fiscale</h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${fiscalBorder} ${fiscalColor} bg-opacity-10`}>
                {fiscalLabel}
              </span>
            </div>
            <div className="flex items-end gap-4 mb-3">
              <span className={`text-4xl font-black font-mono ${fiscalColor}`}>{fiscalScore}</span>
              <span className="text-gray-600 text-sm mb-1">/100</span>
            </div>
            <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all duration-700 ${fiscalBg}`}
                style={{ width: `${fiscalScore}%` }} />
            </div>
            {(overdueInvsAll.length > 0 || missingFields.length > 0 || expiredTTN > 0 || unpaidOld60 > 0) && (
              <ul className="space-y-1">
                {overdueInvsAll.length > 0 && (
                  <li className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                    {overdueInvsAll.length} facture{overdueInvsAll.length > 1 ? 's' : ''} en retard
                  </li>
                )}
                {unpaidOld60 > 0 && (
                  <li className="flex items-center gap-1.5 text-[10px] text-orange-400">
                    <span className="w-1 h-1 rounded-full bg-orange-500 shrink-0" />
                    {unpaidOld60} impayée{unpaidOld60 > 1 ? 's' : ''} &gt;60j
                  </li>
                )}
                {expiredTTN > 0 && (
                  <li className="flex items-center gap-1.5 text-[10px] text-[#f59e0b]">
                    <span className="w-1 h-1 rounded-full bg-[#f59e0b] shrink-0" />
                    {expiredTTN} facture{expiredTTN > 1 ? 's' : ''} rejetée{expiredTTN > 1 ? 's' : ''} TTN
                  </li>
                )}
                {missingFields.length > 0 && (
                  <li className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                    Champs manquants : {missingFields.join(', ')}
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* WIDGET: Net Cash Position */}
          {(cashCollectedMonth > 0 || expensesTotal > 0) && (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Trésorerie nette (ce mois)</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  netCash >= 0 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20'
                               : 'text-red-400 bg-red-950/20 border-red-900/30'
                }`}>{netCash >= 0 ? '+' : ''}{netCashPct}%</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Encaissé', value: cashCollectedMonth, color: 'text-[#2dd4a0]' },
                  { label: 'Dépenses', value: expensesTotal,      color: 'text-red-400' },
                  { label: 'Net',      value: netCash,             color: netCash >= 0 ? 'text-[#2dd4a0]' : 'text-red-400' },
                ].map(k => (
                  <div key={k.label} className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider">{k.label}</p>
                      {k.label === 'Dépenses' && expenseMoM !== null && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${
                          expenseMoM > 10  ? 'text-red-400 bg-red-950/30 border-red-900/30' :
                          expenseMoM < -10 ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' :
                          'text-gray-500 bg-[#1a1b22] border-[#252830]'
                        }`}>{expenseMoM > 0 ? '+' : ''}{expenseMoM}%</span>
                      )}
                    </div>
                    <p className={`text-sm font-mono font-bold ${k.color}`}>
                      {netCash < 0 && k.label === 'Net' ? '-' : ''}{new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(k.value))}
                    </p>
                  </div>
                ))}
              </div>
              {cashCollectedMonth > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                    <span>Encaissé</span><span>Dépenses</span>
                  </div>
                  <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden flex">
                    <div className="h-full bg-[#2dd4a0] rounded-l-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.round((cashCollectedMonth / (cashCollectedMonth + expensesTotal)) * 100))}%` }} />
                    <div className="h-full bg-red-500/70 rounded-r-full transition-all duration-700 flex-1" />
                  </div>
                </div>
              )}
              {topExpCat && (
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#1a1b22]">
                  <span className="text-[10px] text-gray-600">Poste principal</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-950/20 text-red-400 border-red-900/25">
                    {topExpCat.label} · {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(topExpCat.amount)} TND
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WIDGET: Expense Category Donut */}
          {expByCat.length > 0 && (
            <ExpenseCategoryDonut data={expByCat} />
          )}

          {/* WIDGET: Monthly Revenue Comparison */}
          <RevenueComparisonChart
            data={revenueComparisonData}
            currentLabel={currentMonthLabel}
            prevLabel={prevMonthLabel}
          />

          {/* WIDGET: Aging Report */}
          {agingBuckets.length > 0 && (
            <InvoiceAgingReport buckets={agingBuckets} totalUnpaid={unpaidTotal} />
          )}

          {/* WIDGET 2 — Cash Flow Chart */}
          <CashFlowChart
            data={cashflowData}
            paidThisMonth={paidAmt}
            unpaidTotal={unpaidTotal}
            caHT={caHT}
            cashSparkline4w={cashSparkline4w}
          />

          {/* WIDGET 3 — Fiscal Health Score */}
          <FiscalHealthScore
            score={score}
            grade={grade}
            scoreColor={scoreColor}
            scoreA={scoreA}
            scoreB={scoreB}
            scoreC={scoreC}
            scoreD={scoreD}
          />

          {/* WIDGET 6 — Recent Invoices */}
          <RecentInvoicesTable invoices={recentInvoices} />
        </div>

        {/* ── RIGHT COLUMN — sticky on xl, normal on mobile ─────────── */}
        <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-6 space-y-5">

          {/* Overdue client alert */}
          {worstOverdue && (
            <a href={`/dashboard/clients/${worstOverdue.id}`}
              className="block bg-[#0f1118] border border-red-900/40 rounded-2xl px-4 py-4 hover:border-red-700/60 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-900/40 flex items-center justify-center shrink-0">
                  <span className="text-sm">⚠</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-0.5">Créance en retard</p>
                  <p className="text-sm font-bold text-white truncate group-hover:text-red-300 transition-colors">{worstOverdue.name}</p>
                  <p className="text-xs font-mono text-red-400 mt-0.5">
                    {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(worstOverdue.overdue)} TND
                    <span className="text-gray-600 font-sans ml-1.5">— {worstOverdue.count} fact. impayée{worstOverdue.count > 1 ? 's' : ''}</span>
                  </p>
                </div>
                <span className="text-gray-600 group-hover:text-red-400 transition-colors text-sm">→</span>
              </div>
            </a>
          )}

          {/* Invoice Status Donut */}
          <InvoiceStatusDonut
            draft={draftCount2}
            validated={validatedCount}
            paid={paidCount}
            overdue={overdueCount90}
          />

          {/* Top 3 urgent pending invoices */}
          {top3Pending.length > 0 && (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">À encaisser en priorité</h2>
                <a href="/dashboard/invoices?payment=unpaid" className="text-[10px] text-gray-600 hover:text-[#d4a843] transition-colors">Tout voir →</a>
              </div>
              <ul className="space-y-2">
                {top3Pending.map((inv: any) => {
                  const daysOverdue = inv.due_date
                    ? Math.floor((new Date(todayStr).getTime() - new Date(inv.due_date).getTime()) / 86400000)
                    : null
                  const isOver = daysOverdue !== null && daysOverdue > 0
                  return (
                    <li key={inv.id}>
                      <a href={`/dashboard/invoices/${inv.id}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#1a1b22] hover:border-[#d4a843]/20 hover:bg-[#161b27] transition-all group">
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${isOver ? 'bg-red-500' : 'bg-[#f59e0b]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-200 truncate leading-tight">
                            {inv.number ?? 'Sans numéro'}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {inv.due_date
                              ? isOver
                                ? <span className="text-red-400 font-bold">{daysOverdue}j de retard</span>
                                : <span className="text-[#f59e0b]">Éch. {new Date(inv.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                              : 'Pas d\'échéance'}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-gray-300 shrink-0">
                          {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(inv.ttc_amount ?? 0))}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Aging summary card */}
          {agingSummaryTotal > 0 && (() => {
            const overdueAmt = agingSummaryAmt.d30 + agingSummaryAmt.d60 + agingSummaryAmt.d90 + agingSummaryAmt.d90plus
            const overduePct = agingSummaryTotal > 0 ? Math.round((overdueAmt / agingSummaryTotal) * 100) : 0
            return (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Créances impayées</p>
                {overdueAmt > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    overduePct >= 50 ? 'text-red-400 bg-red-950/30 border-red-900/40' :
                    overduePct >= 25 ? 'text-orange-400 bg-orange-950/30 border-orange-900/40' :
                                       'text-[#f59e0b] bg-amber-950/30 border-amber-900/40'
                  }`}>
                    ↑ {overduePct}% en retard
                  </span>
                )}
              </div>
              {([
                { label: 'Non échu',    amt: agingSummaryAmt.current, color: 'bg-[#2dd4a0]', text: 'text-[#2dd4a0]' },
                { label: '1–30 j',      amt: agingSummaryAmt.d30,     color: 'bg-[#d4a843]', text: 'text-[#d4a843]' },
                { label: '31–60 j',     amt: agingSummaryAmt.d60,     color: 'bg-orange-500', text: 'text-orange-400' },
                { label: '61–90 j',     amt: agingSummaryAmt.d90,     color: 'bg-red-500',    text: 'text-red-400' },
                { label: '> 90 j',      amt: agingSummaryAmt.d90plus, color: 'bg-red-700',    text: 'text-red-500' },
              ] as { label: string; amt: number; color: string; text: string }[]).map(b => b.amt > 0 && (
                <div key={b.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">{b.label}</span>
                    <span className={`text-[10px] font-mono font-bold ${b.text}`}>
                      {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3 }).format(b.amt)} TND
                    </span>
                  </div>
                  <div className="h-1 bg-[#1a1b22] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color}`}
                      style={{ width: `${Math.min(100, Math.round((b.amt / agingSummaryTotal) * 100))}%` }} />
                  </div>
                </div>
              ))}
              <a href="/dashboard/invoices?payment=unpaid"
                className="block text-center text-[10px] text-gray-600 hover:text-[#d4a843] transition-colors pt-1">
                Voir les impayées →
              </a>
            </div>
            )
          })()}

          {/* 7-day cash collected sparkline */}
          {cashTotal7d > 0 && (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Encaissé — 7 jours</h2>
                  <p className="text-lg font-mono font-black text-[#2dd4a0] mt-0.5">
                    {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cashTotal7d)}
                    <span className="text-xs font-sans font-normal text-gray-600 ml-1">TND</span>
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-1 h-12">
                {cashSparkline7d.map((pt, idx) => {
                  const h = cashMax7d > 0 ? Math.max(4, Math.round((pt.amount / cashMax7d) * 44)) : 4
                  const isToday = idx === 6
                  return (
                    <div key={pt.day} className="flex-1 flex flex-col items-center gap-1" title={`${pt.day}: ${new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0 }).format(pt.amount)} TND`}>
                      <div className="w-full flex items-end justify-center" style={{ height: 44 }}>
                        <div
                          className={`w-full rounded-t-sm transition-all duration-500 ${isToday ? 'bg-[#2dd4a0]' : pt.amount > 0 ? 'bg-[#2dd4a0]/40' : 'bg-[#1a1b22]'}`}
                          style={{ height: h }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-600">{pt.day}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <RecentActivityFeed items={recentActivity} />
          <RevenueGoalWidget
            caHT={caHT}
            ytdHT={ytdHT}
            monthlyGoal={company?.monthly_revenue_goal ?? null}
            annualGoal={company?.annual_revenue_goal ?? null}
            year={y}
            monthLabel={monthLabel}
          />
          <TopClientsWidget clients={topClients} />
          <AIInsightsPanel />
          <RemindersPanel />
        </div>
      </div>
    </div>
  )
}
