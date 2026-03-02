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
import { RecentInvoicesTable } from '@/components/dashboard/RecentInvoicesTable'
import type { InvoiceTableRow } from '@/components/dashboard/RecentInvoicesTable'
import { format, subDays, addDays, parseISO, endOfWeek, eachWeekOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, matricule_fiscal, address, logo_url, bank_rib')
    .eq('owner_id', user.id).limit(1)
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

  const [
    { data: thisMonthValid },
    { data: prevMonthValid },
    { data: unpaidValid },
    { data: paidThisMonth },
    { data: paidLastMonth },
    { data: tvaQtrRows },
    { data: recentRaw },
    { data: allInvoices90 },
    { data: upcomingDue },
    { data: recentPaid30 },
  ] = await Promise.all([
    (supabase as any).from('invoices').select('id, ht_amount, status, issue_date, created_at')
      .eq('company_id', companyId).in('status', ['validated', 'valid'])
      .is('deleted_at', null),

    (supabase as any).from('invoices').select('id, ht_amount, issue_date, created_at')
      .eq('company_id', companyId).in('status', ['validated', 'valid'])
      .is('deleted_at', null),

    supabase.from('invoices').select('id, ttc_amount, due_date, payment_status')
      .eq('company_id', companyId).eq('status', 'valid')
      .neq('payment_status', 'paid').is('deleted_at', null),

    supabase.from('invoices').select('id, ttc_amount, payment_date')
      .eq('company_id', companyId).eq('payment_status', 'paid')
      .gte('payment_date', monthStart).lte('payment_date', todayStr).is('deleted_at', null),

    supabase.from('invoices').select('id, ttc_amount')
      .eq('company_id', companyId).eq('payment_status', 'paid')
      .gte('payment_date', prevStart).lt('payment_date', prevEnd).is('deleted_at', null),

    (supabase as any).from('invoices').select('tva_amount, issue_date, created_at')
      .eq('company_id', companyId).in('status', ['validated', 'valid'])
      .is('deleted_at', null),

    supabase.from('invoices')
      .select('id, number, status, issue_date, ttc_amount, payment_status, clients(name)')
      .eq('company_id', companyId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(5),

    supabase.from('invoices')
      .select('id, status, payment_status, issue_date, created_at, validated_at, due_date, payment_date, ttc_amount, ht_amount')
      .eq('company_id', companyId).gte('issue_date', ago90).is('deleted_at', null),

    supabase.from('invoices').select('id, ttc_amount, due_date')
      .eq('company_id', companyId).eq('status', 'valid').neq('payment_status', 'paid')
      .gte('due_date', todayStr).lte('due_date', in90).is('deleted_at', null),

    supabase.from('invoices').select('id, ttc_amount, payment_date')
      .eq('company_id', companyId).eq('payment_status', 'paid')
      .gte('payment_date', ago30).lte('payment_date', todayStr).is('deleted_at', null),
  ])

  // ── KPIs ──────────────────────────────────────────────────────────────
  console.log('[dashboard] thisMonthValid:', JSON.stringify(thisMonthValid))
  console.log('[dashboard] monthStart:', monthStart, 'todayStr:', todayStr)
  // Use issue_date when set, fall back to created_at (handles invoices saved without a date)
  const invDate = (i: any) => (i.issue_date ?? i.created_at ?? '').slice(0, 10)
  const caHT       = (thisMonthValid ?? []).filter((i: any) => { const d = invDate(i); return d >= monthStart && d <= todayStr }).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
  const prevCaHT   = (prevMonthValid  ?? []).filter((i: any) => { const d = invDate(i); return d >= prevStart && d < prevEnd  }).reduce((s: number, i: any) => s + Number(i.ht_amount ?? 0), 0)
  const caTrend    = prevCaHT > 0 ? Math.round(((caHT - prevCaHT) / prevCaHT) * 100) : null
  const validCount = (thisMonthValid ?? []).filter((i: any) => i.status === 'valid' && invDate(i) >= monthStart && invDate(i) <= todayStr).length
  const tvaQtr     = (tvaQtrRows ?? []).filter((i: any) => invDate(i) >= qtrStart).reduce((s: number, i: any) => s + Number(i.tva_amount ?? 0), 0)
  const paidAmt    = (paidThisMonth ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)

  const unpaidTotal = (unpaidValid ?? []).reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const unpaidCount = (unpaidValid ?? []).length
  const overdueInvs = (unpaidValid ?? []).filter((i: any) => i.due_date && i.due_date < todayStr)
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
  const weeks = eachWeekOfInterval(
    { start: subDays(now, 90), end: addDays(now, 30) },
    { weekStartsOn: 1 }
  )
  const cashflowData = weeks.map(weekStart => {
    const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 })
    const wStartStr = format(weekStart, 'yyyy-MM-dd')
    const wEndStr   = format(weekEnd,   'yyyy-MM-dd')
    const isPast    = weekEnd < now
    const encaisse  = isPast
      ? (recentPaid30 ?? [])
          .filter((i: any) => i.payment_date >= wStartStr && i.payment_date <= wEndStr)
          .reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
      : null
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

  const firstName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'vous'

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

          {/* WIDGET 4 — KPI Cards */}
          <KpiCards
            caHT={caHT}
            caTrend={caTrend}
            validThisMonth={validCount}
            tvaQtr={tvaQtr}
            qtr={qtr + 1}
            year={y}
            unpaidTotal={unpaidTotal}
            avgOverdueDays={avgOverdue}
          />

          {/* WIDGET 2 — Cash Flow Chart */}
          <CashFlowChart
            data={cashflowData}
            paidThisMonth={paidAmt}
            unpaidTotal={unpaidTotal}
            caHT={caHT}
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
        <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-6">
          <RemindersPanel />
        </div>
      </div>
    </div>
  )
}
