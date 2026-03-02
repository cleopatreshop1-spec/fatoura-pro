'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({ email: z.string().email('Email invalide') })
type FormData = z.infer<typeof schema>

const IC = 'w-full bg-[#161b27] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors text-sm'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/reset-password`,
    })
    if (error) setServerError(error.message)
    else setSent(true)
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline">
            <span className="text-[#d4a843] font-mono text-2xl font-bold tracking-wide">FATOURA</span>
            <span className="text-gray-500 font-mono text-2xl font-bold">PRO</span>
          </div>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-green-950/30 border border-green-900/40 flex items-center justify-center text-2xl">✉️</div>
            <h2 className="text-base font-bold text-white">Email envoyé !</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Vérifiez votre boîte de réception. Un lien de réinitialisation vous a été envoyé.
            </p>
            <Link href="/login" className="block text-sm text-[#d4a843] hover:underline mt-4">
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-base font-bold text-white text-center mb-6">
              Réinitialiser votre mot de passe
            </h1>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  className={IC}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1.5">{errors.email.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-400 text-center">{serverError}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 text-black font-bold rounded-xl transition-colors text-sm"
              >
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
