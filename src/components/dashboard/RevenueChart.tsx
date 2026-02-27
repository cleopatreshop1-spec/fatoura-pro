'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type MonthData = {
  month: string
  ht: number
  tva: number
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)
  return (
    <div className="bg-[#111318] border border-[#252830] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      <div className="text-[#d4a843] font-mono">HT: {fmt(payload[0]?.value ?? 0)} TND</div>
      <div className="text-[#7c5cbf] font-mono">TVA: {fmt(payload[1]?.value ?? 0)} TND</div>
    </div>
  )
}

export function RevenueChart({ invoices }: {
  invoices: { issue_date?: string | null; ht_amount?: number | string | null; tva_amount?: number | string | null; status?: string | null }[]
}) {
  // Build last 6 months of data
  const now = new Date()
  const months: MonthData[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: MONTHS_FR[d.getMonth()], ht: 0, tva: 0 })
  }

  for (const inv of invoices) {
    if (!inv.issue_date) continue
    const d = new Date(inv.issue_date)
    const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (diffMonths < 0 || diffMonths > 5) continue
    const idx = 5 - diffMonths
    months[idx].ht += Number(inv.ht_amount ?? 0)
    months[idx].tva += Number(inv.tva_amount ?? 0)
  }

  const hasData = months.some(m => m.ht > 0)

  return (
    <div className="bg-[#0f1118] border border-[#252830] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Chiffre d'affaires — 6 derniers mois
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d4a843] inline-block" />
            HT
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7c5cbf] inline-block" />
            TVA
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-600">
          Aucune donnée pour la période
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradHT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a843" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d4a843" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTVA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c5cbf" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c5cbf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1a1f2e" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="ht"
              stroke="#d4a843"
              strokeWidth={2}
              fill="url(#gradHT)"
              dot={false}
              activeDot={{ r: 4, fill: '#d4a843' }}
            />
            <Area
              type="monotone"
              dataKey="tva"
              stroke="#7c5cbf"
              strokeWidth={2}
              fill="url(#gradTVA)"
              dot={false}
              activeDot={{ r: 4, fill: '#7c5cbf' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
