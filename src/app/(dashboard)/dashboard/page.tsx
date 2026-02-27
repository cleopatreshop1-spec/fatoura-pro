import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AlertBanners } from '@/components/dashboard/AlertBanners'
import { StatCards } from '@/components/dashboard/StatCards'
import { RevenueBarChart } from '@/components/dashboard/RevenueBarChart'
import { RecentInvoicesTable } from '@/components/dashboard/RecentInvoicesTable'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { RealtimeProvider } from '@/components/dashboard/RealtimeProvider'
import { PaymentSuccessToast } from '@/components/billing/PaymentSuccessToast'
import type { StatCardsData } from '@/components/dashboard/StatCards'
import type { ChartMonth } from '@/components/dashboard/RevenueBarChart'
import type { InvoiceTableRow } from '@/components/dashboard/RecentInvoicesTable'
import type { ActivityItem } from '@/components/dashboard/ActivityFeed'

const MONTHS_FR = ['Jan','Fev','Mar','Avr','Mai','Juin','Juil','Aout','Sep','Oct','Nov','Dec']

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: companies } = await supabase
    .from('companies').select('id').eq('owner_id', user.id).limit(1)
  const companyId: string | undefined = (companies as any)?.[0]?.id

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="text-4xl"></div>
          <p className="text-gray-400 text-sm">Aucune societe configuree.</p>
          <a href="/register/company" className="text-[#d4a843] hover:underline text-sm">Creer mon entreprise</a>
        </div>
      </div>
    )
  }

  //  Date boundaries 
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  const monthStart     = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const today          = now.toISOString().slice(0, 10)
  const prevM          = m === 0 ? 11 : m - 1
  const prevY          = m === 0 ? y - 1 : y
  const prevMonthStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`
  const qtr            = Math.floor(m / 3)
  const qtrStart       = `${y}-${String(qtr * 3 + 1).padStart(2, '0')}-01`
  const sixAgo         = new Date(y, m - 5, 1).toISOString().slice(0, 10)

  //  Parallel Supabase fetches 
  const [
    { data: thisMonthRows },
    { data: prevMonthRows },
    { data: pendingRows,   count: pendingCount },
    { data: queuedRows,    count: queuedCount },
    { count: rejectedCount },
    { data: validQtrRows },
    { data: validMonthRows },
    { data: last8Raw },
    { data: activityRows },
    { data: mandateRow },
    { data: chartRows },
  ] = await Promise.all([
    supabase.from('invoices').select('id, ttc_amount')
      .eq('company_id', companyId).gte('issue_date', monthStart).lte('issue_date', today),

    supabase.from('invoices').select('id')
      .eq('company_id', companyId).gte('issue_date', prevMonthStart).lt('issue_date', monthStart),

    supabase.from('invoices').select('id, status', { count: 'exact' })
      .eq('company_id', companyId).eq('status', 'pending'),

    supabase.from('invoices').select('id', { count: 'exact' })
      .eq('company_id', companyId).eq('status', 'queued'),

    supabase.from('invoices').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'rejected'),

    supabase.from('invoices').select('tva_amount')
      .eq('company_id', companyId).eq('status', 'valid').gte('issue_date', qtrStart),

    supabase.from('invoices').select('ht_amount')
      .eq('company_id', companyId).eq('status', 'valid').gte('issue_date', monthStart).lte('issue_date', today),

    supabase.from('invoices')
      .select('id, number, status, issue_date, ttc_amount, clients(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8),

    supabase.from('activity_log').select('id, action_type, description, created_at, entity_type')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(10),

    supabase.from('mandates').select('is_active, seal_valid_until')
      .eq('company_id', companyId).eq('is_active', true).limit(1).maybeSingle(),

    supabase.from('invoices').select('issue_date, ht_amount, tva_amount, status')
      .eq('company_id', companyId).in('status', ['valid', 'pending', 'queued'])
      .gte('issue_date', sixAgo).lte('issue_date', today),
  ])

  //  Process stat cards data 
  const thisCount = (thisMonthRows ?? []).length
  const prevCount = (prevMonthRows ?? []).length
  const trendPct: number | null = prevCount > 0
    ? Math.round(((thisCount - prevCount) / prevCount) * 100)
    : null
  const thisTTC = (thisMonthRows ?? []).reduce((s: number, r: any) => s + Number(r.ttc_amount ?? 0), 0)

  const pCount = pendingCount ?? 0
  const qCount = queuedCount ?? 0

  const tvaQtr = (validQtrRows ?? []).reduce((s: number, r: any) => s + Number(r.tva_amount ?? 0), 0)
  const caHT   = (validMonthRows ?? []).reduce((s: number, r: any) => s + Number(r.ht_amount ?? 0), 0)
  const validMonthCount = (validMonthRows ?? []).length

  const statCards: StatCardsData = {
    invoicesThisMonth: { count: thisCount, ttc: thisTTC, trend: trendPct },
    pendingTTN:        { total: pCount + qCount, pending: pCount, queued: qCount },
    tvaQuarter:        { amount: tvaQtr, quarter: qtr + 1, year: y },
    caHT:              { amount: caHT, validCount: validMonthCount },
  }

  //  Process alerts data 
  const hasMandate = !!(mandateRow as any)
  let mandateExpiringDays: number | null = null
  if (mandateRow) {
    const validUntil = new Date((mandateRow as any).seal_valid_until)
    const daysLeft   = Math.ceil((validUntil.getTime() - Date.now()) / 86400000)
    if (daysLeft <= 30) mandateExpiringDays = daysLeft
  }

  //  Process chart data 
  const chartMap: Record<string, ChartMonth> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    chartMap[key] = { month: MONTHS_FR[d.getMonth()], ht: 0, tva: 0 }
  }
  for (const row of chartRows ?? []) {
    const key = ((row as any).issue_date ?? '').slice(0, 7)
    if (chartMap[key]) {
      chartMap[key].ht  += Number((row as any).ht_amount  ?? 0)
      chartMap[key].tva += Number((row as any).tva_amount ?? 0)
    }
  }
  const chartData: ChartMonth[] = Object.values(chartMap)

  //  Process recent invoices 
  const recentInvoices: InvoiceTableRow[] = (last8Raw ?? []).map((r: any) => ({
    id:         r.id,
    number:     r.number,
    clientName: (r.clients as any)?.name ?? null,
    date:       r.issue_date,
    ttc:        Number(r.ttc_amount ?? 0),
    status:     r.status ?? 'draft',
  }))

  //  Process activity 
  const activities: ActivityItem[] = (activityRows ?? []).map((r: any) => ({
    id:          r.id,
    action_type: r.action_type,
    description: r.description,
    created_at:  r.created_at,
    entity_type: r.entity_type,
  }))

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <PaymentSuccessToast />
      </Suspense>
      <RealtimeProvider companyId={companyId} />

      {/*  Header  */}
      <div>
        <h1 className="text-xl font-bold text-white">Tableau de bord</h1>
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/*  Section 1: Alerts  */}
      <AlertBanners
        rejectedCount={rejectedCount ?? 0}
        hasMandate={hasMandate}
        mandateExpiringDays={mandateExpiringDays}
        queuedCount={qCount}
      />

      {/*  Section 2: Stat Cards  */}
      <StatCards data={statCards} />

      {/*  Section 3: Revenue Bar Chart  */}
      <RevenueBarChart data={chartData} />

      {/*  Section 4: Invoices table + Activity feed  */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 min-h-[420px]">
          <RecentInvoicesTable invoices={recentInvoices} />
        </div>
        <div className="xl:col-span-2 min-h-[420px]">
          <ActivityFeed items={activities} />
        </div>
      </div>
    </div>
  )
}
