'use client'

import Link from 'next/link'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'

type Props = {
  firstName: string
  unpaidTotal: number
  unpaidCount: number
  treasury30: number
  isNewUser: boolean
  hasAlert: boolean
  alertMessage?: string
  alertInvoiceId?: string
}

const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function getGreetingIcon() {
  const h = new Date().getHours()
  if (h < 6)  return '🌙'
  if (h < 12) return '☀️'
  if (h < 18) return '🌤️'
  return '🌙'
}

function formatDate() {
  const d = new Date()
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

export function HeroWidget({
  firstName, unpaidTotal, unpaidCount, treasury30,
  isNewUser, hasAlert, alertMessage, alertInvoiceId,
}: Props) {
  if (isNewUser) {
    return (
      <div className="bg-gradient-to-br from-[#0f1118] to-[#13151f] border border-[#1a1b22] rounded-2xl p-8">
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
          <h1 className="text-lg font-bold text-white">
            Bonjour, {firstName} {getGreetingIcon()}
          </h1>
          <span className="text-xs text-gray-600">{formatDate()}</span>
        </div>
        <OnboardingChecklist />
      </div>
    )
  }

  const alertBg = hasAlert
    ? 'bg-gradient-to-br from-[#1a0f0f] to-[#130f0f] border-red-900/40'
    : 'bg-gradient-to-br from-[#0f1118] to-[#13151f] border-[#1a1b22]'

  return (
    <div className={`border rounded-2xl p-8 ${alertBg}`}>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-lg font-bold text-white">
          Bonjour, {firstName} {getGreetingIcon()}
        </h1>
        <span className="text-xs text-gray-600">{formatDate()}</span>
      </div>

      {hasAlert && alertMessage && (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 mb-6">
          <span className="text-lg shrink-0">⚠️</span>
          <p className="text-sm text-red-300 flex-1">{alertMessage}</p>
          {alertInvoiceId && (
            <Link href={`/dashboard/invoices/${alertInvoiceId}`}
              className="shrink-0 px-3 py-1.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
              Soumettre →
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl p-5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">À ENCAISSER CE MOIS</p>
          <p className="text-2xl font-mono font-black text-white leading-none">
            {fmtTND(unpaidTotal)}
          </p>
          <p className="text-xs text-gray-500 mt-1">TND en attente</p>
        </div>
        <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl p-5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">FACTURES NON PAYÉES</p>
          <p className="text-2xl font-mono font-black text-[#f59e0b] leading-none">
            {unpaidCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">facture{unpaidCount !== 1 ? 's' : ''} en attente</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between bg-[#161b27]/60 border border-[#1a1b22] rounded-xl px-5 py-3">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Trésorerie estimée à 30 jours</p>
          <p className="text-lg font-mono font-bold text-[#2dd4a0] mt-0.5">
            {fmtTND(treasury30)} TND
          </p>
        </div>
        <Link href="/dashboard/invoices"
          className="text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors font-medium">
          Voir les factures →
        </Link>
      </div>
    </div>
  )
}
