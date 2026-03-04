'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

type DataPoint = {
  date: string
  label: string
  encaisse: number | null
  attendu:  number | null
  tendance: number | null
}

type SparkPoint = { day: string; amount: number }

type Props = {
  data: DataPoint[]
  paidThisMonth: number
  unpaidTotal: number
  caHT: number
  cashSparkline4w?: SparkPoint[]
}

const fmt = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v.toFixed(0)
}

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1118] border border-[#252830] rounded-xl px-4 py-3 shadow-2xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">Semaine du {label}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-400">{p.name} :</span>
            <span className="text-white font-mono font-semibold">{fmtTND(p.value)} TND</span>
          </div>
        )
      ))}
    </div>
  )
}

const WINDOWS = [
  { label: '30j',  days: 30  },
  { label: '60j',  days: 60  },
  { label: '90j',  days: 90  },
]

function MiniSparkline({ data, color }: { data: SparkPoint[]; color: string }) {
  const max = Math.max(...data.map(d => d.amount), 1)
  const W = 56, H = 18
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.amount / max) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function CashFlowChart({ data, paidThisMonth, unpaidTotal, caHT, cashSparkline4w }: Props) {
  const [window, setWindow] = useState(90)

  const today = new Date().toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() - window * 86400000).toISOString().slice(0, 10)
  const cutoffFuture = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const filtered = data.filter(d => d.date >= cutoff && d.date <= cutoffFuture)

  const hasData = filtered.some(d => (d.encaisse ?? 0) > 0 || (d.attendu ?? 0) > 0)

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Trésorerie — 90 jours glissants</h2>
          <p className="text-xs text-gray-600 mt-0.5">Encaissé réel + échéances à venir</p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map(w => (
            <button key={w.days} onClick={() => setWindow(w.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                window === w.days
                  ? 'bg-[#d4a843] text-black'
                  : 'bg-[#161b27] text-gray-500 hover:text-white border border-[#1a1b22]'
              }`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px]">
        {!hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-600">Pas encore de données — créez vos premières factures</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEncaisse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2dd4a0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2dd4a0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAttendu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4a9eff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4a9eff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#d4a843" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#d4a843" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1b22" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 11 }}
                axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmt} tick={{ fill: '#4b5563', fontSize: 11 }}
                axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                stroke="#333" strokeDasharray="4 4" label={{ value: 'Auj.', fill: '#555', fontSize: 10 }} />
              <Area type="monotone" dataKey="encaisse" name="Encaissé"
                stroke="#2dd4a0" strokeWidth={2} fill="url(#gradEncaisse)"
                connectNulls dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="attendu" name="Attendu"
                stroke="#4a9eff" strokeWidth={2} fill="url(#gradAttendu)"
                connectNulls dot={false} activeDot={{ r: 4 }} strokeDasharray="5 3" />
              <Area type="monotone" dataKey="tendance" name="Tendance"
                stroke="#d4a843" strokeWidth={1.5} fill="url(#gradTendance)"
                connectNulls dot={false} activeDot={false} strokeDasharray="8 4" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom metrics */}
      <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#1a1b22]">
        {[
          { label: 'CA ce mois (HT)', value: fmtTND(caHT) + ' TND', color: 'text-white' },
          { label: 'Encaissé', value: fmtTND(paidThisMonth) + ' TND', color: 'text-[#2dd4a0]', sparkline: cashSparkline4w },
          { label: 'En attente', value: fmtTND(unpaidTotal) + ' TND', color: 'text-[#f59e0b]' },
          {
            label: 'Taux recouvrement',
            value: (caHT + unpaidTotal) > 0
              ? Math.round((paidThisMonth / (paidThisMonth + unpaidTotal)) * 100) + '%'
              : '—',
            color: (() => {
              const rate = (paidThisMonth + unpaidTotal) > 0
                ? paidThisMonth / (paidThisMonth + unpaidTotal) : 0
              return rate >= 0.8 ? 'text-[#2dd4a0]' : rate >= 0.5 ? 'text-[#f59e0b]' : 'text-red-400'
            })(),
          },
        ].map(m => (
          <div key={m.label} className="text-center">
            <p className={`text-sm font-mono font-bold ${m.color}`}>{m.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{m.label}</p>
            {'sparkline' in m && m.sparkline && m.sparkline.some((p: SparkPoint) => p.amount > 0) && (
              <div className="flex justify-center mt-1">
                <MiniSparkline data={m.sparkline} color="#2dd4a0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
