'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'

type Insight = {
  icon: string
  text: string
  type: 'info' | 'warning' | 'success' | 'tip'
}

const TYPE_STYLES: Record<string, string> = {
  success: 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300',
  warning: 'border-yellow-800/40 bg-yellow-950/20 text-yellow-300',
  tip:     'border-[#d4a843]/30 bg-[#1a1508]/40 text-[#d4a843]',
  info:    'border-[#1a1b22] bg-[#0f1118] text-gray-300',
}

export function AIInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/insights')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur IA')
      setInsights(data.insights ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1a1508] border border-[#d4a843]/40 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#d4a843]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Insights IA</h3>
            <p className="text-[10px] text-gray-600">Analyse de votre activité</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-600 hover:text-[#d4a843] disabled:opacity-40 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
          <Loader2 size={13} className="animate-spin text-[#d4a843]" />
          AI en cours d&apos;analyse...
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 py-2">{error}</p>
      )}

      {!loading && !error && insights.length === 0 && (
        <p className="text-xs text-gray-600 py-2">Pas encore assez de données pour générer des insights.</p>
      )}

      {!loading && insights.length > 0 && (
        <ul className="space-y-2">
          {insights.map((ins, i) => (
            <li
              key={i}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-sm ${TYPE_STYLES[ins.type] ?? TYPE_STYLES.info}`}
            >
              <span className="text-base leading-none mt-0.5 shrink-0">{ins.icon}</span>
              <span className="leading-snug">{ins.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
