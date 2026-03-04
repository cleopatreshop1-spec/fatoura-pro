'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X, Calendar, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  invoiceId: string
  invoiceNumber: string
  clientId?: string | null
}

const FREQUENCIES = [
  { value: 'monthly',    label: 'Mensuel',      desc: 'Chaque mois' },
  { value: 'quarterly',  label: 'Trimestriel',  desc: 'Tous les 3 mois' },
  { value: 'biannual',   label: 'Semestriel',   desc: 'Tous les 6 mois' },
  { value: 'annual',     label: 'Annuel',       desc: 'Chaque année' },
] as const

type Frequency = typeof FREQUENCIES[number]['value']

function addMonths(dateStr: string | null, months: number): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

const FREQ_MONTHS: Record<Frequency, number> = {
  monthly: 1, quarterly: 3, biannual: 6, annual: 12,
}

export function RecurringInvoiceSetup({ invoiceId, invoiceNumber, clientId }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [open, setOpen]           = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [occurrences, setOccurrences] = useState(3)
  const [nextDate, setNextDate]   = useState(addMonths(null, 1))
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [created, setCreated]     = useState<string[]>([])

  async function handleCreate() {
    setLoading(true)
    const months = FREQ_MONTHS[frequency]
    const ids: string[] = []

    const { data: src } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', invoiceId)
      .single()

    if (!src) { setLoading(false); return }

    const s = src as any

    for (let i = 0; i < occurrences; i++) {
      const issueDate = addMonths(nextDate, i * months)
      const dueDate   = addMonths(issueDate, 1)

      const { data: newInv } = await (supabase as any)
        .from('invoices')
        .insert({
          company_id:   s.company_id,
          client_id:    s.client_id,
          status:       'draft',
          payment_status: 'unpaid',
          issue_date:   issueDate,
          due_date:     dueDate,
          notes:        s.notes,
          ht_amount:    s.ht_amount,
          tva_amount:   s.tva_amount,
          ttc_amount:   s.ttc_amount,
        })
        .select('id')
        .single()

      if (!newInv?.id) continue
      ids.push(newInv.id)

      const lines = (s.invoice_line_items ?? []).map((l: any, idx: number) => ({
        invoice_id:  newInv.id,
        sort_order:  l.sort_order ?? idx,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tva_rate:    l.tva_rate,
        line_ht:     l.line_ht,
        line_tva:    l.line_tva,
        line_ttc:    l.line_ttc,
      }))

      if (lines.length > 0) {
        await supabase.from('invoice_line_items').insert(lines)
      }
    }

    setCreated(ids)
    setDone(true)
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30 transition-colors"
      >
        <RefreshCw size={13} />
        Récurrent
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!loading) setOpen(false) }} />
          <div className="relative z-10 w-full max-w-md bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="text-[#2dd4a0]" />
                <span className="text-sm font-bold text-white">Facturation récurrente</span>
              </div>
              <button onClick={() => setOpen(false)} disabled={loading}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#161b27] transition-colors disabled:opacity-40">
                <X size={15} />
              </button>
            </div>

            {!done ? (
              <div className="p-5 space-y-5">
                <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2 text-xs text-gray-400">
                  Basé sur la facture <span className="font-mono text-[#d4a843]">{invoiceNumber}</span> — les mêmes lignes et montants seront dupliqués
                </div>

                {/* Frequency */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Fréquence</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FREQUENCIES.map(f => (
                      <button key={f.value} onClick={() => setFrequency(f.value)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          frequency === f.value
                            ? 'bg-[#2dd4a0]/10 border-[#2dd4a0]/30 text-[#2dd4a0]'
                            : 'bg-[#161b27] border-[#1a1b22] text-gray-400 hover:text-white'
                        }`}>
                        <div className="text-xs font-bold">{f.label}</div>
                        <div className="text-[10px] opacity-70">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* First date */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                    <Calendar size={10} className="inline mr-1" />
                    Première occurrence
                  </p>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={e => setNextDate(e.target.value)}
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2dd4a0] transition-colors"
                  />
                </div>

                {/* Count */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Nombre de factures à créer</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setOccurrences(o => Math.max(1, o - 1))}
                      className="w-8 h-8 rounded-lg bg-[#161b27] border border-[#1a1b22] text-gray-300 hover:text-white hover:bg-[#252830] transition-colors text-sm font-bold">
                      −
                    </button>
                    <span className="text-xl font-mono font-bold text-white w-8 text-center">{occurrences}</span>
                    <button onClick={() => setOccurrences(o => Math.min(24, o + 1))}
                      className="w-8 h-8 rounded-lg bg-[#161b27] border border-[#1a1b22] text-gray-300 hover:text-white hover:bg-[#252830] transition-colors text-sm font-bold">
                      +
                    </button>
                    <span className="text-xs text-gray-500">
                      → jusqu&apos;au {addMonths(nextDate, (occurrences - 1) * FREQ_MONTHS[frequency])}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2dd4a0] hover:bg-[#3de8b4] text-black text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />Création en cours...</>
                    : <><RefreshCw size={14} />Créer {occurrences} facture{occurrences > 1 ? 's' : ''} brouillon</>}
                </button>
              </div>
            ) : (
              <div className="p-5 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#2dd4a0]/15 border border-[#2dd4a0]/30 flex items-center justify-center">
                  <Check size={24} className="text-[#2dd4a0]" />
                </div>
                <div>
                  <p className="text-base font-bold text-white mb-1">{created.length} facture{created.length > 1 ? 's' : ''} créée{created.length > 1 ? 's' : ''} !</p>
                  <p className="text-xs text-gray-500">Elles sont en statut brouillon — vérifiez et soumettez à TTN avant leur date d&apos;émission.</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={() => { setOpen(false); router.push('/dashboard/invoices') }}
                    className="flex-1 py-2.5 rounded-xl bg-[#2dd4a0] hover:bg-[#3de8b4] text-black text-sm font-bold transition-colors">
                    Voir les factures
                  </button>
                  <button onClick={() => { setDone(false); setCreated([]) }}
                    className="px-4 py-2.5 rounded-xl border border-[#1a1b22] text-xs text-gray-400 hover:text-white transition-colors">
                    Reconfigurer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
