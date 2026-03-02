import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err } from '@/lib/api-helpers'
import { differenceInDays, parseISO } from 'date-fns'

export const revalidate = 300 // 5-minute cache

export type Reminder = {
  id: string
  priority: 'critical' | 'warning' | 'info' | 'neutral'
  icon: string
  title: string
  subtitle: string
  relativeTime: string
  actionLabel?: string
  actionHref?: string
}

function relTime(dateStr: string): string {
  const diff = differenceInDays(new Date(), parseISO(dateStr))
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  if (diff < 0)  return `Dans ${Math.abs(diff)} jours`
  return `Il y a ${diff} jour${diff > 1 ? 's' : ''}`
}

export async function GET(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)
    const cid = company.id
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const in2  = new Date(today.getTime() + 2  * 86400000).toISOString().slice(0, 10)
    const ago7 = new Date(today.getTime() - 7  * 86400000).toISOString().slice(0, 10)
    const ago3 = new Date(today.getTime() - 3  * 86400000).toISOString().slice(0, 10)
    const ago14= new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)

    const [
      { data: stuckDrafts },
      { data: rejectedOld },
      { data: dueSoon },
      { data: expiredMandates },
      { data: ttnNotSubmitted },
      { data: tvaReady },
    ] = await Promise.all([
      // Drafts not finalized > 7 days
      (supabase as any).from('invoices').select('id, number, created_at')
        .eq('company_id', cid).eq('status', 'draft').is('deleted_at', null)
        .lte('created_at', ago7).limit(5),

      // Rejected invoices not corrected > 3 days
      (supabase as any).from('invoices').select('id, number, updated_at, ttn_rejection_reason')
        .eq('company_id', cid).eq('status', 'rejected').is('deleted_at', null)
        .lte('updated_at', ago3).limit(5),

      // Due dates today or tomorrow, unpaid
      (supabase as any).from('invoices').select('id, number, due_date, ttc_amount')
        .eq('company_id', cid).eq('status', 'valid').neq('payment_status', 'paid')
        .is('deleted_at', null).gte('due_date', todayStr).lte('due_date', in2).limit(5),

      // Mandate / cert expiring < 30 days
      (supabase as any).from('mandates').select('id, seal_valid_until')
        .eq('company_id', cid).eq('is_active', true).lte('seal_valid_until', in30).limit(1),

      // Valid invoices older than 14 days not yet submitted
      (supabase as any).from('invoices').select('id, number, issue_date')
        .eq('company_id', cid).eq('status', 'pending').is('deleted_at', null)
        .lte('issue_date', ago14).limit(5),

      // Quarterly TVA readiness (invoices this quarter)
      (supabase as any).from('invoices').select('id', { count: 'exact', head: true })
        .eq('company_id', cid).eq('status', 'valid').is('deleted_at', null)
        .gte('issue_date', `${today.getFullYear()}-${String(Math.floor(today.getMonth() / 3) * 3 + 1).padStart(2,'0')}-01`),
    ])

    const reminders: Reminder[] = []

    // 🔴 CRITICAL: pending > 14 days
    for (const inv of ttnNotSubmitted ?? []) {
      reminders.push({
        id: `ttn-stuck-${inv.id}`,
        priority: 'critical',
        icon: '🔴',
        title: `Facture ${inv.number} non soumise à TTN`,
        subtitle: 'Risque de pénalité : 200–1 000 TND',
        relativeTime: relTime(inv.issue_date),
        actionLabel: 'Soumettre →',
        actionHref: `/dashboard/invoices/${inv.id}`,
      })
    }

    // 🔴 CRITICAL: rejected > 3 days
    for (const inv of rejectedOld ?? []) {
      reminders.push({
        id: `rejected-${inv.id}`,
        priority: 'critical',
        icon: '🔴',
        title: `Facture ${inv.number} rejetée à corriger`,
        subtitle: inv.ttn_rejection_reason ?? 'Voir les détails',
        relativeTime: relTime(inv.updated_at),
        actionLabel: 'Corriger →',
        actionHref: `/dashboard/invoices/${inv.id}`,
      })
    }

    // 🔴 CRITICAL: mandate expiring
    for (const m of expiredMandates ?? []) {
      const days = differenceInDays(parseISO(m.seal_valid_until), today)
      reminders.push({
        id: `mandate-expiry-${m.id}`,
        priority: 'critical',
        icon: '🔴',
        title: `Mandat de signature expire dans ${days} jours`,
        subtitle: `Expire le ${m.seal_valid_until}`,
        relativeTime: `Dans ${days} jours`,
        actionLabel: 'Renouveler →',
        actionHref: '/dashboard/settings?tab=signature',
      })
    }

    // 🟡 WARNING: due soon
    for (const inv of dueSoon ?? []) {
      const days = differenceInDays(parseISO(inv.due_date), today)
      reminders.push({
        id: `due-${inv.id}`,
        priority: 'warning',
        icon: '🟡',
        title: `Facture ${inv.number} — échéance ${days === 0 ? "aujourd'hui" : 'demain'}`,
        subtitle: `${Number(inv.ttc_amount ?? 0).toFixed(3)} TND à encaisser`,
        relativeTime: days === 0 ? "Aujourd'hui" : 'Demain',
        actionLabel: 'Marquer payée →',
        actionHref: `/dashboard/invoices/${inv.id}`,
      })
    }

    // 🟡 WARNING: old drafts
    for (const inv of stuckDrafts ?? []) {
      reminders.push({
        id: `draft-${inv.id}`,
        priority: 'warning',
        icon: '🟡',
        title: `Brouillon ${inv.number ?? 'sans numéro'} non finalisé`,
        subtitle: 'Créé il y a plus de 7 jours',
        relativeTime: relTime(inv.created_at),
        actionLabel: 'Finaliser →',
        actionHref: `/dashboard/invoices/${inv.id}`,
      })
    }

    // 🔵 INFO: TVA declaration ready
    const tvaCount = (tvaReady as any)?.count ?? 0
    if (tvaCount > 0) {
      const qtr = Math.floor(today.getMonth() / 3) + 1
      reminders.push({
        id: 'tva-ready',
        priority: 'info',
        icon: '🔵',
        title: `Données TVA T${qtr} ${today.getFullYear()} disponibles`,
        subtitle: `${tvaCount} facture${tvaCount > 1 ? 's' : ''} validée${tvaCount > 1 ? 's' : ''}`,
        relativeTime: 'Ce trimestre',
        actionLabel: 'Voir rapport →',
        actionHref: '/dashboard/tva',
      })
    }

    // Sort: critical first, then warning, info, neutral
    const order = { critical: 0, warning: 1, info: 2, neutral: 3 }
    reminders.sort((a, b) => order[a.priority] - order[b.priority])

    return success({ reminders: reminders.slice(0, 10) })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
