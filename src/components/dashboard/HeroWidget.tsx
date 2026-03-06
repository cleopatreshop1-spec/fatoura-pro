'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

type Props = {
  firstName: string
  unpaidTotal: number
  unpaidCount: number
  treasury30: number
  isNewUser: boolean
  hasAlert: boolean
  alertMessage?: string
  alertInvoiceId?: string
  streakDays?: number
  level?: string
  totalPoints?: number
}

const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function getGreeting() {
  const h = new Date().getHours()
  if (h < 6)  return { text: 'Bonne nuit',  icon: '🌙' }
  if (h < 12) return { text: 'Bonjour',     icon: '☀️' }
  if (h < 18) return { text: 'Bon après-midi', icon: '🌤️' }
  return       { text: 'Bonsoir',            icon: '🌙' }
}

function formatDate() {
  const d = new Date()
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

function AnimatedTND({ value, className }: { value: number; className: string }) {
  const anim = useAnimatedNumber(value)
  return <span className={className}>{fmtTND(anim)}</span>
}

export function HeroWidget({
  firstName, unpaidTotal, unpaidCount, treasury30,
  isNewUser, hasAlert, alertMessage, alertInvoiceId,
  streakDays = 0, level = 'bronze', totalPoints = 0,
}: Props) {
  const greeting = getGreeting()

  if (isNewUser) {
    return (
      <div className="relative bg-gradient-to-br from-[#0f1118] via-[#10141e] to-[#0d1020] border border-[#1a1b22] rounded-2xl p-7 overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#d4a843]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
          <h1 className="text-xl font-black text-white tracking-tight">
            {greeting.text}, {firstName} {greeting.icon}
          </h1>
          <span className="text-xs text-gray-600">{formatDate()}</span>
        </div>
        <OnboardingChecklist />
      </div>
    )
  }

  return (
    <div className={`relative border rounded-2xl p-7 overflow-hidden ${
      hasAlert
        ? 'bg-gradient-to-br from-[#130f0f] via-[#0f1118] to-[#0f1118] border-red-900/40'
        : 'bg-gradient-to-br from-[#0f1118] via-[#10141e] to-[#0d1020] border-[#1a1b22]'
    }`}>
      {/* Decorative ambient glows */}
      <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#d4a843]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#2dd4a0]/3 rounded-full blur-3xl pointer-events-none" />

      {/* Header row */}
      <div className="relative flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-600 mb-0.5">{formatDate()}</p>
          <h1 className="text-xl font-black text-white tracking-tight">
            {greeting.text}, {firstName} {greeting.icon}
          </h1>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_16px_rgba(212,168,67,0.25)] hover:shadow-[0_0_24px_rgba(212,168,67,0.4)]"
        >
          <Plus size={14} strokeWidth={2.5} />
          Nouvelle facture
        </Link>
      </div>

      {/* TTN alert */}
      {hasAlert && alertMessage && (
        <div className="relative flex items-center gap-3 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-5">
          <span className="text-lg shrink-0">⚠️</span>
          <p className="text-sm text-red-300 flex-1 leading-snug">{alertMessage}</p>
          {alertInvoiceId && (
            <Link href={`/dashboard/invoices/${alertInvoiceId}`}
              className="shrink-0 px-3 py-1.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
              Soumettre →
            </Link>
          )}
        </div>
      )}

      {/* Metric cards */}
      <div className="relative grid grid-cols-4 gap-3">
        {/* Unpaid amount */}
        <div className="col-span-1 bg-[#161b27]/80 border border-[#1a1b22] rounded-xl p-4 group hover:border-[#252830] transition-colors">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">À ENCAISSER</p>
          <AnimatedTND value={unpaidTotal} className="text-xl font-mono font-black text-white leading-none" />
          <p className="text-[10px] text-gray-600 mt-1.5">TND en attente</p>
        </div>

        {/* Unpaid count */}
        <div className="col-span-1 bg-[#161b27]/80 border border-[#1a1b22] rounded-xl p-4 group hover:border-[#252830] transition-colors">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">NON PAYÉES</p>
          <span className="text-xl font-mono font-black text-[#f59e0b] leading-none">{unpaidCount}</span>
          <p className="text-[10px] text-gray-600 mt-1.5">facture{unpaidCount !== 1 ? 's' : ''}</p>
        </div>

        {/* 30-day treasury */}
        <div className="col-span-1 bg-gradient-to-br from-[#2dd4a0]/8 to-transparent border border-[#2dd4a0]/15 rounded-xl p-4 group hover:border-[#2dd4a0]/25 transition-colors">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">TRÉSO. 30J</p>
          <AnimatedTND value={treasury30} className="text-xl font-mono font-black text-[#2dd4a0] leading-none" />
          <p className="text-[10px] text-gray-600 mt-1.5">TND estimé</p>
        </div>

        {/* Streak */}
        <div className={`col-span-1 border rounded-xl p-4 transition-colors ${
          streakDays >= 7
            ? 'bg-gradient-to-br from-orange-950/30 to-transparent border-orange-800/30 hover:border-orange-700/40'
            : streakDays >= 1
            ? 'bg-[#161b27]/80 border-orange-900/20 hover:border-orange-800/30'
            : 'bg-[#161b27]/80 border-[#1a1b22] hover:border-[#252830]'
        }`}>
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">SÉRIE TTN</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-mono font-black leading-none ${
              streakDays >= 7 ? 'text-orange-400' : streakDays >= 1 ? 'text-orange-500' : 'text-gray-600'
            }`}>{streakDays}</span>
            {streakDays >= 1 && <span className="text-sm">🔥</span>}
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">jour{streakDays !== 1 ? 's' : ''} sans retard</p>
        </div>
      </div>
    </div>
  )
}
