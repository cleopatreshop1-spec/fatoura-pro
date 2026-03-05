'use client'

import { Flame, Star, Trophy, Award } from 'lucide-react'

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  platine: {
    label:  'Champion TTN',
    color:  'text-purple-300',
    bg:     'bg-purple-950/40',
    border: 'border-purple-700/40',
    icon:   <Trophy size={13} className="text-purple-400" />,
  },
  or: {
    label:  'Expert',
    color:  'text-[#d4a843]',
    bg:     'bg-[#d4a843]/10',
    border: 'border-[#d4a843]/30',
    icon:   <Star size={13} className="text-[#d4a843]" />,
  },
  argent: {
    label:  'Actif',
    color:  'text-gray-300',
    bg:     'bg-gray-800/40',
    border: 'border-gray-600/40',
    icon:   <Award size={13} className="text-gray-400" />,
  },
  bronze: {
    label:  'Débutant',
    color:  'text-orange-400',
    bg:     'bg-orange-950/30',
    border: 'border-orange-800/30',
    icon:   <Award size={13} className="text-orange-500" />,
  },
}

interface Props {
  level:       string
  streakDays:  number
  totalPoints: number
  compact?:    boolean
}

export function GamificationBadge({ level, streakDays, totalPoints, compact = false }: Props) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.bronze!

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </span>
        {streakDays >= 2 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-orange-800/30 bg-orange-950/20 text-[10px] font-bold text-orange-400">
            <Flame size={10} />
            {streakDays}j
          </span>
        )}
      </div>
    )
  }

  const NEXT_THRESHOLD: Record<string, number> = {
    bronze:  500,
    argent:  2000,
    or:      5000,
    platine: 5000,
  }
  const CURRENT_MIN: Record<string, number> = {
    bronze: 0, argent: 500, or: 2000, platine: 5000,
  }
  const nextThreshold = NEXT_THRESHOLD[level] ?? 500
  const currentMin    = CURRENT_MIN[level]    ?? 0
  const progress = level === 'platine'
    ? 100
    : Math.min(100, Math.round(((totalPoints - currentMin) / (nextThreshold - currentMin)) * 100))

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cfg.icon}
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">{totalPoints} pts</span>
      </div>

      {/* Progress bar */}
      {level !== 'platine' && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-600 mb-1">
            <span>{totalPoints} pts</span>
            <span>{nextThreshold} pts</span>
          </div>
          <div className="h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: cfg.color.replace('text-', '') === cfg.color ? '#d4a843' : undefined, backgroundColor: level === 'platine' ? '#c084fc' : level === 'or' ? '#d4a843' : level === 'argent' ? '#9ca3af' : '#fb923c' }}
            />
          </div>
        </div>
      )}

      {/* Streak */}
      <div className="flex items-center gap-2 pt-1">
        <Flame size={14} className={streakDays >= 7 ? 'text-orange-400' : streakDays >= 3 ? 'text-orange-500' : 'text-gray-600'} />
        <span className="text-xs text-gray-400">
          {streakDays >= 1
            ? <><span className="text-white font-bold">{streakDays}</span> jour{streakDays > 1 ? 's' : ''} de série active</>
            : 'Aucune série en cours'}
        </span>
        {streakDays >= 7 && (
          <span className="text-[10px] bg-orange-950/30 border border-orange-800/30 text-orange-400 px-1.5 py-0.5 rounded-full font-bold ml-auto">
            🔥 Bonus x7!
          </span>
        )}
      </div>
    </div>
  )
}
