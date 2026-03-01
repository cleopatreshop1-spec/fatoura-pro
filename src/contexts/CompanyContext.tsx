'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback
} from 'react'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  current_plan: string
  owner_id: string
  is_fiduciaire?: boolean
  matricule_fiscal?: string | null
  invoice_prefix?: string | null
}

interface FiduciaiireLink {
  id: string
  client_company_id: string | null
  invited_email: string | null
  client_name: string | null
  status: string
  accepted_at: string | null
  invited_at: string | null
  clientCompany?: Company | null
}

interface CompanyContextValue {
  activeCompany: Company | null
  ownCompany: Company | null
  allCompanies: Company[]
  loadingCompanies: boolean
  companyLoadError: string
  isGuestView: boolean
  isFiduciaire: boolean
  fiduciaiireLinks: FiduciaiireLink[]
  switchCompany: (id: string) => void
  exitGuestView: () => void
  refreshCompanies: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [ownCompany, setOwnCompany] = useState<Company | null>(null)
  const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([])
  const [fiduciaiireLinks, setFiduciaiireLinks] = useState<FiduciaiireLink[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [companyLoadError, setCompanyLoadError] = useState('')

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    setCompanyLoadError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingCompanies(false); return }

    // Own company
    const { data: ownList, error: ownError } = await supabase
      .from('companies')
      .select('id, name, current_plan, owner_id, is_fiduciaire, matricule_fiscal, invoice_prefix')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (ownError) {
      setCompanyLoadError(ownError.message)
      setLoadingCompanies(false)
      return
    }

    const own = (ownList?.[0] ?? null) as Company | null

    // User-level accountant links (legacy)
    const { data: userLinks } = await supabase
      .from('accountant_links')
      .select('company:companies(id, name, current_plan, owner_id, is_fiduciaire, matricule_fiscal, invoice_prefix)')
      .eq('accountant_id', user.id)
      .not('accepted_at', 'is', null)

    const accountantCompanies = (userLinks?.map((l: any) => l.company).filter(Boolean) ?? []) as Company[]

    // Company-level fiduciaire links (new model)
    let fidClients: FiduciaiireLink[] = []
    let fidClientCompanies: Company[] = []

    if (own?.id) {
      const { data: fidLinks } = await supabase
        .from('fiduciaire_clients')
        .select(`
          id, client_company_id, invited_email, client_name, status, accepted_at, invited_at,
          clientCompany:companies!client_company_id(id, name, current_plan, owner_id, is_fiduciaire, matricule_fiscal, invoice_prefix)
        `)
        .eq('fiduciaire_company_id', own.id)
        .order('invited_at', { ascending: false })

      if (fidLinks) {
        fidClients = fidLinks as any
        fidClientCompanies = fidLinks
          .filter((l: any) => l.clientCompany && l.status === 'active')
          .map((l: any) => l.clientCompany) as Company[]
      }
    }

    setOwnCompany(own)
    setLinkedCompanies([...accountantCompanies, ...fidClientCompanies])
    setFiduciaiireLinks(fidClients)

    if (own && !activeId) setActiveId(own.id)
    setLoadingCompanies(false)
  }, [supabase]) // eslint-disable-line

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  const allCompanies = [
    ...(ownCompany ? [ownCompany] : []),
    ...linkedCompanies,
  ]

  const activeCompany = allCompanies.find(c => c.id === activeId) ?? ownCompany
  const isGuestView = !!(activeCompany && ownCompany && activeCompany.id !== ownCompany.id)
  const isFiduciaire = !!(ownCompany as any)?.is_fiduciaire

  function switchCompany(id: string) {
    if (allCompanies.some(c => c.id === id)) setActiveId(id)
  }

  function exitGuestView() {
    if (ownCompany) setActiveId(ownCompany.id)
  }

  return (
    <CompanyContext.Provider value={{
      activeCompany, ownCompany, allCompanies,
      loadingCompanies, companyLoadError,
      isGuestView, isFiduciaire,
      fiduciaiireLinks, switchCompany, exitGuestView,
      refreshCompanies: fetchCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be inside CompanyProvider')
  return ctx
}
