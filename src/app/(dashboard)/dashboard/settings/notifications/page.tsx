'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotificationsRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/settings?tab=notifications') }, [router])
  return null
}
