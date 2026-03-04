'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck, X, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

type Notif = {
  id: string
  type: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

type InvoiceAlert = {
  overdueCount: number
  unpaidCount: number
  overdueAmount: number
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  invoice_validated: { icon: 'OK',  color: 'text-[#2dd4a0]' },
  invoice_rejected:  { icon: 'KO',  color: 'text-[#e05a5a]' },
  mandate_expiring:  { icon: '!!',  color: 'text-[#f59e0b]' },
  cert_expiring:     { icon: 'CRT', color: 'text-[#4a9eff]' },
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins}min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export function NotificationsDropdown() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const [invoiceAlert, setInvoiceAlert] = useState<InvoiceAlert | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifs.filter(n => !n.is_read).length
  const totalBadge  = unreadCount + (invoiceAlert?.overdueCount ?? 0)

  async function fetchNotifs() {
    if (!activeCompany?.id) return
    setLoading(true)
    const todayStr = new Date().toISOString().slice(0, 10)

    const [{ data: notifData }, { data: unpaidData }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false })
        .limit(20),
      (supabase as any)
        .from('invoices')
        .select('id, ttc_amount, due_date, payment_status')
        .eq('company_id', activeCompany.id)
        .in('status', ['valid', 'validated'])
        .neq('payment_status', 'paid')
        .is('deleted_at', null),
    ])

    setNotifs((notifData ?? []) as Notif[])

    const unpaid = (unpaidData ?? []) as any[]
    const overdue = unpaid.filter((i: any) => i.due_date && i.due_date < todayStr)
    if (unpaid.length > 0) {
      setInvoiceAlert({
        overdueCount:  overdue.length,
        unpaidCount:   unpaid.length,
        overdueAmount: overdue.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0),
      })
    } else {
      setInvoiceAlert(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    if (!activeCompany?.id) return
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('company_id', activeCompany.id)
      .eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#161b27] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={17} strokeWidth={1.8} />
        {totalBadge > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1b22]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                  {unreadCount} non lues
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-gray-500 hover:text-[#d4a843] flex items-center gap-1 transition-colors px-2 py-1"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck size={12} />
                  Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-300 p-1">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Smart invoice alerts */}
          {invoiceAlert && (
            <div className="border-b border-[#1a1b22]">
              {invoiceAlert.overdueCount > 0 && (
                <Link
                  href="/dashboard/invoices"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-red-950/20 hover:bg-red-950/30 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={13} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-300">
                      {invoiceAlert.overdueCount} facture{invoiceAlert.overdueCount > 1 ? 's' : ''} en retard
                    </p>
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {fmtTND(invoiceAlert.overdueAmount)} TND non encaissés
                    </p>
                  </div>
                  <span className="text-[10px] text-red-500">→</span>
                </Link>
              )}
              {invoiceAlert.unpaidCount > invoiceAlert.overdueCount && (
                <Link
                  href="/dashboard/invoices"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#161b27] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#161b27] border border-[#252830] flex items-center justify-center shrink-0">
                    <Clock size={13} className="text-[#f59e0b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-300">
                      {invoiceAlert.unpaidCount - invoiceAlert.overdueCount} facture{invoiceAlert.unpaidCount - invoiceAlert.overdueCount > 1 ? 's' : ''} en attente
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Non encore échues</p>
                  </div>
                  <span className="text-[10px] text-gray-600">→</span>
                </Link>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-xs text-gray-600 text-center">Chargement...</div>
            ) : notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="mx-auto text-gray-700 mb-2" />
                <p className="text-xs text-gray-600">Aucune notification</p>
              </div>
            ) : (
              notifs.slice(0, 5).map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: '•', color: 'text-gray-400' }
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[#1a1b22] last:border-0 hover:bg-[#161b27] transition-colors ${!n.is_read ? 'bg-[#d4a843]/3' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-full bg-[#161b27] border border-[#252830] flex items-center justify-center text-[9px] font-black shrink-0 ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-medium leading-tight ${n.is_read ? 'text-gray-400' : 'text-gray-100'}`}>
                          {n.title}
                        </span>
                        {!n.is_read && <Check size={10} className="text-[#d4a843] shrink-0 mt-0.5" />}
                      </div>
                      {n.message && (
                        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-gray-700 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="border-t border-[#1a1b22] px-4 py-2.5">
            <Link
              href="/dashboard/settings?tab=notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-[#d4a843] transition-colors"
            >
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
