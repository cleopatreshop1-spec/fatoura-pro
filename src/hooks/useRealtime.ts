'use client'

import { useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseRealtimeOptions {
  table: string
  companyId: string | null | undefined
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

/**
 * Subscribe to Supabase Realtime changes for a given table filtered by company_id.
 * Automatically unsubscribes on unmount.
 */
export function useRealtime({
  table,
  companyId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions) {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel(`${table}:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => onUpdate?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table,
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => onDelete?.(payload)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, companyId, onInsert, onUpdate, onDelete, supabase])
}
