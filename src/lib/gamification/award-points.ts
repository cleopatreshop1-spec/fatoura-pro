import { SupabaseClient } from '@supabase/supabase-js'

export type GamificationEvent =
  | 'invoice_created'
  | 'invoice_submitted'
  | 'invoice_validated'
  | 'payment_recorded'
  | 'streak_7days'
  | 'referral_activated'
  | 'profile_complete'

const POINTS: Record<GamificationEvent, number> = {
  invoice_created:    5,
  invoice_submitted:  20,
  invoice_validated:  30,
  payment_recorded:   15,
  streak_7days:       100,
  referral_activated: 200,
  profile_complete:   50,
}

const LEVEL_THRESHOLDS = [
  { min: 5000, level: 'platine',  label: 'Champion TTN' },
  { min: 2000, level: 'or',       label: 'Expert' },
  { min: 500,  level: 'argent',   label: 'Actif' },
  { min: 0,    level: 'bronze',   label: 'Débutant' },
]

function computeLevel(points: number) {
  return LEVEL_THRESHOLDS.find(t => points >= t.min) ?? LEVEL_THRESHOLDS[3]!
}

export async function awardPoints(
  supabase: SupabaseClient,
  companyId: string,
  event: GamificationEvent,
  description?: string
) {
  const pts = POINTS[event]

  await supabase.from('gamification_events').insert({
    company_id:  companyId,
    event_type:  event,
    points:      pts,
    description: description ?? event,
  })

  const { data: company } = await supabase
    .from('companies')
    .select('total_points, streak_days, streak_last_activity')
    .eq('id', companyId)
    .single()

  if (!company) return

  const newPoints = (Number(company.total_points ?? 0)) + pts
  const newLevel  = computeLevel(newPoints)

  const today = new Date().toISOString().slice(0, 10)
  const lastActivity = (company as any).streak_last_activity
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  let streakDays = Number((company as any).streak_days ?? 0)
  if (lastActivity === yesterday) {
    streakDays += 1
  } else if (lastActivity !== today) {
    streakDays = 1
  }

  const wasStreak7 = streakDays % 7 === 0 && streakDays > 0
  const bonusPoints = wasStreak7 ? POINTS.streak_7days : 0

  await (supabase as any)
    .from('companies')
    .update({
      total_points:          newPoints + bonusPoints,
      level:                 newLevel.level,
      streak_days:           streakDays,
      streak_last_activity:  today,
    })
    .eq('id', companyId)

  if (wasStreak7) {
    await supabase.from('gamification_events').insert({
      company_id:  companyId,
      event_type:  'streak_7days',
      points:      POINTS.streak_7days,
      description: `Série de ${streakDays} jours — bonus!`,
    })
  }
}
