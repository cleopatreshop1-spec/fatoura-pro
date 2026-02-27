// src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanyProvider } from '@/contexts/CompanyContext'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Auto-create company if user has none yet
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)

  if (!companies?.length) {
    const defaultName = user.email ? user.email.split('@')[0] : 'Mon Espace'
    await supabase.from('companies').insert({
      owner_id: user.id,
      name: defaultName,
      plan: 'free',
    })
  }

  // Build user display info from metadata
  const meta = user.user_metadata ?? {}
  const firstName: string = (meta.first_name ?? '') as string
  const lastName: string  = (meta.last_name  ?? '') as string
  const userName  = [firstName, lastName].filter(Boolean).join(' ')
  const userEmail = user.email ?? ''

  // Initials: first letter of firstName + first letter of lastName, else first 2 of email
  const userInitials = firstName && lastName
    ? (firstName[0] + lastName[0]).toUpperCase()
    : userEmail.slice(0, 2).toUpperCase()

  return (
    <CompanyProvider>
      <DashboardShell
        userEmail={userEmail}
        userName={userName}
        userInitials={userInitials}
      >
        {children}
      </DashboardShell>
    </CompanyProvider>
  )
}
