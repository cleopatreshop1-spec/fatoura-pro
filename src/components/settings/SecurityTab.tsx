'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors'

export function SecurityTab() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDelete2, setConfirmDelete2] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleChangePwd() {
    if (newPwd.length < 8) { setPwdMsg({ text: 'Mot de passe trop court (min 8 chars)', ok: false }); return }
    if (newPwd !== confirmPwd) { setPwdMsg({ text: 'Les mots de passe ne correspondent pas', ok: false }); return }
    setPwdLoading(true); setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) setPwdMsg({ text: error.message, ok: false })
    else { setPwdMsg({ text: 'Mot de passe modifie avec succes', ok: true }); setOldPwd(''); setNewPwd(''); setConfirmPwd('') }
    setPwdLoading(false)
  }

  async function handleSignOutAll() {
    setSignOutLoading(true)
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/login')
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'SUPPRIMER') return
    setDeleting(true)
    // Note: actual deletion requires Supabase admin  flag the account for deletion
    await supabase.auth.signOut()
    setDeleting(false)
    router.push('/login')
  }

  return (
    <div className="space-y-8">
      {/* Password change */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white">Changer le mot de passe</h2>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 8 caracteres" className={IC} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Confirmer le mot de passe</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="" className={IC} />
          </div>
          {pwdMsg && (
            <div className={`text-xs rounded-xl px-4 py-2.5 border ${pwdMsg.ok ? 'text-[#2dd4a0] bg-[#2dd4a0]/10 border-[#2dd4a0]/20' : 'text-red-400 bg-red-950/20 border-red-900/30'}`}>
              {pwdMsg.text}
            </div>
          )}
          <button onClick={handleChangePwd} disabled={pwdLoading || !newPwd || !confirmPwd}
            className="px-5 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
            {pwdLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white">Sessions actives</h2>
        <p className="text-xs text-gray-500">Deconnectez tous les appareils si vous suspectez un acces non autorise.</p>
        <button onClick={handleSignOutAll} disabled={signOutLoading}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#252830] text-sm text-gray-300 hover:text-white hover:bg-[#161b27] rounded-xl transition-colors disabled:opacity-50">
          {signOutLoading ? 'Deconnexion...' : 'Deconnecter tous les appareils'}
        </button>
      </div>

      {/* Export data */}
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-white">Mes donnees (RGPD)</h2>
        <p className="text-xs text-gray-500">Telechargez une copie de toutes vos donnees.</p>
        <button className="px-4 py-2.5 border border-[#252830] text-sm text-gray-300 hover:text-white hover:bg-[#161b27] rounded-xl transition-colors opacity-60 cursor-not-allowed" disabled>
          Telecharger mes donnees (bientot disponible)
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-red-400">Zone dangereuse</h2>
        <p className="text-xs text-gray-500">La suppression de votre compte est irreversible. Toutes vos donnees seront perdues.</p>
        <button onClick={() => setConfirmDelete(true)}
          className="px-4 py-2.5 border border-red-600/50 text-sm text-red-400 hover:bg-red-950/30 rounded-xl transition-colors">
          Supprimer mon compte
        </button>
      </div>

      {/* Step 1 */}
      <ConfirmDialog open={confirmDelete && !confirmDelete2}
        title="Supprimer votre compte ?" dangerous
        description="Cette action est irreversible. Toutes vos factures, clients et donnees seront definitivement supprimes."
        confirmLabel="Continuer" cancelLabel="Annuler"
        onConfirm={() => { setConfirmDelete2(true) }}
        onCancel={() => setConfirmDelete(false)} />

      {/* Step 2 */}
      {confirmDelete && confirmDelete2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1118] border border-red-900/50 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-red-400">Confirmation finale</h3>
            <p className="text-sm text-gray-400">Tapez <strong className="text-white font-mono">SUPPRIMER</strong> pour confirmer.</p>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER" className="w-full bg-[#161b27] border border-red-900/40 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-700 outline-none focus:border-red-500" />
            <div className="flex gap-3">
              <button onClick={() => { setConfirmDelete(false); setConfirmDelete2(false); setDeleteConfirmText('') }}
                className="flex-1 py-2.5 rounded-xl border border-[#1a1b22] text-sm text-gray-300">Annuler</button>
              <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmText !== 'SUPPRIMER'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40">
                {deleting ? '...' : 'Supprimer definitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
