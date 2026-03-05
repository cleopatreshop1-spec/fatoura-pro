'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Building2, Shield, Key, Bell, Lock, CreditCard, History, Globe } from 'lucide-react'
import { CompanyTab } from '@/components/settings/CompanyTab'
import { SignatureTab } from '@/components/settings/SignatureTab'
import { ApiKeysTab } from '@/components/settings/ApiKeysTab'
import { NotificationsTab } from '@/components/settings/NotificationsTab'
import { SecurityTab } from '@/components/settings/SecurityTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { ActivityLogTab } from '@/components/settings/ActivityLogTab'
import { PublicProfileTab } from '@/components/settings/PublicProfileTab'

type TabId = 'company' | 'signature' | 'api-keys' | 'notifications' | 'security' | 'billing' | 'history' | 'public-profile'

const TABS: { id: TabId; label: string; Icon: any; desc: string }[] = [
  { id: 'company',       label: 'Entreprise',             Icon: Building2,  desc: 'Infos, logo, banque' },
  { id: 'billing',       label: 'Abonnement',             Icon: CreditCard, desc: 'Plan, paiements, usage' },
  { id: 'signature',     label: 'Signature électronique', Icon: Shield,     desc: 'Mandat / certificat ANCE' },
  { id: 'api-keys',      label: 'Clés API',               Icon: Key,        desc: 'Intégrations ERP' },
  { id: 'notifications', label: 'Notifications',          Icon: Bell,       desc: 'Alertes et emails' },
  { id: 'security',      label: 'Sécurité',               Icon: Lock,       desc: 'Mot de passe, sessions' },
  { id: 'history',       label: 'Historique',             Icon: History,    desc: 'Journal des activités' },
  { id: 'public-profile', label: 'Profil public',          Icon: Globe,      desc: 'Page /c/[slug]' },
]

const VALID_TABS = TABS.map(t => t.id)

function SettingsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null
  const initialTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'company'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null
    if (tab && VALID_TABS.includes(tab)) setActiveTab(tab)
  }, [searchParams])

  const active = TABS.find(t => t.id === activeTab)!

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-white">Paramètres</h1>
        <p className="text-gray-500 text-sm">Configuration de votre espace Fatoura Pro</p>
      </div>

      <div className="flex gap-6 items-start">

        {/*  Sidebar tabs (200px)  */}
        <div className="w-48 shrink-0 bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
          <div className="py-2">
            {TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-all relative ${
                    isActive
                      ? 'bg-[#161b27] text-[#d4a843]'
                      : 'text-gray-400 hover:bg-[#161b27]/50 hover:text-gray-200'
                  }`}>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#d4a843] rounded-r-full" />}
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
                  <span className="font-medium leading-tight">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/*  Tab content  */}
        <div className="flex-1 min-w-0">
          {/* Tab header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <active.Icon size={16} className="text-[#d4a843]" strokeWidth={2} />
              <h2 className="text-base font-bold text-white">{active.label}</h2>
            </div>
            <p className="text-xs text-gray-500">{active.desc}</p>
          </div>

          {/* Render active tab */}
          {activeTab === 'company'       && <CompanyTab />}
          {activeTab === 'billing'       && <BillingTab />}
          {activeTab === 'signature'     && <SignatureTab />}
          {activeTab === 'api-keys'      && <ApiKeysTab />}
          {activeTab === 'notifications'  && <NotificationsTab />}
          {activeTab === 'security'       && <SecurityTab />}
          {activeTab === 'history'        && <ActivityLogTab />}
          {activeTab === 'public-profile' && <PublicProfileTab />}
        </div>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-6 bg-[#1a1b22] rounded w-28 mb-2" />
        <div className="h-3.5 bg-[#1a1b22] rounded w-64" />
      </div>
      <div className="flex gap-6 items-start">
        <div className="w-48 shrink-0 bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-2 space-y-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-4 h-4 bg-[#1a1b22] rounded" />
              <div className="h-3 bg-[#1a1b22] rounded flex-1" />
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-5 bg-[#1a1b22] rounded w-36 mb-1" />
          <div className="h-3 bg-[#1a1b22] rounded w-48 mb-4" />
          <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-[#1a1b22] rounded w-24" />
                <div className="h-9 bg-[#1a1b22] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}
