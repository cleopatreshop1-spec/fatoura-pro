'use client'

import { useState, useMemo } from 'react'
import { Target, Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

interface Props {
  caHT: number
  ytdHT: number
  monthlyGoal: number | null
  annualGoal: number | null
  year: number
  monthLabel: string
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

function GoalBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  const barCol = pct >= 100 ? 'bg-[#2dd4a0]' : pct >= 80 ? color : pct >= 50 ? 'bg-[#f59e0b]' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{fmtTND(value)} TND</span>
        <span className={`font-bold ${pct >= 100 ? 'text-[#2dd4a0]' : pct >= 80 ? 'text-[#d4a843]' : pct >= 50 ? 'text-[#f59e0b]' : 'text-red-400'}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-[#1a1b22] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barCol}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-gray-700">Objectif : {fmtTND(goal)} TND</div>
    </div>
  )
}

export function RevenueGoalWidget({ caHT, ytdHT, monthlyGoal: initMonthly, annualGoal: initAnnual, year, monthLabel }: Props) {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(initMonthly)
  const [annualGoal,  setAnnualGoal]  = useState<number | null>(initAnnual)
  const [editing, setEditing]         = useState<'monthly' | 'annual' | null>(null)
  const [input, setInput]             = useState('')
  const [saving, setSaving]           = useState(false)

  async function save(field: 'monthly' | 'annual') {
    if (!activeCompany?.id) return
    const val = parseFloat(input) || 0
    setSaving(true)
    const col = field === 'monthly' ? 'monthly_revenue_goal' : 'annual_revenue_goal'
    await (supabase as any).from('companies').update({ [col]: val > 0 ? val : null }).eq('id', activeCompany.id)
    if (field === 'monthly') setMonthlyGoal(val > 0 ? val : null)
    else setAnnualGoal(val > 0 ? val : null)
    setSaving(false)
    setEditing(null)
    setInput('')
  }

  const hasAny = monthlyGoal || annualGoal

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-[#d4a843]" />
          <span className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Objectifs</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Monthly */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-semibold">{monthLabel}</span>
            {editing === 'monthly' ? (
              <div className="flex items-center gap-1">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  type="number" min="0" step="1000"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') save('monthly'); if (e.key === 'Escape') { setEditing(null); setInput('') } }}
                  className="w-28 bg-[#0a0b0f] border border-[#d4a843]/50 rounded-lg px-2 py-1 text-xs text-white outline-none font-mono"
                  placeholder="ex: 10000"
                />
                <button onClick={() => save('monthly')} disabled={saving}
                  className="p-1 rounded text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition-colors disabled:opacity-50">
                  <Check size={12} />
                </button>
                <button onClick={() => { setEditing(null); setInput('') }}
                  className="p-1 rounded text-gray-600 hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditing('monthly'); setInput(monthlyGoal ? String(monthlyGoal) : '') }}
                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-[#d4a843] transition-colors">
                <Pencil size={10} />{monthlyGoal ? 'Modifier' : 'Définir'}
              </button>
            )}
          </div>
          {monthlyGoal ? (
            <GoalBar value={caHT} goal={monthlyGoal} color="bg-[#d4a843]" />
          ) : (
            <div className="h-2 bg-[#1a1b22] rounded-full" />
          )}
        </div>

        {/* Annual */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-semibold">Année {year}</span>
            {editing === 'annual' ? (
              <div className="flex items-center gap-1">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  type="number" min="0" step="10000"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') save('annual'); if (e.key === 'Escape') { setEditing(null); setInput('') } }}
                  className="w-28 bg-[#0a0b0f] border border-[#d4a843]/50 rounded-lg px-2 py-1 text-xs text-white outline-none font-mono"
                  placeholder="ex: 120000"
                />
                <button onClick={() => save('annual')} disabled={saving}
                  className="p-1 rounded text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition-colors disabled:opacity-50">
                  <Check size={12} />
                </button>
                <button onClick={() => { setEditing(null); setInput('') }}
                  className="p-1 rounded text-gray-600 hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditing('annual'); setInput(annualGoal ? String(annualGoal) : '') }}
                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-[#d4a843] transition-colors">
                <Pencil size={10} />{annualGoal ? 'Modifier' : 'Définir'}
              </button>
            )}
          </div>
          {annualGoal ? (
            <GoalBar value={ytdHT} goal={annualGoal} color="bg-purple-500" />
          ) : (
            <div className="h-2 bg-[#1a1b22] rounded-full" />
          )}
        </div>

        {!hasAny && (
          <p className="text-[11px] text-gray-600 text-center pt-1">
            Définissez vos objectifs pour suivre votre progression.
          </p>
        )}
      </div>
    </div>
  )
}
