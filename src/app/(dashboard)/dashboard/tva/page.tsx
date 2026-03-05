'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { fmtTND, STAMP_DUTY } from '@/lib/utils/tva-calculator'

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

type Quarter = { label: string; period: string; from: string; to: string; year: number; q: number }
type InvWithLines = {
  id: string; number: string | null; issue_date: string | null
  ht_amount: number; tva_amount: number; ttc_amount: number; ttn_id: string | null
  clients: { name: string; matricule_fiscal: string | null } | null
  invoice_line_items: { tva_rate: number; line_ht: number; line_tva: number }[]
}

function buildQuarters(n = 5): Quarter[] {
  const now = new Date()
  let qIdx = Math.floor(now.getMonth() / 3)
  let year = now.getFullYear()
  const result: Quarter[] = []
  for (let i = 0; i < n; i++) {
    if (qIdx < 0) { qIdx = 3; year-- }
    const sm = qIdx * 3; const em = qIdx * 3 + 2
    const from = `${year}-${String(sm+1).padStart(2,'0')}-01`
    const ld = new Date(year, em+1, 0).getDate()
    const to = `${year}-${String(em+1).padStart(2,'0')}-${ld}`
    result.push({ label: `T${qIdx+1} ${year}`, period: MONTHS_FR.slice(sm, em+1).join('-'), from, to, year, q: qIdx+1 })
    qIdx--
  }
  return result
}

function Tooltip2({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) => fmtTND(v)
  return (
    <div className="bg-[#161b27] border border-[#252830] rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[140px]">
      <div className="text-gray-400 font-medium mb-2">{label}</div>
      <div className="flex justify-between gap-4"><span className="flex items-center gap-1.5 text-gray-400"><span className="w-2 h-2 bg-[#d4a843] rounded-sm"/>CA HT</span><span className="font-mono text-[#d4a843] font-bold">{fmt(payload[0]?.value??0)}</span></div>
      <div className="flex justify-between gap-4"><span className="flex items-center gap-1.5 text-gray-400"><span className="w-2 h-2 bg-[#2dd4a0] rounded-sm"/>TVA</span><span className="font-mono text-[#2dd4a0] font-bold">{fmt(payload[1]?.value??0)}</span></div>
    </div>
  )
}

