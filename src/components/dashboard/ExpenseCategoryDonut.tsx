'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#d4a843', '#2dd4a0', '#4a9eff', '#e05a5a', '#a78bfa', '#f97316', '#ec4899', '#06b6d4']

type Props = {
  data: { label: string; amount: number; color: string }[]
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-[#0f1118] border border-[#252830] rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-gray-300 font-medium">{d.name}</p>
      <p className="font-mono font-bold mt-0.5" style={{ color: d.payload.fill }}>
        {fmtTND(d.value)} TND
      </p>
    </div>
  )
}

export function ExpenseCategoryDonut({ data }: Props) {
  const top5 = [...data].sort((a, b) => b.amount - a.amount).slice(0, 5).filter(d => d.amount > 0)
  if (top5.length === 0) return null

  const total = top5.reduce((s, d) => s + d.amount, 0)
  const chartData = top5.map((d, i) => ({ name: d.label, value: d.amount, fill: COLORS[i % COLORS.length] }))

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Top dépenses</h3>
        <p className="text-[10px] text-gray-600 mt-0.5">Par catégorie — ce mois</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-[110px] h-[110px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 min-w-0">
          {chartData.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: d.fill }} />
              <span className="text-[10px] text-gray-400 truncate flex-1">{d.name}</span>
              <span className="text-[10px] font-mono text-gray-300 shrink-0">
                {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
