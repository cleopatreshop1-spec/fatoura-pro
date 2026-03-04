import { CheckCircle2, Clock, FileText, Shield, XCircle, CreditCard } from 'lucide-react'

type Step = {
  key: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  done: boolean
  active: boolean
  failed?: boolean
}

interface Props {
  status: string
  payment_status: string | null
  created_at: string | null
  issue_date: string | null
  ttn_id: string | null
  paid_at?: string | null
}

function fmt(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function InvoiceTimeline({ status, payment_status, created_at, issue_date, ttn_id, paid_at }: Props) {
  const isPaid    = payment_status === 'paid'
  const isFailed  = status === 'rejected'
  const isValid   = status === 'valid'
  const isPending = ['queued', 'pending'].includes(status)
  const isValidated = ['validated', 'valid', 'queued', 'pending', 'rejected'].includes(status)
  const isDraft   = status === 'draft'

  const steps: Step[] = [
    {
      key: 'created',
      label: 'Créée',
      sublabel: fmt(created_at),
      icon: <FileText size={14} />,
      done: true,
      active: isDraft,
    },
    {
      key: 'validated',
      label: 'Finalisée',
      sublabel: fmt(issue_date),
      icon: <FileText size={14} />,
      done: isValidated,
      active: status === 'validated',
    },
    {
      key: 'ttn',
      label: isFailed ? 'Rejetée TTN' : isValid ? 'Validée TTN' : isPending ? 'En attente TTN' : 'TTN',
      sublabel: ttn_id ? ttn_id.slice(0, 12) + '…' : undefined,
      icon: isFailed ? <XCircle size={14} /> : <Shield size={14} />,
      done: isValid,
      active: isPending,
      failed: isFailed,
    },
    {
      key: 'paid',
      label: isPaid ? 'Payée' : 'Paiement',
      sublabel: isPaid ? fmt(paid_at ?? null) : undefined,
      icon: <CreditCard size={14} />,
      done: isPaid,
      active: isValid && !isPaid,
    },
  ]

  return (
    <div className="flex items-start gap-0 w-full">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const color = step.failed
          ? 'text-red-400 border-red-800/60 bg-red-950/30'
          : step.done
          ? 'text-[#2dd4a0] border-[#2dd4a0]/40 bg-[#2dd4a0]/10'
          : step.active
          ? 'text-[#d4a843] border-[#d4a843]/40 bg-[#d4a843]/10'
          : 'text-gray-600 border-[#252830] bg-[#161b27]'

        const lineColor = step.done && !isLast
          ? 'bg-[#2dd4a0]/30'
          : 'bg-[#1a1b22]'

        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${color}`}>
                {step.done && !step.failed
                  ? <CheckCircle2 size={14} />
                  : step.active && !step.failed
                  ? <Clock size={14} className="animate-pulse" />
                  : step.icon}
              </div>
              <p className={`text-[9px] font-semibold mt-1 text-center leading-tight max-w-[60px] ${
                step.failed ? 'text-red-400' : step.done ? 'text-[#2dd4a0]' : step.active ? 'text-[#d4a843]' : 'text-gray-600'
              }`}>{step.label}</p>
              {step.sublabel && (
                <p className="text-[8px] text-gray-600 mt-0.5 text-center max-w-[60px] truncate">{step.sublabel}</p>
              )}
            </div>
            {!isLast && (
              <div className={`h-[2px] flex-1 mt-4 mx-1 rounded-full ${lineColor}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
