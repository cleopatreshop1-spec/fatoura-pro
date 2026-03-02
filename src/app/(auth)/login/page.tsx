// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { identifyUser } from '@/lib/monitoring/sentry'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type LoginData = z.infer<typeof loginSchema>

const forgotSchema = z.object({
  email: z.string().email('Email invalide'),
})
type ForgotData = z.infer<typeof forgotSchema>

const IC = 'w-full bg-[#161b27] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors text-sm'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const EC = 'text-xs text-red-400 mt-1.5'

function Logo() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-baseline">
        <span className="text-[#d4a843] font-mono text-2xl font-bold tracking-wide">FATOURA</span>
        <span className="text-gray-500 font-mono text-2xl font-bold">PRO</span>
      </div>
      <p className="text-gray-500 text-xs mt-1.5 tracking-wide">Facturation electronique conforme TTN</p>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [showPwd, setShowPwd] = useState(false)
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>('login')
  const [serverError, setServerError] = useState('')

  const {
    register: rl,
    handleSubmit: hl,
    formState: { errors: le, isSubmitting: ll },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  const {
    register: rf,
    handleSubmit: hf,
    formState: { errors: fe, isSubmitting: fl },
  } = useForm<ForgotData>({ resolver: zodResolver(forgotSchema) })

  async function onLogin(data: LoginData) {
    setServerError('')
    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error) {
      setServerError(error.message.includes('Invalid login') ? 'Email ou mot de passe incorrect.' : error.message)
    } else {
      if (authData.user) {
        const { data: company } = await supabase.from('companies').select('id').eq('owner_id', authData.user.id).single()
        if (company) identifyUser(authData.user.id, (company as any).id)
      }
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function onForgot(data: ForgotData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) setServerError(error.message)
    else setView('sent')
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-10 shadow-2xl">
        <Logo />

        {view === 'login' && (
          <>
            <h1 className="text-base font-bold text-white text-center mb-6">
              Connexion a votre espace
            </h1>

            <form onSubmit={hl(onLogin)} className="space-y-4">
              <div>
                <label className={LC}>Email</label>
                <input {...rl('email')} type="email" placeholder="votre@email.com" className={IC} autoComplete="email" />
                {le.email && <p className={EC}>{le.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={LC.replace('mb-1.5', '')}>Mot de passe</label>
                  <button type="button" onClick={() => setView('forgot')}
                    className="text-xs text-gray-500 hover:text-[#d4a843] transition-colors">
                    Mot de passe oublie ?
                  </button>
                </div>
                <div className="relative">
                  <input {...rl('password')} type={showPwd ? 'text' : 'password'}
                    placeholder="" className={`${IC} pr-11`} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors select-none">
                    {showPwd ? 'CACHER' : 'VOIR'}
                  </button>
                </div>
                {le.password && <p className={EC}>{le.password.message}</p>}
              </div>

              {serverError && (
                <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={ll}
                className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-sm mt-2">
                {ll ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-[#d4a843] hover:underline font-medium">
                Creer un espace gratuit
              </Link>
            </p>
          </>
        )}

        {view === 'forgot' && (
          <>
            <h1 className="text-base font-bold text-white text-center mb-2">
              Reinitialiser le mot de passe
            </h1>
            <p className="text-xs text-gray-500 text-center mb-6">
              Entrez votre email pour recevoir un lien de reinitialisation.
            </p>

            <form onSubmit={hf(onForgot)} className="space-y-4">
              <div>
                <label className={LC}>Email</label>
                <input {...rf('email')} type="email" placeholder="votre@email.com" className={IC} autoComplete="email" />
                {fe.email && <p className={EC}>{fe.email.message}</p>}
              </div>

              {serverError && (
                <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={fl}
                className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-sm">
                {fl ? 'Envoi...' : 'Envoyer le lien'}
              </button>
            </form>

            <button onClick={() => { setView('login'); setServerError('') }}
              className="w-full text-center text-gray-500 hover:text-gray-300 text-sm mt-4 transition-colors">
              Retour a la connexion
            </button>
          </>
        )}

        {view === 'sent' && (
          <div className="text-center space-y-4">
            <div className="text-4xl"></div>
            <div className="text-base font-bold text-white">Email envoye !</div>
            <p className="text-sm text-gray-400">
              Verifiez votre boite mail et cliquez sur le lien pour reinitialiser votre mot de passe.
            </p>
            <button onClick={() => { setView('login'); setServerError('') }}
              className="text-[#d4a843] hover:underline text-sm">
              Retour a la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
