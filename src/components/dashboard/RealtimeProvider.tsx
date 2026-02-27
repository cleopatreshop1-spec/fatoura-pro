'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeProvider({ companyId }: { companyId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-invoices-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `company_id=eq.${companyId}`,
        },
        () => { router.refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [companyId, router])

  return null
}
