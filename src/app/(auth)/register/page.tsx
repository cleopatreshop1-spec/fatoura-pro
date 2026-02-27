'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  first_name: z.string().min(2, 'Prenom requis'),
  last_name:  z.string().min(2, 'Nom requis'),
  email:      z.string().email('Email invalide'),
  password:   z.string().min(8, '8 caracteres minimum'),
  confirm:    z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

const IC = 'w-full bg-[#161b27] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors text-sm'
const LC = 'block text-xs text-gray-400 uppercase tracking-wider mb-1.5'
const EC = 'text-xs text-red-400 mt-1'

const STEPS = ['Compte', 'Entreprise', 'Signature']

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                done   ? 'border-[#2dd4a0] bg-[#2dd4a0]/15 text-[#2dd4a0]' :
                active ? 'border-[#d4a843] bg-[#d4a843] text-black' :
                         'border-[#252830] text-gray-600'
              }`}>
                {done ? '' : n}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-[#d4a843]' : done ? 'text-[#2dd4a0]' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className={`h-px w-10 mb-4 mx-1 ${done ? 'bg-[#2dd4a0]' : 'bg-[#252830]'}`} />}
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { first_name: data.first_name, last_name: data.last_name },
      },
    })
    if (error) setServerError(error.message)
    else router.push('/register/company')
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="text-center mb-6">
        <div className="inline-flex items-baseline">
          <span className="text-[#d4a843] font-mono text-xl font-bold tracking-wide">FATOURA</span>
          <span className="text-gray-500 font-mono text-xl font-bold">PRO</span>
        </div>
        <p className="text-gray-500 text-xs mt-1">Creer votre espace de facturation</p>
      </div>

      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-8">
        <Stepper step={1} />

        <h1 className="text-sm font-bold text-white text-center mb-6">
          Informations de compte
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Prenom *</label>
              <input {...register('first_name')} placeholder="Mohamed" className={IC} />
              {errors.first_name && <p className={EC}>{errors.first_name.message}</p>}
            </div>
            <div>
              <label className={LC}>Nom *</label>
              <input {...register('last_name')} placeholder="Ben Ali" className={IC} />
              {errors.last_name && <p className={EC}>{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className={LC}>Email *</label>
            <input {...register('email')} type="email" placeholder="votre@email.com" className={IC} autoComplete="email" />
            {errors.email && <p className={EC}>{errors.email.message}</p>}
          </div>

          <div>
            <label className={LC}>Mot de passe *</label>
            <div className="relative">
              <input {...register('password')} type={showPwd ? 'text' : 'password'}
                placeholder="Min. 8 caracteres" className={`${IC} pr-11`} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300">
                {showPwd ? 'CACHER' : 'VOIR'}
              </button>
            </div>
            {errors.password && <p className={EC}>{errors.password.message}</p>}
          </div>

          <div>
            <label className={LC}>Confirmer le mot de passe *</label>
            <div className="relative">
              <input {...register('confirm')} type={showConfirm ? 'text' : 'password'}
                placeholder="" className={`${IC} pr-11`} autoComplete="new-password" />
              <button type="button" onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300">
                {showConfirm ? 'CACHER' : 'VOIR'}
              </button>
            </div>
            {errors.confirm && <p className={EC}>{errors.confirm.message}</p>}
          </div>

          {serverError && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-[#d4a843] hover:bg-[#f0c060] text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-sm mt-1">
            {isSubmitting ? 'Creation...' : 'Creer mon compte '}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-5">
          Deja un compte ?{' '}
          <Link href="/login" className="text-[#d4a843] hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
