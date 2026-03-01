'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
    
    checkAuth()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[#d4a843] font-mono text-2xl font-bold mb-4">
          FATOURA<span className="text-gray-600">PRO</span>
        </div>
        <div className="text-gray-400">Redirection...</div>
      </div>
    </div>
  )
}