export default function TVAPage() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const QUARTERS = useMemo(() => buildQuarters(5), [])

  const [selIdx, setSelIdx] = useState(0)
  const [custom, setCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [invoices, setInvoices] = useState<InvWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvoices, setShowInvoices] = useState(false)
  const [rateFilter, setRateFilter] = useState<number | 'all'>('all')
  const [toast, setToast] = useState('')

  const selectedQ = QUARTERS[selIdx]
  const from = custom ? customFrom : selectedQ.from
  const to   = custom ? customTo   : selectedQ.to

  const load = useCallback(async () => {
    if (!activeCompany?.id || !from || !to) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, number, issue_date, ht_amount, tva_amount, ttc_amount, ttn_id, clients(name, matricule_fiscal), invoice_line_items(tva_rate, line_ht, line_tva)')
      .eq('company_id', activeCompany.id)
      .eq('status', 'valid')
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date')
    setInvoices((data ?? []) as unknown as InvWithLines[])
    setLoading(false)
  }, [activeCompany?.id, supabase, from, to])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  //  Aggregations 
  const tvaBreakdown = useMemo(() => {
    const map: Record<number, { base: number; tva: number; invIds: Set<string> }> = {}
    for (const inv of invoices) {
      for (const l of inv.invoice_line_items ?? []) {
        const r = Number(l.tva_rate ?? 19)
        if (!map[r]) map[r] = { base: 0, tva: 0, invIds: new Set() }
        map[r].base += Number(l.line_ht ?? 0)
        map[r].tva  += Number(l.line_tva ?? 0)
        map[r].invIds.add(inv.id)
      }
    }
    return map
  }, [invoices])

  const totalHT  = useMemo(() => invoices.reduce((s,i) => s + Number(i.ht_amount??0), 0), [invoices])
  const totalTVA = useMemo(() => invoices.reduce((s,i) => s + Number(i.tva_amount??0), 0), [invoices])
  const totalTTC = useMemo(() => invoices.reduce((s,i) => s + Number(i.ttc_amount??0), 0), [invoices])
  const stampTotal = invoices.length * STAMP_DUTY

  const tvaRows = useMemo(() =>
    [19, 13, 7, 0].map(rate => ({
      rate,
      base: tvaBreakdown[rate]?.base ?? 0,
      tva:  tvaBreakdown[rate]?.tva  ?? 0,
      count: tvaBreakdown[rate]?.invIds.size ?? 0,
      pct: totalHT > 0 ? ((tvaBreakdown[rate]?.base ?? 0) / totalHT * 100) : 0,
    })),
    [tvaBreakdown, totalHT]
  )

  // Monthly chart data (3 months of selected quarter)
  const chartData = useMemo(() => {
    if (custom) return []
    const { q, year } = selectedQ
    return [0, 1, 2].map(offset => {
      const mIdx = (q-1)*3 + offset
      const mFrom = `${year}-${String(mIdx+1).padStart(2,'0')}-01`
      const mTo   = new Date(year, mIdx+1, 0).toISOString().slice(0,10)
      const mInvs = invoices.filter(i => (i.issue_date??'') >= mFrom && (i.issue_date??'') <= mTo)
      return {
        month: MONTHS_FR[mIdx],
        ht:  mInvs.reduce((s,i) => s + Number(i.ht_amount??0), 0),
        tva: mInvs.reduce((s,i) => s + Number(i.tva_amount??0), 0),
      }
    })
  }, [invoices, selectedQ, custom])

  // Filtered invoices for the list
  const filteredInvoices = useMemo(() => {
    if (rateFilter === 'all') return invoices
    return invoices.filter(i => i.invoice_line_items?.some(l => Number(l.tva_rate) === rateFilter))
  }, [invoices, rateFilter])

  //  Exports 
  async function handleCopy() {
    const periodLabel = custom ? `${customFrom}  ${customTo}` : selectedQ.label
    const lines = [
      `TVA a declarer ${periodLabel}:`,
      ...tvaRows.filter(r=>r.base>0).map(r => `  Base ${r.rate}%: ${fmtTND(r.base)} TND -> TVA: ${fmtTND(r.tva)} TND`),
      `  TOTAL TVA: ${fmtTND(totalTVA)} TND`,
      `  CA HT total: ${fmtTND(totalHT)} TND`,
    ].join('\n')
    await navigator.clipboard.writeText(lines)
    showToast('Totaux copiés !')
  }

  function handleCSV() {
    const headers = ['N Facture','Client','Matricule','Date','Base HT','Taux TVA','Montant TVA','Total TTC','TTN_ID']
    const rows: string[][] = []
    for (const inv of invoices) {
      for (const l of inv.invoice_line_items ?? []) {
        rows.push([
          inv.number??'', (inv.clients as any)?.name??'', (inv.clients as any)?.matricule_fiscal??'',
          inv.issue_date??'', String(Number(l.line_ht??0).toFixed(3)),
          String(l.tva_rate)+'%', String(Number(l.line_tva??0).toFixed(3)),
          '', inv.ttn_id??'',
        ])
      }
    }
    const csv = [headers, ...rows].map(r => r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a = document.createElement('a')
    const label = custom ? 'custom' : selectedQ.label.replace(' ','-')
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `factures_tva_${label}.csv`; a.click()
  }

  async function handlePDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const periodLabel = custom ? `${customFrom} a ${customTo}` : selectedQ.label
    const darkBlue = [15,17,24] as [number,number,number]
    const gold = [212,168,67] as [number,number,number]

    doc.setFillColor(...darkBlue); doc.rect(0,0,210,40,'F')
    doc.setTextColor(212,168,67); doc.setFontSize(18); doc.setFont('helvetica','bold')
    doc.text('RECAPITULATIF TVA', 14, 18)
    doc.setFontSize(10); doc.setTextColor(200,200,200)
    doc.text(`Societe: ${activeCompany?.name ?? ''}`, 14, 27)
    doc.text(`Periode: ${periodLabel}`, 14, 34)
    doc.setTextColor(0,0,0)

    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(...darkBlue)
    doc.text('Ventilation TVA — Pour déclaration DGI', 14, 52)

    autoTable(doc, {
      startY: 58,
      head: [['Taux TVA','Base HT (TND)','TVA (TND)','Nb Factures','% CA']],
      body: [
        ...tvaRows.filter(r=>r.base>0).map(r => [
          `${r.rate}%`, fmtTND(r.base), r.rate===0?'':fmtTND(r.tva), String(r.count), r.pct.toFixed(1)+'%'
        ]),
        ['TOTAL', fmtTND(totalHT), fmtTND(totalTVA), String(invoices.length), '100%'],
      ],
      headStyles: { fillColor: darkBlue, textColor: gold },
      footStyles: { fillColor: [240,240,240] },
      styles: { font: 'helvetica', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(8); doc.setTextColor(120,120,120); doc.setFont('helvetica','italic')
    doc.text('Ces données sont basées sur les factures validées par la plateforme TTN/ElFatoora.', 14, finalY)
    doc.text('Consultez votre expert-comptable pour votre déclaration officielle.', 14, finalY + 5)

    doc.save(`TVA_${periodLabel.replace(/ /g,'_')}.pdf`)
  }

  const IC = 'bg-[#0f1118] border border-[#1a1b22] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#d4a843] transition-colors'

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">TVA &amp; Déclarations</h1>
        <p className="text-gray-500 text-sm">Préparation de votre déclaration DGI</p>
      </div>

      {/* SECTION 1: Period tabs */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {QUARTERS.map((q, i) => (
            <button key={q.label} onClick={() => { setSelIdx(i); setCustom(false) }}
              className={`flex flex-col items-center px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                !custom && selIdx === i
                  ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843]'
                  : 'border-[#1a1b22] text-gray-500 hover:border-[#252830] hover:text-gray-300'
              }`}>
              <span>{q.label}</span>
              <span className="text-[9px] font-normal opacity-70">{q.period}</span>
            </button>
          ))}
          <button onClick={() => setCustom(true)}
            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              custom ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843]' : 'border-[#1a1b22] text-gray-500 hover:border-[#252830]'
            }`}>
            Personnalise
          </button>
        </div>
        {custom && (
          <div className="flex items-center gap-3 mt-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={IC} />
            <span className="text-gray-500 text-sm">a</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={IC} />
          </div>
        )}
        <p className="text-[10px] text-gray-600 mt-3">
          Données basées sur les factures validées TTN uniquement
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 animate-pulse">
                <div className="h-3 bg-[#1a1b22] rounded w-24 mb-3" />
                <div className="h-6 bg-[#1a1b22] rounded w-20 mb-1" />
                <div className="h-3 bg-[#1a1b22] rounded w-12" />
              </div>
            ))}
          </div>
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-[#1a1b22] rounded w-48 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 mb-3">
                <div className="h-3 bg-[#1a1b22] rounded w-12" />
                <div className="h-3 bg-[#1a1b22] rounded flex-1" />
                <div className="h-3 bg-[#1a1b22] rounded w-24" />
                <div className="h-3 bg-[#1a1b22] rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* SECTION 2: KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'CA HT Total', value: fmtTND(totalHT), suffix: 'TND', accent: '#d4a843' },
              { label: 'TVA Collectée', value: fmtTND(totalTVA), suffix: 'TND', accent: '#2dd4a0' },
              { label: 'Factures Validées', value: String(invoices.length), suffix: 'factures', accent: '#4a9eff' },
              { label: 'Droit de timbre total', value: fmtTND(stampTotal), suffix: 'TND', accent: '#a78bfa' },
            ].map(({ label, value, suffix, accent }) => (
              <div key={label} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-medium">{label}</div>
                <div className="font-mono text-xl font-black text-white">{value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{suffix}</div>
              </div>
            ))}
          </div>

          {/* SECTION 3: TVA Breakdown Table */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1a1b22]">
              <h2 className="text-sm font-bold text-white">Ventilation TVA — À reporter sur votre déclaration</h2>
              <p className="text-[10px] text-gray-600 mt-0.5">
                Tableau de synthèse {custom ? `du ${customFrom} au ${customTo}` : selectedQ.label}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1b22]">
                    {['Taux TVA','Base HT','Montant TVA','Nb Factures','% du CA',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-600 uppercase tracking-wider font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1b22]">
                  {tvaRows.map(r => (
                    <tr key={r.rate} className={r.base > 0 ? 'hover:bg-[#161b27] transition-colors' : 'opacity-30'}>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-200 text-sm">{r.rate}%</span>
                        <div className="text-[10px] text-gray-600">{r.rate===19?'Taux normal':r.rate===13?'Services':r.rate===7?'Reduit special':'Exonere'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">{fmtTND(r.base)} TND</td>
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: r.rate===0?'#6b7280':'#2dd4a0' }}>
                        {r.rate === 0 ? '' : fmtTND(r.tva) + ' TND'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-center">{r.count}</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#1a1b22] rounded-full overflow-hidden">
                            <div className="h-full bg-[#d4a843] rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-10 text-right">{r.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-[#161b27] border-t-2 border-[#d4a843]/30">
                    <td className="px-4 py-3 text-xs font-black text-white uppercase tracking-wider">TOTAL</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{fmtTND(totalHT)} TND</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#2dd4a0]">{fmtTND(totalTVA)} TND</td>
                    <td className="px-4 py-3 text-white font-bold text-center">{invoices.length}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">100%</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: Monthly Bar Chart */}
          {!custom && chartData.some(d => d.ht > 0) && (
            <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-200">Evolution mensuelle  {selectedQ.label}</h2>
                <div className="flex gap-4 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#d4a843] inline-block" />CA HT</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2dd4a0] inline-block" />TVA</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4} barCategoryGap="35%">
                  <CartesianGrid stroke="#1a1b22" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:String(v)} />
                  <Tooltip content={<Tooltip2 />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="ht" name="CA HT" fill="#d4a843" radius={[4,4,0,0]} maxBarSize={40} />
                  <Bar dataKey="tva" name="TVA" fill="#2dd4a0" radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SECTION 5: Invoice List (collapsible) */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#161b27] transition-colors"
              onClick={() => setShowInvoices(o => !o)}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-200">
                  {showInvoices ? 'Masquer' : 'Voir'} les {filteredInvoices.length} factures
                </span>
                {invoices.length > 0 && (
                  <select value={rateFilter === 'all' ? 'all' : String(rateFilter)}
                    onChange={e => { e.stopPropagation(); setRateFilter(e.target.value==='all'?'all':Number(e.target.value)) }}
                    onClick={e => e.stopPropagation()}
                    className="bg-[#161b27] border border-[#252830] rounded-lg px-2 py-1 text-xs text-gray-400 outline-none">
                    <option value="all">Tous les taux</option>
                    {[19,13,7,0].map(r => <option key={r} value={r}>TVA {r}%</option>)}
                  </select>
                )}
              </div>
              <span className="text-gray-500 text-sm">{showInvoices ? '' : ''}</span>
            </button>

            {showInvoices && (
              <div className="border-t border-[#1a1b22] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a1b22]">
                      {['N Facture','Client','Date','HT','TVA','TTC'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b22]">
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-[#161b27] transition-colors">
                        <td className="px-4 py-2.5">
                          <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-[#d4a843] hover:text-[#f0c060]">
                            {inv.number ?? ''}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[140px] truncate">
                          {(inv.clients as any)?.name ?? 'Particulier'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : ''}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-300">{fmtTND(Number(inv.ht_amount??0))}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#2dd4a0]">{fmtTND(Number(inv.tva_amount??0))}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-200 font-bold">{fmtTND(Number(inv.ttc_amount??0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 6: Export Actions */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-gray-200 mb-4">Export &amp; Déclaration</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#252830] bg-[#161b27] rounded-xl text-sm text-gray-300 hover:text-white hover:bg-[#252830] transition-colors">
                Copier totaux
              </button>
              <button onClick={handleCSV} disabled={invoices.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#252830] bg-[#161b27] rounded-xl text-sm text-gray-300 hover:text-white hover:bg-[#252830] transition-colors disabled:opacity-40">
                Exporter CSV
              </button>
              <button onClick={handlePDF} disabled={invoices.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black rounded-xl text-sm font-bold transition-colors disabled:opacity-40">
                Télécharger PDF
              </button>
            </div>
          </div>

          {/* Legal note */}
          <div className="text-[11px] text-gray-600 leading-relaxed border-t border-[#1a1b22] pt-4">
            Ces données sont basées sur les factures validées par la plateforme TTN/ElFatoora.
            Consultez votre expert-comptable pour votre déclaration officielle à la DGI.
          </div>
        </>
      )}
    </div>
  )
}
