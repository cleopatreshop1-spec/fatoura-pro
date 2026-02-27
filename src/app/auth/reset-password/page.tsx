'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function exchangeCode() {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setMessage(error.message)
          } else {
            setReady(true)
          }
        } else {
          const { data } = await supabase.auth.getSession()
          if (data.session) setReady(true)
          else setMessage('Aucun code trouvé. Veuillez demander un nouveau lien.')
        }
      } catch (e: any) {
        setMessage(e?.message ?? 'Une erreur inattendue est survenue.')
      } finally {
        setChecking(false)
      }
    }
    exchangeCode()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Mot de passe mis à jour. Redirection...')
      setTimeout(() => router.push('/dashboard'), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[#d4a843] font-mono text-2xl font-bold">
            FATOURA<span className="text-gray-600">PRO</span>
          </div>
          <div className="text-gray-500 text-sm mt-2">Nouveau mot de passe</div>
        </div>

        {checking ? (
          <div className="text-sm text-gray-400 text-center py-4">Vérification du lien...</div>
        ) : !ready ? (
          <div className="space-y-4">
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">
              {message || 'Lien invalide ou expiré.'}
            </div>
            <a
              href="/login"
              className="block w-full text-center bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3 rounded-lg transition-colors"
            >
              Demander un nouveau lien
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-[#111318] border border-[#252830] rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-[#111318] border border-[#252830] rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
              />
            </div>

            {message && (
              <div className="text-sm text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-4 py-3">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
