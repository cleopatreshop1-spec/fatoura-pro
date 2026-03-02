'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  score: number
  grade: string
  scoreColor: string
  scoreA: number
  scoreB: number
  scoreC: number
  scoreD: number
}

const RADIUS = 68
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getScoreComponents(scoreA: number, scoreB: number, scoreC: number, scoreD: number) {
  return [
    { label: 'Soumission TTN < 7j', value: scoreA, max: 40, tip: 'Soumettez vos factures dès leur création pour maximiser ce score' },
    { label: 'Validation 1er coup', value: scoreB, max: 30, tip: 'Vérifiez les matricules fiscaux et les montants avant soumission' },
    { label: 'Paiements à temps',   value: scoreC, max: 20, tip: 'Relancez vos clients avant l\'échéance' },
    { label: 'Profil complet',      value: scoreD, max: 10, tip: 'Complétez logo, adresse, RIB et matricule fiscal' },
  ]
}

export function FiscalHealthScore({ score, grade, scoreColor, scoreA, scoreB, scoreC, scoreD }: Props) {
  const [animated, setAnimated] = useState(0)
  const [showTip, setShowTip] = useState<number | null>(null)
  const prevScore = useRef(0)

  useEffect(() => {
    const duration = 1200
    const start = Date.now()
    const from = prevScore.current
    const raf = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimated(Math.round(from + (score - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prevScore.current = score
    })
    return () => cancelAnimationFrame(raf)
  }, [score])

  const dashOffset = CIRCUMFERENCE - (animated / 100) * CIRCUMFERENCE
  const components = getScoreComponents(scoreA, scoreB, scoreC, scoreD)

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6">
      <h2 className="text-sm font-bold text-white mb-5">Score de Santé Fiscale</h2>

      <div className="flex items-center gap-6">
        {/* SVG Gauge */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <svg width="160" height="160" className="-rotate-90">
            {/* Background circle */}
            <circle cx="80" cy="80" r={RADIUS} fill="none"
              stroke="#1a1b22" strokeWidth="12" />
            {/* Animated score arc */}
            <circle cx="80" cy="80" r={RADIUS} fill="none"
              stroke={scoreColor} strokeWidth="12"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 8px ${scoreColor}60)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono font-black text-5xl leading-none" style={{ color: scoreColor }}>
              {animated}
            </span>
            <span className="text-lg font-bold text-gray-500 mt-1">{grade}</span>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="flex-1 space-y-3">
          {components.map((c, i) => (
            <div key={c.label} className="relative">
              <div className="flex justify-between items-center mb-1">
                <button
                  onClick={() => setShowTip(showTip === i ? null : i)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
                >
                  {c.label} ⓘ
                </button>
                <span className="text-xs font-mono text-gray-400">{Math.round(c.value)}/{c.max}</span>
              </div>
              <div className="h-1.5 bg-[#161b27] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(c.value / c.max) * 100}%`,
                    background: scoreColor,
                    opacity: 0.8,
                  }}
                />
              </div>
              {showTip === i && (
                <div className="absolute left-0 top-full mt-1.5 z-10 bg-[#161b27] border border-[#252830] rounded-lg px-3 py-2 text-xs text-gray-400 w-64 shadow-xl">
                  {c.tip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
