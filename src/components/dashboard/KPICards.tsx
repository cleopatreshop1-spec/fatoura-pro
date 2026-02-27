// src/components/dashboard/KPICards.tsx
// This is a Client Component only because it needs no interactivity
// but uses formatting — could also be a Server Component

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n)

interface KPIs {
  totalCA: number
  totalTVA: number
  pendingCount: number
  clientCount: number
}

export function KPICards({ kpis }: { kpis: KPIs }) {
  const cards = [
    {
      label: 'Chiffre d\'Affaires',
      value: fmtTND(kpis.totalCA),
      suffix: 'TND HT',
      color: 'text-[#d4a843]',
      accent: 'from-[#d4a843]',
    },
    {
      label: 'TVA Collectée',
      value: fmtTND(kpis.totalTVA),
      suffix: 'TND',
      color: 'text-purple-400',
      accent: 'from-purple-500',
    },
    {
      label: 'En Attente',
      value: String(kpis.pendingCount),
      suffix: 'brouillons',
      color: 'text-green-400',
      accent: 'from-green-500',
    },
    {
      label: 'Clients',
      value: String(kpis.clientCount),
      suffix: 'actifs',
      color: 'text-blue-400',
      accent: 'from-blue-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(card => (
        <div
          key={card.label}
          className="bg-[#111318] border border-[#252830] rounded-xl p-4 relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.accent} to-transparent`} />

          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            {card.label}
          </div>
          <div className={`font-mono text-xl font-bold ${card.color}`}>
            {card.value}
          </div>
          <div className="text-[11px] text-gray-600 mt-1">{card.suffix}</div>
        </div>
      ))}
    </div>
  )
}