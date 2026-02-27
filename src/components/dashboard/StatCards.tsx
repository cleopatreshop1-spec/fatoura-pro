import { FileText, Clock, Receipt, TrendingUp } from 'lucide-react'
import { fmtTND } from '@/lib/utils/tva-calculator'

export interface StatCardsData {
  invoicesThisMonth: { count: number; ttc: number; trend: number | null }
  pendingTTN: { total: number; pending: number; queued: number }
  tvaQuarter: { amount: number; quarter: number; year: number }
  caHT: { amount: number; validCount: number }
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-[#2dd4a0]' : 'text-[#e05a5a]'}`}>
      {up ? '' : ''} {Math.abs(value).toFixed(0)}%
    </span>
  )
}

export function StatCards({ data }: { data: StatCardsData }) {
  const { invoicesThisMonth, pendingTTN, tvaQuarter, caHT } = data
  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const cards = [
    {
      title: 'Factures ce mois',
      value: String(invoicesThisMonth.count),
      sub: fmtTND(invoicesThisMonth.ttc) + ' TND TTC',
      trend: invoicesThisMonth.trend,
      Icon: FileText,
      accent: '#d4a843',
      iconBg: 'bg-[#d4a843]/10',
    },
    {
      title: 'En attente TTN',
      value: String(pendingTTN.total),
      sub: `${pendingTTN.pending} en cours  ${pendingTTN.queued} en file`,
      trend: null,
      Icon: Clock,
      accent: pendingTTN.total > 0 ? '#4a9eff' : '#374151',
      iconBg: pendingTTN.total > 0 ? 'bg-[#4a9eff]/10' : 'bg-gray-800/50',
    },
    {
      title: 'TVA a declarer',
      value: fmtTND(tvaQuarter.amount),
      sub: `Trimestre Q${tvaQuarter.quarter} ${tvaQuarter.year}`,
      trend: null,
      Icon: Receipt,
      accent: '#d4a843',
      iconBg: 'bg-[#d4a843]/10',
      suffix: ' TND',
    },
    {
      title: "Chiffre d'affaires HT",
      value: fmtTND(caHT.amount),
      sub: `${caHT.validCount} facture${caHT.validCount !== 1 ? 's' : ''} validee${caHT.validCount !== 1 ? 's' : ''} TTN`,
      trend: null,
      Icon: TrendingUp,
      accent: '#2dd4a0',
      iconBg: 'bg-[#2dd4a0]/10',
      suffix: ' TND',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ title, value, sub, trend, Icon, accent, iconBg, suffix }) => (
        <div key={title} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon size={17} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <Trend value={trend} />
          </div>
          <div className="font-mono text-2xl font-black text-white leading-none mb-1">
            {value}<span className="text-sm font-normal text-gray-500 ml-0.5">{suffix}</span>
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 font-medium">{title}</div>
          <div className="text-xs text-gray-500 truncate">{sub}</div>
        </div>
      ))}
    </div>
  )
}
