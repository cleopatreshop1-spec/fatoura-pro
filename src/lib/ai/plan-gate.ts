import type { SupabaseClient } from '@supabase/supabase-js'

export type PlanFeature =
  | 'ttn_validator'
  | 'payment_prediction'
  | 'ocr'
  | 'letters'
  | 'anomaly_detection'
  | 'forecast'
  | 'ai_chat'
  | 'voice'
  | 'scan_receipt'
  | 'fiduciaire_summary'

type Plan = 'starter' | 'essential' | 'pro' | 'fiduciaire' | 'unknown'

const PLAN_FEATURES: Record<Plan, PlanFeature[]> = {
  starter: ['ttn_validator'],
  essential: [
    'ttn_validator', 'payment_prediction', 'ocr', 'letters', 'anomaly_detection',
  ],
  pro: [
    'ttn_validator', 'payment_prediction', 'ocr', 'letters', 'anomaly_detection',
    'forecast', 'ai_chat', 'voice', 'scan_receipt',
  ],
  fiduciaire: [
    'ttn_validator', 'payment_prediction', 'ocr', 'letters', 'anomaly_detection',
    'forecast', 'ai_chat', 'voice', 'scan_receipt', 'fiduciaire_summary',
  ],
  unknown: ['ttn_validator'],
}

const UPGRADE_MESSAGES: Record<PlanFeature, { message: string; minPlan: string }> = {
  ttn_validator:       { message: 'Toujours disponible',                                    minPlan: 'starter' },
  payment_prediction:  { message: 'La prédiction de paiement est disponible à partir du plan Essentiel', minPlan: 'essential' },
  ocr:                 { message: "L'OCR est disponible à partir du plan Essentiel",         minPlan: 'essential' },
  letters:             { message: 'La génération de courriers est disponible à partir du plan Essentiel', minPlan: 'essential' },
  anomaly_detection:   { message: 'La détection d\'anomalies est disponible à partir du plan Essentiel', minPlan: 'essential' },
  forecast:            { message: 'Les prévisions CA sont disponibles à partir du plan Pro', minPlan: 'pro' },
  ai_chat:             { message: 'Fatoura AI est disponible à partir du plan Pro',          minPlan: 'pro' },
  voice:               { message: "L'assistant vocal est disponible à partir du plan Pro",   minPlan: 'pro' },
  scan_receipt:        { message: 'Le scan de reçus est disponible à partir du plan Pro',    minPlan: 'pro' },
  fiduciaire_summary:  { message: 'Les résumés IA clients sont disponibles sur le plan Fiduciaire', minPlan: 'fiduciaire' },
}

export async function getCompanyPlan(
  supabase: SupabaseClient,
  companyId: string
): Promise<Plan> {
  try {
    const { data } = await (supabase as any)
      .from('companies')
      .select('plan')
      .eq('id', companyId)
      .single()
    const p = data?.plan as string | null
    if (p && p in PLAN_FEATURES) return p as Plan
  } catch {}
  return 'unknown'
}

export function canUseFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false
}

export function upgradeRequiredResponse(feature: PlanFeature): Response {
  const info = UPGRADE_MESSAGES[feature]
  return Response.json({
    error: 'upgrade_required',
    message: info.message,
    minPlan: info.minPlan,
    upgradeUrl: '/dashboard/settings/billing',
  }, { status: 402 })
}
