'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

interface Props {
  revenueHT: number
  expensesTotal: number
  expensesByCategory: { label: string; amount: number; color: string }[]
  month: string
}

export function ProfitLossWidget({ revenueHT, expensesTotal, expensesByCategory, month }: Props) {
  const profit = revenueHT - expensesTotal
  const margin = revenueHT > 0 ? Math.round((profit / revenueHT) * 100) : 0
  const isProfit = profit >= 0

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Résultat du mois</h2>
          <p className="text-xs text-gray-600 mt-0.5">{month} — Revenus HT − Dépenses</p>
        </div>
        <Link href="/dashboard/expenses" className="text-xs text-gray-600 hover:text-[#d4a843] transition-colors">
          Voir dépenses →
        </Link>
      </div>

      {/* Main P&L numbers */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#161b27] rounded-xl px-3 py-3 text-center">
          <p className="text-[10px] text-gray-600 mb-1">Revenus HT</p>
          <p className="text-sm font-mono font-bold text-[#2dd4a0]">{fmt(revenueHT)}</p>
          <p className="text-[9px] text-gray-700 mt-0.5">TND</p>
        </div>
        <div className="bg-[#161b27] rounded-xl px-3 py-3 text-center">
          <p className="text-[10px] text-gray-600 mb-1">Dépenses</p>
          <p className="text-sm font-mono font-bold text-red-400">{fmt(expensesTotal)}</p>
          <p className="text-[9px] text-gray-700 mt-0.5">TND</p>
        </div>
        <div className={`rounded-xl px-3 py-3 text-center border ${
          isProfit
            ? 'bg-[#2dd4a0]/5 border-[#2dd4a0]/20'
            : 'bg-red-950/20 border-red-900/30'
        }`}>
          <p className="text-[10px] text-gray-600 mb-1">Résultat net</p>
          <p className={`text-sm font-mono font-bold ${isProfit ? 'text-[#2dd4a0]' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{fmt(profit)}
          </p>
          <p className="text-[9px] text-gray-700 mt-0.5">TND</p>
        </div>
      </div>

      {/* Margin bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-600">Marge bénéficiaire</span>
          <div className="flex items-center gap-1">
            {isProfit
              ? <TrendingUp size={11} className="text-[#2dd4a0]" />
              : profit < 0
              ? <TrendingDown size={11} className="text-red-400" />
              : <Minus size={11} className="text-gray-500" />}
            <span className={`text-xs font-mono font-bold ${
              margin >= 20 ? 'text-[#2dd4a0]' : margin >= 0 ? 'text-[#d4a843]' : 'text-red-400'
            }`}>
              {margin}%
            </span>
          </div>
        </div>
        <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              margin >= 20 ? 'bg-[#2dd4a0]' : margin >= 0 ? 'bg-[#d4a843]' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, Math.abs(margin)))}%` }}
          />
        </div>
      </div>

      {/* Expenses breakdown */}
      {expensesByCategory.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Dépenses par catégorie</p>
          {expensesByCategory.slice(0, 5).map(cat => (
            <div key={cat.label} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-gray-500 truncate">{cat.label}</span>
              </div>
              <div className="flex-1 h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500/60"
                  style={{ width: expensesTotal > 0 ? `${(cat.amount / expensesTotal) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-500 shrink-0 w-20 text-right">
                {fmt(cat.amount)} TND
              </span>
            </div>
          ))}
        </div>
      )}

      {expensesTotal === 0 && revenueHT === 0 && (
        <p className="text-center text-xs text-gray-600 py-2">
          Aucune donnée ce mois.{' '}
          <Link href="/dashboard/expenses" className="text-[#d4a843] hover:underline">Ajouter des dépenses</Link>
        </p>
      )}
    </div>
  )
}
