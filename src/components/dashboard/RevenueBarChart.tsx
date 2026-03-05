'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export type ChartMonth = { month: string; ht: number; tva: number }

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fmtTND = (v: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)
  return (
    <div className="bg-[#161b27] border border-[#252830] rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[140px]">
      <div className="text-gray-400 font-medium mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2 h-2 rounded-sm bg-[#d4a843] inline-block" />CA HT
          </span>
          <span className="font-mono text-[#d4a843] font-bold">{fmtTND(payload[0]?.value ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2 h-2 rounded-sm bg-[#2dd4a0] inline-block" />TVA
          </span>
          <span className="font-mono text-[#2dd4a0] font-bold">{fmtTND(payload[1]?.value ?? 0)}</span>
        </div>
      </div>
    </div>
  )
}

function CustomLegend() {
  return (
    <div className="flex items-center justify-end gap-5 mb-4 text-[11px] text-gray-500">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-[#d4a843] inline-block" />CA HT
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-[#2dd4a0] inline-block" />TVA collectée
      </span>
    </div>
  )
}

export function RevenueBarChart({ data }: { data: ChartMonth[] }) {
  const hasData = data.some(m => m.ht > 0 || m.tva > 0)
  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-gray-200">Évolution sur 6 mois</h2>
      </div>
      <CustomLegend />

      {!hasData ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-gray-600">
          Aucune donnée pour la période
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={3} barCategoryGap="30%">
            <CartesianGrid stroke="#1a1b22" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={fmt}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="ht" name="CA HT" fill="#d4a843" radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="tva" name="TVA" fill="#2dd4a0" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
