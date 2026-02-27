export type ActivityItem = {
  id: string
  action_type: string
  description: string | null
  created_at: string
  entity_type: string | null
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hier' : `il y a ${d}j`
}

const ICONS: Record<string, { icon: string; color: string }> = {
  invoice_created:   { icon: 'FAC', color: 'text-gray-400 bg-gray-800/60' },
  invoice_validated: { icon: 'OK',  color: 'text-[#2dd4a0] bg-[#2dd4a0]/10' },
  invoice_rejected:  { icon: 'KO',  color: 'text-[#e05a5a] bg-[#e05a5a]/10' },
  invoice_queued:    { icon: 'Q',   color: 'text-[#4a9eff] bg-[#4a9eff]/10' },
  client_created:    { icon: 'USR', color: 'text-purple-400 bg-purple-500/10' },
  mandate_accepted:  { icon: 'SIG', color: 'text-[#d4a843] bg-[#d4a843]/10' },
  default:           { icon: '', color: 'text-gray-500 bg-gray-800/40' },
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-[#1a1b22] shrink-0">
        <h2 className="text-sm font-bold text-gray-200">Activite recente</h2>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12 text-sm text-gray-600">
          Aucune activite recente
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#1a1b22]">
          {items.map(item => {
            const cfg = ICONS[item.action_type] ?? ICONS.default
            return (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#161b27] transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0 ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-snug">
                    {item.description ?? item.action_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(item.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
