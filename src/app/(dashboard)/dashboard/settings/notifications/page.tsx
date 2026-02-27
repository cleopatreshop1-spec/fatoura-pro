'use client'

import { useEffect, useMemo, useState } from 'react'
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

const TYPE_ICONS: Record<string, string> = {
  invoice_validated: '✓',
  invoice_rejected: '✕',
  mandate_expiring: '⚠',
  cert_expiring: '🔐',
}

export default function NotificationsPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!activeCompany?.id) return
      const { data } = await supabase.from('notifications').select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false }).limit(50)
      setNotifs((data ?? []) as Notif[])
      setLoading(false)
    }
    load()
  }, [activeCompany?.id])

  async function markAllRead() {
    if (!activeCompany?.id) return
    await supabase.from('notifications').update({ is_read: true })
      .eq('company_id', activeCompany.id).eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="text-gray-500 text-sm">Activité de votre compte</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="text-xs text-gray-400 hover:text-white border border-[#1a1b22] px-3 py-1.5 rounded-lg transition-colors">
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500 text-center">Chargement...</div>
        ) : notifs.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-600 text-center">Aucune notification.</div>
        ) : (
          <div className="divide-y divide-[#1a1b22]">
            {notifs.map(n => (
              <div key={n.id} className={`flex gap-3 px-5 py-4 ${!n.is_read ? 'bg-[#d4a843]/5' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-[#1a1b22] flex items-center justify-center text-xs shrink-0">
                  {TYPE_ICONS[n.type] ?? '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">{n.title}</div>
                  {n.message && <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>}
                  <div className="text-[10px] text-gray-600 mt-1">
                    {new Date(n.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#d4a843] mt-1.5 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
