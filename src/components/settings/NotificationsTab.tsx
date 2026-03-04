'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

const TOGGLES = [
  { key: 'invoice_validated', label: 'Facture validee par TTN',       channels: 'Email + In-app', urgent: false },
  { key: 'invoice_rejected',  label: 'Facture rejetee par TTN',       channels: 'Email + In-app', urgent: true },
  { key: 'mandate_expiring',  label: 'Mandat expirant (-60 jours)',    channels: 'Email', urgent: false },
  { key: 'cert_expiring',     label: 'Certificat expirant (-60 jours)',channels: 'Email', urgent: false },
  { key: 'monthly_tva',       label: 'Resume TVA mensuel',             channels: 'Email (1er du mois)', urgent: false },
  { key: 'weekly_report',     label: 'Rapport hebdomadaire',           channels: 'Email (lundi matin)', urgent: false },
  { key: 'overdue_reminder', label: 'Rappel factures en retard',      channels: 'Email (J+1, J+3, J+7, J+14, J+30)', urgent: false },
]

type Prefs = Record<string, boolean>

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!enabled)}
      className={`w-10 h-5.5 rounded-full relative transition-colors shrink-0 ${enabled ? 'bg-[#d4a843]' : 'bg-[#252830]'}`}
      style={{ height: '22px' }}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function NotificationsTab() {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [prefs, setPrefs] = useState<Prefs>({ invoice_validated: true, invoice_rejected: true, mandate_expiring: true, cert_expiring: true, monthly_tva: true, weekly_report: false })
  const [notifEmail, setNotifEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      if (!activeCompany?.id) return
      const { data } = await supabase.from('companies').select('notification_preferences, email').eq('id', activeCompany.id).single()
      if ((data as any)?.notification_preferences) setPrefs((data as any).notification_preferences)
      if ((data as any)?.email) setNotifEmail((data as any).email)
    }
    load()
  }, [activeCompany?.id, supabase])

  async function handleSave() {
    if (!activeCompany?.id) return
    setSaving(true)
    await supabase.from('companies').update({ notification_preferences: prefs }).eq('id', activeCompany.id)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  function toggle(key: string, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-white mb-1">Preferences de notification</h2>
        <p className="text-xs text-gray-500">Choisissez quand et comment vous souhaitez etre notifie.</p>
      </div>

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden divide-y divide-[#1a1b22]">
        {TOGGLES.map(t => (
          <div key={t.key} className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0 mr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200">{t.label}</span>
                {t.urgent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-900/30">URGENT</span>}
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">{t.channels}</div>
            </div>
            <Toggle enabled={!!prefs[t.key]} onChange={v => toggle(t.key, v)} />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Email de notification</label>
        <input value={notifEmail} onChange={e => setNotifEmail(e.target.value)} type="email"
          placeholder="votre@email.com"
          className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors max-w-sm" />
      </div>

      {saved && <div className="text-sm text-[#2dd4a0] bg-[#2dd4a0]/10 border border-[#2dd4a0]/20 rounded-xl px-4 py-3">Preferences enregistrees.</div>}
      <button onClick={handleSave} disabled={saving}
        className="px-6 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
        {saving ? 'Enregistrement...' : 'Enregistrer les preferences'}
      </button>
    </div>
  )
}
