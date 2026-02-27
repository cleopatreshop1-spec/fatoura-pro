'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceListItem, InvoiceStatus } from '@/types/app'

interface UseInvoicesOptions {
  companyId: string | null | undefined
  status?: InvoiceStatus
}

export function useInvoices({ companyId, status }: UseInvoicesOptions) {
  const supabase = useMemo(() => createClient(), [])
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)

    let q = supabase
      .from('invoices')
      .select('id, number, status, issue_date, due_date, ht_amount, ttc_amount, payment_status, clients(name)')
      .eq('company_id', companyId)
      .order('issue_date', { ascending: false })

    if (status) q = q.eq('status', status) as typeof q

    const { data, error: e } = await q
    if (e) {
      setError(e.message)
    } else {
      setInvoices(
        (data ?? []).map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.number ?? inv.invoice_number ?? '—',
          invoice_date: inv.issue_date ?? inv.invoice_date ?? '',
          due_date: inv.due_date,
          status: inv.status,
          total_ht: Number(inv.ht_amount ?? inv.total_ht ?? 0),
          total_ttc: Number(inv.ttc_amount ?? inv.total_ttc ?? 0),
          payment_status: inv.payment_status ?? 'unpaid',
          client_name: inv.clients?.name,
        }))
      )
    }
    setLoading(false)
  }, [companyId, status, supabase])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { invoices, loading, error, refresh: fetch }
}
