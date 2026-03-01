'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MandateRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/settings?tab=signature') }, [router])
  return null
}


