'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, Clock, AlertCircle, ExternalLink, Share2, Copy, Check } from 'lucide-react'

const fmtTND = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  valid:     { label: 'Validée TTN', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle size={14} /> },
  validated: { label: 'Validée',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle size={14} /> },
  draft:     { label: 'Brouillon',   color: 'text-gray-400',    bg: 'bg-gray-500/10 border-gray-500/30',       icon: <Clock size={14} /> },
  pending:   { label: 'En attente',  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',   icon: <Clock size={14} /> },
  rejected:  { label: 'Rejetée',     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         icon: <AlertCircle size={14} /> },
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const [inv, setInv]         = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [confirmed, setConfirmed]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/invoices/share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setInv(d.invoice)
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [token])

  function shareWhatsApp() {
    const url  = window.location.href
    const text = `Facture ${inv?.number ?? ''} — ${fmtTND(Number(inv?.ttc_amount ?? 0))} TND — ${inv?.companies?.name ?? ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank')
  }

  function shareEmail() {
    const url     = window.location.href
    const subject = `Facture ${inv?.number ?? ''} — ${inv?.companies?.name ?? ''}`
    const body    = `Bonjour,\n\nVeuillez trouver ci-dessous le lien vers votre facture :\n${url}\n\nMontant TTC : ${fmtTND(Number(inv?.ttc_amount ?? 0))} TND\n\nCordialement,\n${inv?.companies?.name ?? ''}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function confirmReceipt() {
    setConfirming(true)
    await fetch(`/api/invoices/share/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_receipt' }),
    })
    setConfirmed(true)
    setConfirming(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#d4a843] border-t-transparent animate-spin" />
        <p className="text-gray-500 text-sm">Chargement de la facture...</p>
      </div>
    </div>
  )

  if (error || !inv) return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-5xl">🔒</div>
        <p className="text-white font-bold">Lien invalide ou expiré</p>
        <p className="text-gray-500 text-sm">{error ?? 'Cette facture n\'est pas disponible.'}</p>
        <a href="https://fatoura.pro" className="text-[#d4a843] text-sm hover:underline block mt-4">
          Créer vos factures avec Fatoura Pro →
        </a>
      </div>
    </div>
  )

  const company = inv.companies as any
  const client  = inv.clients  as any
  const lines   = ((inv.invoice_line_items ?? []) as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const st      = STATUS_MAP[inv.status] ?? STATUS_MAP.pending

  const tvaGroups: Record<number, { base: number; tva: number }> = {}
  for (const l of lines) {
    const r = Number(l.tva_rate ?? 19)
    if (!tvaGroups[r]) tvaGroups[r] = { base: 0, tva: 0 }
    tvaGroups[r].base += Number(l.line_ht ?? 0)
    tvaGroups[r].tva  += Number(l.line_tva ?? 0)
  }

  return (
    <div className="min-h-screen bg-[#080a0f]">

      {/* Top bar */}
      <div className="border-b border-[#1a1b22] bg-[#0f1118]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://fatoura.pro" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center">
              <span className="text-[#d4a843] text-[10px] font-black">F</span>
            </div>
            <span className="text-[#d4a843] font-mono text-sm font-bold">FATOURA</span>
            <span className="text-gray-600 font-mono text-sm font-bold">PRO</span>
            <ExternalLink size={11} className="text-gray-700 group-hover:text-gray-500 transition-colors ml-0.5" />
          </a>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${st.bg} ${st.color}`}>
            {st.icon}
            {st.label}
          </div>
        </div>
      </div>

      {/* Invoice card */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden text-gray-900">

          {/* Header */}
          <div className="px-8 py-7 flex justify-between items-start border-b border-gray-100">
            <div>
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company?.name ?? ''} className="h-12 w-auto object-contain mb-3" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <span className="text-lg font-black text-gray-400">{company?.name?.[0] ?? 'F'}</span>
                </div>
              )}
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {company?.name ?? ''}
              </h1>
              {company?.matricule_fiscal && (
                <p className="text-xs text-gray-500 font-mono mt-0.5">{company.matricule_fiscal}</p>
              )}
              {company?.address && (
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{company.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gray-900 tracking-tight">
                {inv.number ?? 'Brouillon'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Date : {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}
              </p>
              {inv.due_date && (
                <p className="text-xs text-gray-500">
                  Échéance : {new Date(inv.due_date).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="px-8 py-5 grid grid-cols-2 gap-8 bg-gray-50 border-b border-gray-100">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Émetteur</p>
              <p className="text-sm font-bold text-gray-800">{company?.name ?? ''}</p>
              {company?.address   && <p className="text-xs text-gray-500 mt-0.5">{company.address}</p>}
              {company?.phone     && <p className="text-xs text-gray-500">{company.phone}</p>}
              {company?.email     && <p className="text-xs text-gray-500">{company.email}</p>}
              {company?.bank_name && <p className="text-xs text-gray-400 mt-1 font-mono">{company.bank_name}</p>}
              {company?.bank_rib  && <p className="text-xs text-gray-400 font-mono">{company.bank_rib}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Destinataire</p>
              {client ? (
                <>
                  <p className="text-sm font-bold text-gray-800">{client.name}</p>
                  {client.matricule_fiscal && <p className="text-xs text-gray-500 font-mono mt-0.5">{client.matricule_fiscal}</p>}
                  {client.address && <p className="text-xs text-gray-500 mt-0.5">{client.address}</p>}
                  {client.phone   && <p className="text-xs text-gray-500">{client.phone}</p>}
                  {client.email   && <p className="text-xs text-gray-500">{client.email}</p>}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Client particulier</p>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="px-8 py-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Description', 'Qté', 'Prix unit.', 'TVA', 'Total HT'].map(h => (
                    <th key={h} className="pb-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => (
                  <tr key={l.id ?? i} className="border-b border-gray-50">
                    <td className="py-3 text-gray-800 font-medium pr-4">{l.description}</td>
                    <td className="py-3 text-gray-600 whitespace-nowrap">{l.quantity}</td>
                    <td className="py-3 text-gray-600 whitespace-nowrap font-mono">{fmtTND(Number(l.unit_price ?? 0))}</td>
                    <td className="py-3 text-gray-500 whitespace-nowrap">{l.tva_rate}%</td>
                    <td className="py-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">{fmtTND(Number(l.line_ht ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-5 border-t border-gray-100 flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total HT</span>
                <span className="font-mono">{fmtTND(Number(inv.ht_amount ?? 0))} TND</span>
              </div>
              {Object.entries(tvaGroups).map(([rate, g]) => (
                <div key={rate} className="flex justify-between text-sm text-gray-600">
                  <span>TVA {rate}%</span>
                  <span className="font-mono">{fmtTND(g.tva)} TND</span>
                </div>
              ))}
              {Number(inv.stamp_amount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Timbre fiscal</span>
                  <span className="font-mono">{fmtTND(Number(inv.stamp_amount))} TND</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                <span>TOTAL TTC</span>
                <span className="font-mono">{fmtTND(Number(inv.ttc_amount ?? 0))} TND</span>
              </div>
              {inv.total_in_words && (
                <p className="text-[10px] text-gray-400 italic pt-1">{inv.total_in_words}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="px-8 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-gray-600">{inv.notes}</p>
            </div>
          )}

          {/* Footer branding */}
          <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">
              Facture générée via{' '}
              <a href="https://fatoura.pro" target="_blank" rel="noopener noreferrer"
                className="text-[#d4a843] font-semibold hover:underline">
                Fatoura Pro
              </a>
              {' '}— La facturation électronique tunisienne
            </p>
            <span className="text-[10px] text-gray-300 font-mono">{inv.number}</span>
          </div>
        </div>

        {/* Confirm receipt CTA */}
        {!confirmed && inv.status !== 'draft' && (
          <div className="mt-6 bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Vous avez reçu cette facture ?</p>
              <p className="text-xs text-gray-500 mt-0.5">Confirmez la réception pour notifier l&apos;émetteur</p>
            </div>
            <button
              onClick={confirmReceipt}
              disabled={confirming}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#2dd4a0] hover:bg-[#25b98a] text-black text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              <CheckCircle size={15} />
              {confirming ? 'Envoi...' : 'Confirmer réception'}
            </button>
          </div>
        )}

        {confirmed && (
          <div className="mt-6 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Réception confirmée !</p>
              <p className="text-xs text-emerald-600 mt-0.5">L&apos;émetteur a été notifié de votre confirmation.</p>
            </div>
          </div>
        )}

        {/* Share actions */}
        {inv && (
          <div className="mt-6 bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Share2 size={15} className="text-[#d4a843]" />
              <p className="text-sm font-semibold text-white">Partager cette facture</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={shareWhatsApp}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold rounded-xl transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
              <button
                onClick={shareEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#4a9eff]/10 hover:bg-[#4a9eff]/20 border border-[#4a9eff]/25 text-[#4a9eff] text-sm font-semibold rounded-xl transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Email
              </button>
              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1b22] hover:bg-[#252830] border border-[#252830] text-gray-300 text-sm font-semibold rounded-xl transition-colors"
              >
                {linkCopied ? <Check size={14} className="text-[#2dd4a0]" /> : <Copy size={14} />}
                {linkCopied ? 'Copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        )}

        {/* Viral Footer CTA */}
        <div className="mt-8 border border-[#d4a843]/20 bg-gradient-to-br from-[#0f1118] to-[#161b27] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 border-b border-[#1a1b22]">
            <div className="w-8 h-8 rounded-lg bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center shrink-0">
              <span className="text-[#d4a843] text-[11px] font-black">F</span>
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">Fatoura Pro</p>
              <p className="text-gray-500 text-[10px]">Facturation électronique · Conforme TTN · DGI 2024</p>
            </div>
            <div className="ml-auto shrink-0">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#2dd4a0]/10 border border-[#2dd4a0]/30 text-[#2dd4a0]">
                ✓ Certifié
              </span>
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Cette facture a été générée et certifiée via <span className="text-[#d4a843] font-semibold">Fatoura Pro</span> — la plateforme de facturation électronique N°1 en Tunisie. Signature XAdES · Soumission TTN automatique.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://fatoura.pro/register"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors"
              >
                Essayer gratuitement — 30 jours offerts →
              </a>
              <a
                href="https://fatoura.pro/verifier"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[#1a1b22] hover:border-[#d4a843]/30 text-gray-400 text-xs font-semibold rounded-xl transition-colors"
              >
                Vérifier ma conformité TTN
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
