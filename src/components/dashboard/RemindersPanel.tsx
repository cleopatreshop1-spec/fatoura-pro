'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Priority = 'critical' | 'warning' | 'info' | 'neutral'

type Reminder = {
  id: string
  priority: Priority
  icon: string
  title: string
  subtitle: string
  relativeTime: string
  actionLabel?: string
  actionHref?: string
}

const BORDER: Record<Priority, string> = {
  critical: 'border-l-red-500/60',
  warning:  'border-l-yellow-500/60',
  info:     'border-l-blue-500/60',
  neutral:  'border-l-gray-700',
}

const BG: Record<Priority, string> = {
  critical: 'bg-red-950/20',
  warning:  'bg-yellow-950/20',
  info:     'bg-blue-950/20',
  neutral:  'bg-[#161b27]',
}

const DOT: Record<Priority, string> = {
  critical: 'bg-red-500',
  warning:  'bg-yellow-500',
  info:     'bg-blue-500',
  neutral:  'bg-gray-600',
}

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAll, setShowAll]     = useState(false)

  const fetchReminders = useCallback(async () => {
    try {
      const res  = await fetch('/api/dashboard/reminders')
      const json = await res.json()
      setReminders(json.reminders ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchReminders()
    const interval = setInterval(fetchReminders, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchReminders])

  const displayed  = showAll ? reminders : reminders.slice(0, 5)
  const hasMore    = reminders.length > 5
  const critCount  = reminders.filter(r => r.priority === 'critical').length

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a1b22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white">Actions requises</h2>
          {critCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {critCount}
            </span>
          )}
        </div>
        <button onClick={fetchReminders}
          className="text-gray-600 hover:text-gray-400 transition-colors text-xs">
          ↺
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-l-2 border-l-gray-700 bg-[#161b27] rounded-r-xl px-3 py-3 animate-pulse">
                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-[#252830] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#252830] rounded w-3/4" />
                    <div className="h-2.5 bg-[#252830] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-gray-500 font-medium">Tout est en ordre !</p>
            <p className="text-xs text-gray-600 mt-1">Aucune action requise</p>
          </div>
        ) : (
          displayed.map(r => (
            <div key={r.id}
              className={`border-l-2 ${BORDER[r.priority]} ${BG[r.priority]} rounded-r-xl px-3 py-3`}>
              <div className="flex items-start gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${DOT[r.priority]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white leading-snug">{r.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{r.subtitle}</p>
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <span className="text-[10px] text-gray-600">{r.relativeTime}</span>
                    {r.actionLabel && r.actionHref && (
                      <Link href={r.actionHref}
                        className="text-[11px] text-[#d4a843] hover:text-[#f0c060] font-semibold transition-colors whitespace-nowrap">
                        {r.actionLabel}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {hasMore && !showAll && (
          <button onClick={() => setShowAll(true)}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-[#1a1b22] rounded-lg mt-1">
            Voir {reminders.length - 5} de plus...
          </button>
        )}
      </div>
    </div>
  )
}
