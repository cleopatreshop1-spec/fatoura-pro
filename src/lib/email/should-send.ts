import type { SupabaseClient } from '@supabase/supabase-js'

type NotificationPrefKey =
  | 'invoice_validated_email'
  | 'invoice_rejected_email'
  | 'mandate_expiring_email'
  | 'cert_expiring_email'
  | 'monthly_tva_email'
  | 'weekly_report_email'
  | 'overdue_reminder_email'

export async function shouldSendEmail(
  supabase: SupabaseClient,
  companyId: string,
  type: NotificationPrefKey
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('notification_preferences')
      .select(type)
      .eq('company_id', companyId)
      .single()
    if (!data) return true // default: send if no prefs found
    return (data as any)[type] === true
  } catch {
    return true
  }
}

export async function getCompanyEmail(
  supabase: SupabaseClient,
  companyId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('notification_email')
    .eq('company_id', companyId)
    .single()
  if ((data as any)?.notification_email) return (data as any).notification_email

  const { data: company } = await supabase
    .from('companies')
    .select('email')
    .eq('id', companyId)
    .single()
  return (company as any)?.email ?? null
}
