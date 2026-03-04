'use client'

import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

type Action = {
  id: string
  label: string
  href: string
  severity: 'high' | 'medium' | 'low'
}

interface Props {
  overdueCount: number
  overdueTotal: number
  draftCount: number
  missingProfile: string[]
  unpaidOld: number
  expiredTTN: number
}

const SEV_COLOR = {
  high:   'text-red-400 bg-red-950/30 border-red-900/30',
  medium: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
  low:    'text-[#4a9eff] bg-[#4a9eff]/10 border-[#4a9eff]/20',
}

const SEV_DOT = {
  high:   'bg-red-500',
  medium: 'bg-[#f59e0b]',
  low:    'bg-[#4a9eff]',
}

export function PendingActionsWidget({ overdueCount, overdueTotal, draftCount, missingProfile, unpaidOld, expiredTTN }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

  const actions: Action[] = []

  if (overdueCount > 0)
    actions.push({ id: 'overdue', severity: 'high',
      label: `${overdueCount} facture${overdueCount > 1 ? 's' : ''} en retard — ${fmt(overdueTotal)} TND impayé`,
      href: '/dashboard/invoices?payment=overdue' })

  if (expiredTTN > 0)
    actions.push({ id: 'ttn', severity: 'high',
      label: `${expiredTTN} facture${expiredTTN > 1 ? 's' : ''} avec rejet TTN à corriger`,
      href: '/dashboard/invoices' })

  if (draftCount > 0)
    actions.push({ id: 'drafts', severity: 'medium',
      label: `${draftCount} brouillon${draftCount > 1 ? 's' : ''} en attente de validation`,
      href: '/dashboard/invoices/new' })

  if (unpaidOld > 0)
    actions.push({ id: 'old', severity: 'medium',
      label: `${unpaidOld} facture${unpaidOld > 1 ? 's' : ''} impayée${unpaidOld > 1 ? 's' : ''} depuis plus de 60 jours`,
      href: '/dashboard/invoices' })

  if (missingProfile.length > 0)
    actions.push({ id: 'profile', severity: 'low',
      label: `Profil incomplet — champs manquants : ${missingProfile.join(', ')}`,
      href: '/dashboard/settings' })

  if (actions.length === 0) return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl px-5 py-4 flex items-center gap-3">
      <CheckCircle2 size={16} className="text-[#2dd4a0] shrink-0" />
      <span className="text-sm text-gray-400">Tout est à jour — aucune action requise</span>
    </div>
  )

  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#1a1b22]">
        <AlertCircle size={14} className="text-[#f59e0b]" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Actions requises</span>
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25">
          {actions.length}
        </span>
      </div>
      <ul className="divide-y divide-[#1a1b22]">
        {actions.map(a => (
          <li key={a.id}>
            <Link href={a.href}
              className="flex items-center gap-3 px-5 py-3 hover:bg-[#161b27] transition-colors group">
              <span className={`shrink-0 w-2 h-2 rounded-full ${SEV_DOT[a.severity]}`} />
              <span className={`text-xs px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide shrink-0 ${SEV_COLOR[a.severity]}`}>
                {a.severity === 'high' ? 'Urgent' : a.severity === 'medium' ? 'À faire' : 'Info'}
              </span>
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors flex-1 min-w-0 truncate">{a.label}</span>
              <ChevronRight size={12} className="text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
