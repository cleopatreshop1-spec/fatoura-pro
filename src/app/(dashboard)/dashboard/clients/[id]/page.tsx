import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { fmtTND } from '@/lib/utils/tva-calculator'
import { ClientDetailActions } from '@/components/clients/ClientDetailActions'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: invoices }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('invoices')
      .select('id, number, status, issue_date, ttc_amount, ht_amount')
      .eq('client_id', id)
      .order('issue_date', { ascending: false }),
  ])

  if (!client) notFound()

  const c = client as any
  const invs = (invoices ?? []) as any[]

  const validInvs = invs.filter((i: any) => i.status !== 'draft')
  const totalTTC = validInvs.reduce((s: number, i: any) => s + Number(i.ttc_amount ?? 0), 0)
  const totalHT  = validInvs.reduce((s: number, i: any) => s + Number(i.ht_amount  ?? 0), 0)
  const lastInv  = invs[0]

  const typeColor = c.type === 'B2B'
    ? 'bg-[#d4a843]/10 text-[#d4a843] border-[#d4a843]/20'
    : 'bg-[#4a9eff]/10 text-[#4a9eff] border-[#4a9eff]/20'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/clients" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          Clients
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-lg font-bold text-white truncate">{c.name}</h1>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>{c.type ?? 'B2B'}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

        {/* Left: client card + stats */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <div className="px-5 py-5 border-b border-[#1a1b22]">
              <div className="w-12 h-12 rounded-xl bg-[#161b27] border border-[#252830] flex items-center justify-center mb-4">
                <span className="text-xl font-black text-gray-400">{c.name?.slice(0,2).toUpperCase()}</span>
              </div>
              <h2 className="text-base font-bold text-white">{c.name}</h2>
              {c.matricule_fiscal && <p className="text-xs font-mono text-gray-500 mt-0.5">{c.matricule_fiscal}</p>}
            </div>

            <div className="px-5 py-4 space-y-3">
              {[
                { label: 'Type', value: c.type ?? 'B2B' },
                { label: 'Adresse', value: [c.address, c.gouvernorat, c.postal_code].filter(Boolean).join(', ') || null },
                { label: 'Telephone', value: c.phone },
                { label: 'Email', value: c.email },
                { label: 'Banque', value: c.bank_name },
                { label: 'RIB', value: c.bank_rib, mono: true },
              ].map(({ label, value, mono }) => value ? (
                <div key={label}>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</div>
                  <div className={`text-sm text-gray-300 ${mono ? 'font-mono text-xs' : ''}`}>{value as string}</div>
                </div>
              ) : null)}
            </div>

            <div className="px-5 pb-5 flex flex-col gap-2">
              <ClientDetailActions clientId={c.id} client={c} companyId={c.company_id} />
              <Link href={`/dashboard/invoices?client_id=${c.id}`}
                className="w-full text-center px-4 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300 hover:bg-white/5 transition-colors">
                Voir toutes ses factures
              </Link>
            </div>
          </div>

          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
            <div className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-4">Statistiques</div>
            <div className="space-y-3">
              {[
                { label: 'Total facture (TTC)', value: fmtTND(totalTTC) + ' TND' },
                { label: 'CA HT valide', value: fmtTND(totalHT) + ' TND' },
                { label: 'Nombre de factures', value: String(validInvs.length) },
                { label: 'Derniere facture', value: lastInv?.issue_date ? new Date(lastInv.issue_date).toLocaleDateString('fr-FR') : 'Aucune' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-sm font-mono text-gray-200">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: invoice history */}
        <div className="xl:col-span-3">
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <h2 className="text-sm font-bold text-gray-200">
                Historique <span className="text-gray-600 font-normal">({invs.length})</span>
              </h2>
              <Link href={`/dashboard/invoices/new?client_id=${c.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-lg transition-colors">
                + Creer une facture
              </Link>
            </div>

            {invs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-600">Aucune facture pour ce client.</p>
                <Link href={`/dashboard/invoices/new?client_id=${c.id}`} className="text-xs text-[#d4a843] hover:underline mt-2 inline-block">
                  Creer la premiere facture
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a1b22]">
                      {['N Facture','Date','Montant TTC','Statut'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b22]">
                    {invs.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-[#161b27] transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-[#d4a843] hover:text-[#f0c060]">
                            {inv.number ?? 'Brouillon'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : ''}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                          {fmtTND(Number(inv.ttc_amount ?? 0))} TND
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={inv.status ?? 'draft'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
