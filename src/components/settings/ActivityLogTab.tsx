'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

type LogEntry = {
  id: string
  action_type: string
  description: string
  entity_type: string
  entity_id: string
  created_at: string
}

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  'invoice_created':        { label: 'Facture créée',               color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  'invoice_submitted':      { label: 'Soumise à TTN',               color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  'invoice_validated':      { label: 'Validée par TTN ✓',           color: 'bg-green-500/15 text-green-400 border-green-500/25' },
  'invoice_rejected':       { label: 'Rejetée par TTN',             color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  'invoice_deleted':        { label: 'Brouillon supprimé',          color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
  'invoice_updated':        { label: 'Facture modifiée',            color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  'invoice_payment_updated':{ label: 'Paiement mis à jour',         color: 'bg-teal-500/15 text-teal-400 border-teal-500/25' },
  'mandate_accepted':       { label: 'Mandat activé',               color: 'bg-green-500/15 text-green-400 border-green-500/25' },
  'mandate_revoked':        { label: 'Mandat révoqué',              color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  'certificate_uploaded':   { label: 'Certificat ANCE importé',     color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  'client_created':         { label: 'Client ajouté',               color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  'client_updated':         { label: 'Client modifié',              color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  'api_key_created':        { label: 'Clé API générée',             color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  'api_key_revoked':        { label: 'Clé API révoquée',            color: 'bg-red-500/15 text-red-400 border-red-500/25' },
}

const TYPE_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Tous',          prefix: '' },
  { label: 'Factures',      prefix: 'invoice' },
  { label: 'Clients',       prefix: 'client' },
  { label: 'Signature',     prefix: 'mandate' },
  { label: 'API Keys',      prefix: 'api_key' },
  { label: 'Certificats',   prefix: 'certificate' },
]

export function ActivityLogTab() {
  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch]   = useState('')
  const [searchInput, setSearchInput] = useState('')

  const LIMIT = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (typeFilter) sp.set('type', typeFilter)
      if (search)     sp.set('search', search)
      const res  = await fetch(`/api/activity-log?${sp}`)
      const json = await res.json()
      setLogs(json.logs ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMIT)

  function getBadge(action: string) {
    const match = Object.entries(ACTION_MAP).find(([key]) => action.includes(key))
    return match?.[1] ?? { label: action, color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 flex-wrap">
          {TYPE_GROUPS.map(g => (
            <button
              key={g.prefix}
              onClick={() => { setTypeFilter(g.prefix); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === g.prefix
                  ? 'bg-[#d4a843] text-black'
                  : 'bg-[#161b27] text-gray-400 hover:text-white border border-[#1a1b22]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher..."
            className="bg-[#161b27] border border-[#1a1b22] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors w-48"
          />
          <button type="submit" className="px-3 py-1.5 bg-[#161b27] border border-[#1a1b22] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            Chercher
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1b22]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date/Heure</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center py-12 text-gray-600 text-sm">Chargement...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-12 text-gray-600 text-sm">Aucune activité trouvée</td></tr>
            ) : (
              logs.map(log => {
                const badge = getBadge(log.action_type)
                return (
                  <tr key={log.id} className="border-b border-[#1a1b22] last:border-0 hover:bg-[#161b27]/40 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {format(parseISO(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-xs truncate">
                      {log.description}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{total} entrées au total</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-[#161b27] border border-[#1a1b22] rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              ← Précédent
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-[#161b27] border border-[#1a1b22] rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
