'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Users, Calculator,
  Zap, Settings, ExternalLink, LogOut, X, RefreshCw,
  ChevronDown, Check, Building2, TrendingDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { usePlan } from '@/hooks/usePlan'
import { clearUser } from '@/lib/monitoring/sentry'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const PLAN_LABEL: Record<string, string> = {
  trialing: 'Essai gratuit', starter: 'Starter',
  pro: 'Pro', fiduciaire: 'Fiduciaire', enterprise: 'Enterprise',
}
const PLAN_DOT: Record<string, string> = {
  trialing: 'bg-blue-400', starter: 'bg-gray-400',
  pro: 'bg-[#d4a843]', fiduciaire: 'bg-purple-400', enterprise: 'bg-cyan-400',
}

type NavItem = { href: string; label: string; Icon: LucideIcon; exact?: boolean; badge?: boolean; soon?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard',           label: 'Tableau de bord',       Icon: LayoutDashboard, exact: true },
  { href: '/dashboard/invoices',  label: 'Factures',               Icon: FileText,         badge: true },
  { href: '/dashboard/clients',   label: 'Clients',                Icon: Users },
  { href: '/dashboard/recurring', label: 'Factures récurrentes',   Icon: RefreshCw },
  { href: '/dashboard/tva',       label: 'TVA & Declarations',     Icon: Calculator },
  { href: '/dashboard/expenses',  label: 'Dépenses',               Icon: TrendingDown },
  { href: '/dashboard/financing', label: 'Flash Financing',        Icon: Zap, soon: true },
]

const SECONDARY: NavItem[] = [
  { href: '/dashboard/settings', label: 'Parametres', Icon: Settings },
]

interface Props {
  userEmail: string
  userName: string
  userInitials: string
  onClose?: () => void
}

export function Sidebar({ userEmail, userName, userInitials, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const plan = usePlan()
  const [invoiceBadge, setInvoiceBadge] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)
  const { allCompanies, switchCompany } = useCompany()

  useEffect(() => {
    if (!activeCompany?.id) return
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', activeCompany.id)
      .in('status', ['pending', 'rejected'])
      .then(({ count }) => setInvoiceBadge(count ?? 0))
  }, [activeCompany?.id, supabase])

  async function handleSignOut() {
    setSigningOut(true)
    clearUser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const mf = (activeCompany as any)?.matricule_fiscal as string | null

  return (
    <aside className="flex flex-col h-full w-60 bg-[#0f1118] border-r border-[#1a1b22] select-none">

      {/*  Brand + company  */}
      <div className="px-4 pt-5 pb-4 border-b border-[#1a1b22]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#d4a843]/15 border border-[#d4a843]/30 flex items-center justify-center shrink-0">
              <span className="text-[#d4a843] text-[10px] font-black">F</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[#d4a843] font-mono text-sm font-bold tracking-wide">FATOURA</span>
              <span className="text-gray-600 font-mono text-sm font-bold">PRO</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors lg:hidden p-0.5">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Company switcher */}
        {activeCompany && (
          <div ref={companyRef} className="relative">
            <button
              onClick={() => setCompanyOpen(o => !o)}
              className={cn(
                'w-full flex items-center gap-2 bg-[#161b27] hover:bg-[#1a2035] rounded-lg px-3 py-2 transition-colors group',
                allCompanies.length > 1 ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div className="w-6 h-6 rounded-md bg-[#d4a843]/10 border border-[#d4a843]/20 flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-[#d4a843]" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs text-gray-200 font-medium truncate">
                  {activeCompany.name.length > 18 ? activeCompany.name.slice(0, 18) + '\u2026' : activeCompany.name}
                </div>
                {mf ? (
                  <div className="text-[10px] text-gray-600 font-mono truncate">{mf}</div>
                ) : (
                  <div className="text-[10px] text-gray-700">Sans MF</div>
                )}
              </div>
              {allCompanies.length > 1 && (
                <ChevronDown size={13} className={cn('text-gray-600 shrink-0 transition-transform', companyOpen && 'rotate-180')} />
              )}
            </button>

            {companyOpen && allCompanies.length > 1 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCompanyOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0f1118] border border-[#252830] rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#1a1b22]">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">Changer de compte</p>
                  </div>
                  {allCompanies.map(c => (
                    <button key={c.id}
                      onClick={() => { switchCompany(c.id); setCompanyOpen(false); onClose?.() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#161b27] transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded-md bg-[#d4a843]/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#d4a843]">{c.name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-200 truncate">{c.name}</p>
                        {(c as any).matricule_fiscal && (
                          <p className="text-[10px] text-gray-600 font-mono truncate">{(c as any).matricule_fiscal}</p>
                        )}
                      </div>
                      {c.id === activeCompany?.id && <Check size={13} className="text-[#d4a843] shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/*  Main navigation  */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, Icon, exact, badge, soon }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-[#161b27] text-[#d4a843]'
                  : 'text-gray-400 hover:bg-[#161b27]/60 hover:text-gray-100'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#d4a843] rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
              <span className="flex-1 truncate font-medium">{label}</span>
              {badge && invoiceBadge > 0 && (
                <span className="px-1.5 py-0.5 bg-[#d4a843] text-black text-[10px] font-black rounded-full min-w-[18px] text-center leading-none">
                  {invoiceBadge > 99 ? '99+' : invoiceBadge}
                </span>
              )}
              {soon && (
                <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/25 text-[9px] font-bold rounded tracking-wider">
                  BIENTOT
                </span>
              )}
            </Link>
          )
        })}

        <div className="my-2 mx-1 border-t border-[#1a1b22]" />

        {SECONDARY.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-[#161b27] text-[#d4a843]'
                  : 'text-gray-400 hover:bg-[#161b27]/60 hover:text-gray-100'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#d4a843] rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}

        <a
          href="https://www.ttn.tn/service_client/guide.htm"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose as any}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-[#161b27]/60 hover:text-gray-200 transition-all duration-150"
        >
          <ExternalLink size={16} strokeWidth={1.8} className="shrink-0" />
          <span>Guide TTN</span>
        </a>
      </nav>

      {/*  User section  */}
      <div className="border-t border-[#1a1b22] p-3 space-y-1">
        {/* Plan badge + upgrade CTA */}
        {!plan.loading && (
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#161b27] transition-colors group"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PLAN_DOT[plan.plan] ?? 'bg-gray-500'}`} />
            <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors flex-1 truncate">
              {PLAN_LABEL[plan.plan] ?? plan.plan}
              {plan.isTrialing && plan.trialDaysLeft !== null && ` — ${plan.trialDaysLeft}j`}
            </span>
            {(plan.isTrialing || plan.isExpired) && (
              <span className="text-[9px] font-bold text-[#d4a843] shrink-0">Upgrade</span>
            )}
          </Link>
        )}

        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-[#d4a843]/15 border border-[#d4a843]/25 flex items-center justify-center shrink-0">
            <span className="text-[#d4a843] text-xs font-bold">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            {userName && (
              <div className="text-xs font-medium text-gray-200 truncate">{userName}</div>
            )}
            <div className="text-[10px] text-gray-500 truncate">{userEmail}</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-950/25 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <LogOut size={14} className="shrink-0" />
          <span>{signingOut ? 'Deconnexion...' : 'Se deconnecter'}</span>
        </button>
      </div>
    </aside>
  )
}
