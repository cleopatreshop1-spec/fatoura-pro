import { cn } from '@/lib/utils/cn'

export type InvoiceStatus = 'draft' | 'pending' | 'valid' | 'rejected' | 'queued'

const CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:    { label: 'Brouillon',      className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  pending:  { label: 'En attente TTN', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  valid:    { label: 'Validée',        className: 'bg-green-500/10 text-[#2dd4a0] border-green-500/20' },
  rejected: { label: 'Rejetée',       className: 'bg-red-500/10 text-[#e05a5a] border-red-500/20' },
  queued:   { label: 'File d\'attente', className: 'bg-blue-500/10 text-[#4a9eff] border-blue-500/20' },
}

interface Props {
  status: InvoiceStatus | string
  size?: 'sm' | 'md'
}

export function InvoiceStatusBadge({ status, size = 'sm' }: Props) {
  const cfg = CONFIG[status as InvoiceStatus] ?? CONFIG.draft
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono border rounded-full',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}
