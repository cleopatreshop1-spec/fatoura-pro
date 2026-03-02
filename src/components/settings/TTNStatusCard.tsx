'use client'

// src/components/settings/TTNStatusCard.tsx
// TTN/ElFatoora registration status card for Settings > Signature tab
// Per: Guide Adhésion TTN 2025

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import {
  CheckCircle, Clock, AlertCircle, Globe, Server,
  FileText, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'

type TTNStatus = 'not_registered' | 'dossier_submitted' | 'in_test' | 'production'
type ConnectionMode = 'webservice' | 'sftp'

interface CompanyTTN {
  ttn_subscription_status: TTNStatus | null
  ttn_connection_mode: ConnectionMode | null
  ttn_ip_address: string | null
  ttn_registered_signers: { email: string; cert_serial: string; name: string }[] | null
  has_own_certificate: boolean | null
  ttn_sftp_host: string | null
}

const STATUS_CONFIG: Record<TTNStatus, {
  label: string
  color: string
  border: string
  bg: string
  dot: string
  Icon: any
}> = {
  not_registered: {
    label: 'Non inscrit',
    color: 'text-gray-400',
    border: 'border-[#252830]',
    bg: 'bg-[#0f1118]',
    dot: 'bg-gray-600',
    Icon: AlertCircle,
  },
  dossier_submitted: {
    label: 'Dossier soumis',
    color: 'text-yellow-400',
    border: 'border-yellow-800/40',
    bg: 'bg-yellow-950/20',
    dot: 'bg-yellow-400',
    Icon: Clock,
  },
  in_test: {
    label: 'Phase de test',
    color: 'text-[#4a9eff]',
    border: 'border-[#4a9eff]/30',
    bg: 'bg-[#4a9eff]/5',
    dot: 'bg-[#4a9eff]',
    Icon: Server,
  },
  production: {
    label: 'En production',
    color: 'text-[#2dd4a0]',
    border: 'border-[#2dd4a0]/30',
    bg: 'bg-[#2dd4a0]/5',
    dot: 'bg-[#2dd4a0]',
    Icon: CheckCircle,
  },
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold ${ok ? 'text-[#2dd4a0]' : 'text-red-400'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <span className={`text-xs ${ok ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
    </div>
  )
}

export function TTNStatusCard() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])

  const [data, setData] = useState<CompanyTTN | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [toast, setToast] = useState('')

  const [editStatus, setEditStatus] = useState<TTNStatus>('not_registered')
  const [editMode, setEditMode] = useState<ConnectionMode>('webservice')
  const [editIp, setEditIp] = useState('')
  const [editSftpHost, setEditSftpHost] = useState('')
  const [editSignerEmail, setEditSignerEmail] = useState('')
  const [editSignerSerial, setEditSignerSerial] = useState('')
  const [editSignerName, setEditSignerName] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function load() {
    if (!activeCompany?.id) return
    const { data: co } = await (supabase as any)
      .from('companies')
      .select('ttn_subscription_status, ttn_connection_mode, ttn_ip_address, ttn_registered_signers, has_own_certificate, ttn_sftp_host')
      .eq('id', activeCompany.id)
      .single()

    if (co) {
      setData(co as CompanyTTN)
      setEditStatus((co.ttn_subscription_status as TTNStatus) ?? 'not_registered')
      setEditMode((co.ttn_connection_mode as ConnectionMode) ?? 'webservice')
      setEditIp(co.ttn_ip_address ?? '')
      setEditSftpHost(co.ttn_sftp_host ?? '')
      const signer = (co.ttn_registered_signers as any)?.[0]
      if (signer) {
        setEditSignerEmail(signer.email ?? '')
        setEditSignerSerial(signer.cert_serial ?? '')
        setEditSignerName(signer.name ?? '')
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [activeCompany?.id])

  async function handleSave() {
    if (!activeCompany?.id) return
    setSaving(true)
    const signers = editSignerEmail
      ? [{ email: editSignerEmail, cert_serial: editSignerSerial, name: editSignerName }]
      : null

    await (supabase as any).from('companies').update({
      ttn_subscription_status: editStatus,
      ttn_connection_mode:     editMode,
      ttn_ip_address:          editIp || null,
      ttn_sftp_host:           editSftpHost || null,
      ttn_registered_signers:  signers,
    }).eq('id', activeCompany.id)

    await load()
    setSaving(false)
    showToast('Configuration TTN sauvegardée')
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-600">Chargement...</div>

  const status = (data?.ttn_subscription_status ?? 'not_registered') as TTNStatus
  const cfg    = STATUS_CONFIG[status]
  const signers = (data?.ttn_registered_signers as any[]) ?? []
  const hasIp  = !!data?.ttn_ip_address
  const hasSigner = signers.length > 0
  const hasCert = !!data?.has_own_certificate

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#0f1118] border border-[#2dd4a0]/40 text-[#2dd4a0] text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Status badge */}
      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
          <cfg.Icon size={16} className={cfg.color} />
          <span className={`font-bold text-sm ${cfg.color}`}>Statut TTN : {cfg.label}</span>
        </div>

        {status === 'not_registered' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Votre entreprise n'est pas encore inscrite à ElFatoora (TTN).</p>
            <a href="https://www.tradenet.com.tn" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#d4a843] hover:underline">
              Télécharger le dossier sur tradenet.com.tn <ExternalLink size={11} />
            </a>
          </div>
        )}

        {status === 'dossier_submitted' && (
          <div className="space-y-2 text-xs text-gray-400">
            <p>En attente de validation TTN (2–4 semaines).</p>
            <p>
              Contact : <span className="text-gray-300 font-medium">Mme DENDANI Manel</span>
              {' '}— <a href="mailto:commercial@elfatoora.tn" className="text-[#d4a843] hover:underline">commercial@elfatoora.tn</a>
              {' '}— +216 99 921 553
            </p>
          </div>
        )}

        {status === 'in_test' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">Phase de test active. Vérifiez que tous les éléments sont configurés :</p>
            <div className="space-y-1.5">
              <CheckItem ok={hasIp}     label={`Adresse IP publique fixe${hasIp ? ` : ${data?.ttn_ip_address}` : ' — non configurée'}`} />
              <CheckItem ok={hasSigner} label={`Signataire déclaré${hasSigner ? ` : ${signers[0]?.email}` : ' — non configuré'}`} />
              <CheckItem ok={hasCert}   label={`Certificat ANCE${hasCert ? ' importé' : ' — non importé'}`} />
              <CheckItem ok={!!data?.ttn_connection_mode} label={`Mode connexion : ${data?.ttn_connection_mode ?? 'non défini'}`} />
            </div>
          </div>
        )}

        {status === 'production' && (
          <p className="text-xs text-gray-400">
            Vos factures sont soumises à TTN en production.
            Mode : <span className="text-gray-300 font-mono">{data?.ttn_connection_mode ?? 'webservice'}</span>
          </p>
        )}
      </div>

      {/* Configuration form */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white">Configuration TTN</h3>

        {/* Subscription status */}
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Statut d'inscription</label>
          <select value={editStatus} onChange={e => setEditStatus(e.target.value as TTNStatus)}
            className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#d4a843]">
            <option value="not_registered">⚪ Non inscrit</option>
            <option value="dossier_submitted">🟡 Dossier soumis</option>
            <option value="in_test">🔵 En phase de test</option>
            <option value="production">🟢 En production</option>
          </select>
        </div>

        {/* Connection mode */}
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Mode de connexion</label>
          <div className="grid grid-cols-2 gap-2">
            {(['webservice', 'sftp'] as ConnectionMode[]).map(m => (
              <button key={m} onClick={() => setEditMode(m)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  editMode === m
                    ? 'border-[#d4a843] bg-[#d4a843]/10 text-[#d4a843] font-bold'
                    : 'border-[#252830] text-gray-400 hover:border-[#d4a843]/40'
                }`}>
                {m === 'webservice' ? <Globe size={14} /> : <Server size={14} />}
                {m === 'webservice' ? 'Webservice (HTTPS)' : 'SFTP'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">
            {editMode === 'webservice'
              ? 'Recommandé. Nécessite une IP publique fixe déclarée à TTN.'
              : 'Pour les grandes entreprises avec traitement par lots.'}
          </p>
        </div>

        {/* Public IP */}
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
            Adresse IP publique fixe
          </label>
          <input value={editIp} onChange={e => setEditIp(e.target.value)}
            placeholder="ex: 196.203.xx.xx"
            className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#d4a843] placeholder-gray-700" />
          <p className="text-[10px] text-gray-600 mt-1">IP à déclarer à TTN lors de l'inscription.</p>
        </div>

        {/* SFTP host (only for SFTP mode) */}
        {editMode === 'sftp' && (
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Hôte SFTP TTN</label>
            <input value={editSftpHost} onChange={e => setEditSftpHost(e.target.value)}
              placeholder="sftp.tradenet.com.tn"
              className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#d4a843] placeholder-gray-700" />
          </div>
        )}

        {/* Declared signer */}
        <div className="space-y-2">
          <label className="block text-xs text-gray-500 uppercase tracking-wider">Signataire déclaré à TTN</label>
          <input value={editSignerName} onChange={e => setEditSignerName(e.target.value)}
            placeholder="Nom complet du signataire"
            className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#d4a843] placeholder-gray-700" />
          <input value={editSignerEmail} onChange={e => setEditSignerEmail(e.target.value)}
            placeholder="email@entreprise.tn"
            className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#d4a843] placeholder-gray-700" />
          <input value={editSignerSerial} onChange={e => setEditSignerSerial(e.target.value)}
            placeholder="Numéro de série certificat ANCE (ex: ANCE-2025-XXXX)"
            className="w-full bg-[#161b27] border border-[#252830] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#d4a843] placeholder-gray-700" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
          {saving ? 'Sauvegarde...' : 'Sauvegarder la configuration TTN'}
        </button>
      </div>

      {/* Pre-production checklist */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
        <button onClick={() => setShowChecklist(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-gray-300 hover:text-white transition-colors">
          <span className="flex items-center gap-2">
            <FileText size={15} className="text-[#d4a843]" />
            Liste de contrôle avant soumission en production
          </span>
          {showChecklist ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showChecklist && (
          <div className="px-5 pb-5 space-y-5 border-t border-[#1a1b22] pt-4">

            <div className="space-y-3">
              <p className="text-xs font-bold text-[#d4a843] uppercase tracking-wider">Démarches à effectuer (hors code)</p>

              {[
                {
                  num: '1',
                  title: 'Certificat électronique qualifié ANCE',
                  detail: 'www.ance.tn | +216 71 846 250 | Délai: 2–4 semaines | Coût: ~200–400 TND/an',
                  done: hasCert,
                },
                {
                  num: '2',
                  title: 'Dossier d\'abonnement TTN soumis',
                  detail: 'Télécharger sur tradenet.com.tn — Soumettre avec: contrat, fiche renseignement, extrait RCS, CIN. Contact: Mme DENDANI Manel — commercial@elfatoora.tn — +216 99 921 553',
                  done: ['dossier_submitted', 'in_test', 'production'].includes(status),
                },
                {
                  num: '3',
                  title: 'Phase de test validée avec TTN',
                  detail: 'Fournir à TTN: IP publique fixe, email + serial certificat. Délai: 2–4 semaines.',
                  done: ['in_test', 'production'].includes(status),
                },
                {
                  num: '4',
                  title: 'Déclaration DGI déposée (après mise en production)',
                  detail: 'Avec attestation d\'adhésion TTN. À effectuer uniquement après mise en production.',
                  done: status === 'production',
                },
                {
                  num: '5',
                  title: 'Numéro de série certificat + email configurés dans Fatoura Pro',
                  detail: 'Renseignez le signataire déclaré dans le formulaire ci-dessus.',
                  done: hasSigner && hasCert,
                },
              ].map(item => (
                <div key={item.num} className={`flex gap-3 p-3 rounded-xl border ${
                  item.done ? 'border-[#2dd4a0]/20 bg-[#2dd4a0]/5' : 'border-[#252830]'
                }`}>
                  <span className={`text-lg shrink-0 mt-0.5 ${item.done ? 'text-[#2dd4a0]' : 'text-gray-600'}`}>
                    {item.done ? '✅' : '☐'}
                  </span>
                  <div>
                    <p className={`text-xs font-bold mb-0.5 ${item.done ? 'text-[#2dd4a0]' : 'text-gray-300'}`}>
                      {item.num}. {item.title}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Technical checklist */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#4a9eff] uppercase tracking-wider">Conformité technique (code)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['XAdES v1.3.2+', true],
                  ['Signature enveloppée', true],
                  ['SHA-256 minimum', true],
                  ['RSA-2048 minimum', true],
                  ['C14N exclusif', true],
                  ['OID 2.16.788.1.2.1.3', true],
                  ['Encodage UTF-8', true],
                  ['SigningTime présent', true],
                  ['SigningCertificate présent', true],
                  ['Format TEIF XML', true],
                  ['Montants 3 décimales', true],
                  ['Timbre 0.600 TND', true],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="flex items-center gap-1.5">
                    <span className={`text-xs ${ok ? 'text-[#2dd4a0]' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</span>
                    <span className="text-[10px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
