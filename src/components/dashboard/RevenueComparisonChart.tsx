'use client'

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts'

type DayPoint = { day: number; current: number | null; prev: number | null }

type Props = {
  data: DayPoint[]
  currentLabel: string
  prevLabel: string
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1118] border border-[#252830] rounded-xl px-3 py-2.5 text-xs shadow-2xl min-w-[140px]">
      <p className="text-gray-500 mb-1.5 font-semibold">Jour {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 items-center">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {p.value != null ? fmtTND(p.value) + ' TND' : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function RevenueComparisonChart({ data, currentLabel, prevLabel }: Props) {
  const hasData = data.some(d => (d.current ?? 0) > 0 || (d.prev ?? 0) > 0)
  if (!hasData) return null

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Comparaison revenus
          </h3>
          <p className="text-[10px] text-gray-600 mt-0.5">Cumulatif journalier — HT</p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 bg-[#d4a843] rounded-full inline-block" />
            <span className="text-gray-400">{currentLabel}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 border-t-2 border-dashed border-gray-600 inline-block" />
            <span className="text-gray-600">{prevLabel}</span>
          </span>
        </div>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1b22" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#4b5563', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}`}
            />
            <YAxis
              tickFormatter={v => fmtTND(v)}
              tick={{ fill: '#4b5563', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="current"
              name={currentLabel}
              stroke="#d4a843"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#d4a843' }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="prev"
              name={prevLabel}
              stroke="#374151"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, fill: '#6b7280' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
