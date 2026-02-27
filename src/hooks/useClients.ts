'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types/database'

export function useClients(companyId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)

    const { data, error: e } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (e) setError(e.message)
    else setClients((data ?? []) as Client[])
    setLoading(false)
  }, [companyId, supabase])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { clients, loading, error, refresh: fetch }
}
