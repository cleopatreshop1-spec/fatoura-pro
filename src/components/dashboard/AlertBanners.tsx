import Link from 'next/link'

interface Props {
  rejectedCount: number
  hasMandate: boolean
  mandateExpiringDays: number | null
  queuedCount: number
}

function Alert({ color, icon, text, action }: {
  color: 'red' | 'yellow' | 'blue'
  icon: string
  text: string
  action?: { label: string; href: string }
}) {
  const colors = {
    red:    'bg-red-950/40 border-red-900/50 text-red-300',
    yellow: 'bg-yellow-950/40 border-yellow-900/50 text-yellow-300',
    blue:   'bg-blue-950/40 border-blue-900/50 text-blue-300',
  }
  const btnColors = {
    red:    'bg-red-800/60 hover:bg-red-700/80 text-red-100',
    yellow: 'bg-yellow-800/60 hover:bg-yellow-700/80 text-yellow-100',
    blue:   'bg-blue-800/60 hover:bg-blue-700/80 text-blue-100',
  }
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border text-sm ${colors[color]}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base shrink-0">{icon}</span>
        <span className="leading-snug">{text}</span>
      </div>
      {action && (
        <Link href={action.href} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${btnColors[color]}`}>
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function AlertBanners({ rejectedCount, hasMandate, mandateExpiringDays, queuedCount }: Props) {
  const alerts = []

  if (rejectedCount > 0) {
    alerts.push(
      <Alert key="rejected" color="red" icon=""
        text={`${rejectedCount} facture${rejectedCount > 1 ? 's' : ''} rejetée${rejectedCount > 1 ? 's' : ''} par TTN nécessitent votre attention`}
        action={{ label: 'Voir les factures rejetées', href: '/dashboard/invoices?status=rejected' }}
      />
    )
  }

  if (!hasMandate) {
    alerts.push(
      <Alert key="no-mandate" color="yellow" icon=""
        text="Aucune signature configurée — vos factures ne peuvent pas être soumises à TTN"
        action={{ label: 'Configurer maintenant', href: '/dashboard/settings?tab=signature' }}
      />
    )
  }

  if (mandateExpiringDays !== null && mandateExpiringDays <= 30) {
    alerts.push(
      <Alert key="expiring" color="yellow" icon=""
        text={`Votre mandat de signature expire dans ${mandateExpiringDays} jour${mandateExpiringDays > 1 ? 's' : ''}`}
        action={{ label: 'Renouveler', href: '/dashboard/settings?tab=signature' }}
      />
    )
  }

  if (queuedCount > 0) {
    alerts.push(
      <Alert key="queued" color="blue" icon=""
        text={`${queuedCount} facture${queuedCount > 1 ? 's' : ''} en file d\'attente TTN (soumission automatique)`}
      />
    )
  }

  if (alerts.length === 0) return null
  return <div className="space-y-2">{alerts}</div>
}
