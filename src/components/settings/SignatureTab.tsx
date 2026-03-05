'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TTNStatusCard } from '@/components/settings/TTNStatusCard'

type MandateRow = { id: string; accepted_at: string; seal_identifier: string; seal_valid_until: string; ip_address: string | null }

export function SignatureTab() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [mandate, setMandate] = useState<MandateRow | null>(null)
  const [hasCert, setHasCert] = useState(false)
  const [certInfo, setCertInfo] = useState<{ subject?: string; validUntil?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [certPwd, setCertPwd] = useState('')
  const [certError, setCertError] = useState('')
  const [toast, setToast] = useState('')
  const certRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function load() {
    if (!activeCompany?.id) return
    const [{ data: mdt }, { data: co }] = await Promise.all([
      supabase.from('mandates').select('id, accepted_at, seal_identifier, seal_valid_until, ip_address')
        .eq('company_id', activeCompany.id).eq('is_active', true).limit(1).maybeSingle(),
      supabase.from('companies').select('own_cert_pem').eq('id', activeCompany.id).single(),
    ])
    setMandate(mdt as MandateRow | null)
    const cert = (co as any)?.own_cert_pem
    setHasCert(!!cert)
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompany?.id])

  async function handleAcceptMandate() {
    if (!activeCompany?.id) return
    setAccepting(true)
    try {
      const res = await fetch('/api/mandate/accept', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { showToast(d.error ?? 'Erreur activation mandat'); setAccepting(false); return }
      await load(); showToast('Mandat activé !')
    } catch { showToast('Erreur réseau') }
    setAccepting(false)
  }

  async function handleRevoke() {
    if (!mandate) return
    setRevoking(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('mandates').update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: user!.id }).eq('id', mandate.id)
    setMandate(null); setRevoking(false); setConfirmRevoke(false); showToast('Mandat révoqué.')
  }

  async function handleCertUpload() {
    if (!certFile || !keyFile || !activeCompany?.id) return
    setUploadingCert(true); setCertError('')
    try {
      const readText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(f) })
      const certPem = await readText(certFile); const keyPem = await readText(keyFile)
      await supabase.from('companies').update({ own_cert_pem: certPem, own_key_pem: keyPem }).eq('id', activeCompany.id)
      setHasCert(true); setCertFile(null); setKeyFile(null); setCertPwd(''); showToast('Certificat importé !')
    } catch { setCertError('Erreur lors de la lecture du fichier') }
    setUploadingCert(false)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')
  const daysLeft = mandate ? Math.ceil((new Date(mandate.seal_valid_until).getTime() - Date.now()) / 86400000) : 0

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[1,2].map(i => (
        <div key={i} className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-3">
          <div className="h-4 bg-[#1a1b22] rounded w-40" />
          <div className="h-3 bg-[#1a1b22] rounded w-64" />
          <div className="h-9 bg-[#1a1b22] rounded-xl w-48" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      {/* CAS A: Active mandate */}
      {mandate && (
        <div className="bg-[#2dd4a0]/5 border border-[#2dd4a0]/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[#2dd4a0] text-lg"></span>
            <span className="text-sm font-bold text-[#2dd4a0]">Mandat de signature actif</span>
            {daysLeft <= 60 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-700/30">Expire dans {daysLeft}j</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Cachet', 'Fatoura Pro SARL'],
              ['N° Certificat ANCE', mandate.seal_identifier],
              ['Valide jusqu\'au', fmtDate(mandate.seal_valid_until)],
              ['Accepté le', fmtDate(mandate.accepted_at)],
              ['Adresse IP', mandate.ip_address ?? ''],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</div>
                <div className="text-xs text-gray-300 font-mono">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Vos factures sont signées automatiquement par Fatoura Pro en votre nom.</p>
          <button onClick={() => setConfirmRevoke(true)} className="border border-red-500/40 text-red-400 hover:bg-red-950/20 px-4 py-2 rounded-xl text-sm transition-colors">Révoquer le mandat</button>
        </div>
      )}

      {/* CAS B: Own cert */}
      {!mandate && hasCert && (
        <div className="bg-[#4a9eff]/5 border border-[#4a9eff]/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg"></span>
            <span className="text-sm font-bold text-[#4a9eff]">Votre certificat ANCE actif</span>
          </div>
          <p className="text-xs text-gray-400">Certificat importé. Vos factures sont signées avec votre propre certificat.</p>
          <button onClick={() => { setHasCert(false) }} className="border border-[#252830] text-gray-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">Remplacer le certificat</button>
        </div>
      )}

      {/* CAS C: Nothing configured */}
      {!mandate && !hasCert && (
        <div className="space-y-4">
          <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-bold"></span>
              <span className="text-sm font-bold text-red-400">Signature non configurée</span>
            </div>
            <p className="text-xs text-gray-400">Sans signature, vos factures ne peuvent pas être soumises à TTN/ElFatoora.</p>
          </div>

          {/* Option A */}
          <div className="bg-[#0f1118] border-2 border-[#d4a843]/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span></span>
                  <span className="text-sm font-bold text-white">Déléguer à Fatoura Pro</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30 font-bold">RECOMMANDÉ — Économisez 300-400 TND/an</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Nous signons vos factures avec notre cachet entreprise ANCE. Aucun achat de token. Aucune configuration.</p>
            <ul className="space-y-1.5">
              {['Opérationnel immédiatement','Cachet renouvelé automatiquement','Inclus dans votre abonnement','Légalement conforme (art. 4 politique TTN)'].map(a => (
                <li key={a} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="text-[#2dd4a0] shrink-0"></span> {a}
                </li>
              ))}
            </ul>
            <div className="bg-[#161b27] rounded-xl p-4 border border-[#d4a843]/20">
              <p className="text-xs text-gray-400 mb-3">En acceptant ce mandat, vous autorisez Fatoura Pro à signer vos factures avec son sceau ANCE en votre nom. Révocable à tout moment.</p>
              <button onClick={handleAcceptMandate} disabled={accepting}
                className="w-full py-3 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                {accepting ? 'Activation...' : 'Accepter le mandat de signature'}
              </button>
            </div>
          </div>

          {/* Option B */}
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span></span>
              <span className="text-sm font-bold text-gray-300">Votre propre certificat ANCE</span>
            </div>
            <p className="text-xs text-gray-400">Nécessite un achat auprès de l’ANCE (~300-400 TND/an) et une configuration technique.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Certificat (.pem ou .crt)</label>
                <input type="file" accept=".pem,.crt,.p12" onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-[#252830] file:text-gray-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Clé privée (.pem ou .key)</label>
                <input type="file" accept=".pem,.key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-[#252830] file:text-gray-300" />
              </div>
              {certError && <p className="text-xs text-red-400">{certError}</p>}
              <p className="text-[10px] text-gray-600">Le certificat est chiffré et stocké de façon sécurisée.</p>
              <button onClick={handleCertUpload} disabled={uploadingCert || !certFile || !keyFile}
                className="w-full py-2.5 bg-[#4a9eff] hover:bg-[#6eb5ff] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-40">
                {uploadingCert ? 'Import...' : 'Importer le certificat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TTN/ElFatoora registration status */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-[#1a1b22]" />
          <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold px-2">Inscription TTN / ElFatoora</span>
          <div className="h-px flex-1 bg-[#1a1b22]" />
        </div>
        <TTNStatusCard />
      </div>

      <ConfirmDialog open={confirmRevoke}
        title="Révoquer le mandat de signature ?"
        description="Vous devrez configurer votre propre certificat ANCE pour continuer à soumettre des factures à TTN."
        confirmLabel="Oui, révoquer" dangerous loading={revoking}
        onConfirm={handleRevoke} onCancel={() => setConfirmRevoke(false)} />
    </div>
  )
}
