'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

type Props = {
  id: string
  number: string | null
  status: string
  clientName: string | null
  clientType: string | null
  issueDate: string | null
  dueDate: string | null
  htAmount: number
  tvaAmount: number
  ttcAmount: number
  paymentStatus: string | null
}

export function InvoiceQuickPreview({ id, number, status, clientName, clientType, issueDate, dueDate, htAmount, tvaAmount, ttcAmount, paymentStatus }: Props) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(true), 350)
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }

  const isOverdue = paymentStatus !== 'paid' && dueDate && dueDate < new Date().toISOString().slice(0, 10)

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <Link
        href={`/dashboard/invoices/${id}`}
        className="font-mono text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors"
      >
        {number ?? <span className="text-gray-600 italic">Brouillon</span>}
      </Link>

      {visible && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-[#161b27] border border-[#252830] rounded-2xl shadow-2xl p-4 pointer-events-none">
          {/* Arrow */}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[#161b27] border-l border-t border-[#252830] rotate-45" />

          {/* Client + status */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{clientName ?? 'Particulier'}</p>
              {clientType && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${clientType === 'B2B' ? 'text-[#d4a843] border-[#d4a843]/20' : 'text-[#4a9eff] border-[#4a9eff]/20'}`}>
                  {clientType}
                </span>
              )}
            </div>
            <InvoiceStatusBadge status={status} size="sm" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">Émise</p>
              <p className="text-xs text-gray-300">{fmtDate(issueDate)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">Échéance</p>
              <p className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-gray-300'}`}>
                {fmtDate(dueDate)}
                {isOverdue && <span className="ml-1 text-[9px]">⚠</span>}
              </p>
            </div>
          </div>

          {/* Amounts */}
          <div className="bg-[#0f1118] rounded-xl px-3 py-2.5 space-y-1 mb-3">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>HT</span><span className="font-mono">{fmtTND(htAmount)} TND</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>TVA</span><span className="font-mono">{fmtTND(tvaAmount)} TND</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-white border-t border-[#1a1b22] pt-1 mt-1">
              <span>TTC</span>
              <span className="font-mono text-[#d4a843]">{fmtTND(ttcAmount)} TND</span>
            </div>
          </div>

          {/* Payment status */}
          <div className={`text-[10px] font-bold text-center py-1 rounded-lg border ${
            paymentStatus === 'paid'    ? 'text-[#2dd4a0] border-[#2dd4a0]/20 bg-[#2dd4a0]/5'
            : paymentStatus === 'partial' ? 'text-yellow-400 border-yellow-900/30 bg-yellow-950/20'
            : isOverdue                   ? 'text-red-400 border-red-900/30 bg-red-950/10'
            : 'text-gray-500 border-[#252830]'
          }`}>
            {paymentStatus === 'paid' ? '✓ Payée' : paymentStatus === 'partial' ? '⬤ Partielle' : isOverdue ? '⚠ En retard' : '○ Non payée'}
          </div>
        </div>
      )}
    </div>
  )
}
