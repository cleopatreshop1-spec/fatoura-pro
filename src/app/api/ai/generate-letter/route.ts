import { GoogleGenerativeAI } from '@google/generative-ai'
import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { captureError } from '@/lib/monitoring/sentry'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'
import { differenceInDays } from 'date-fns'

export const maxDuration = 30

type LetterType = 'payment_reminder' | 'formal_notice' | 'acknowledgment' | 'thank_you' | 'confirmation' | 'credit_request'
type Tone = 'professional' | 'friendly' | 'firm'
type Lang = 'fr' | 'ar' | 'both'

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[Gemini] GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

const TONE_LABELS: Record<Tone, string> = {
  professional: 'professionnel et courtois',
  friendly: 'amical et chaleureux',
  firm: 'ferme et déterminé',
}

const LANG_LABELS: Record<Lang, string> = {
  fr: 'français',
  ar: 'arabe tunisien',
  both: 'français puis arabe tunisien (les deux versions)',
}

function buildPrompt(
  type: LetterType,
  ctx: string,
  toneLabel: string,
  langLabel: string,
  daysLate: number
): string {
  const base = `${ctx}\n\nTon : ${toneLabel}.\nLangue : ${langLabel}.\nFormat : Lettre complète avec en-tête, corps, signature. Longueur : 15-20 lignes. Ne pas inventer de données.`

  switch (type) {
    case 'payment_reminder':
      return `Rédige une lettre de relance de paiement amiable.\n${base}\n\nLa lettre doit :\n1. Rappeler poliment la facture et son montant\n2. Mentionner le délai de retard (${daysLate} jours)\n3. Demander le règlement sous 8 jours\n4. Indiquer les coordonnées bancaires\n5. Terminer avec une formule de politesse professionnelle tunisienne`

    case 'formal_notice':
      return `Rédige une mise en demeure formelle de paiement, ton ferme et légal conforme au droit tunisien.\n${base}\n\nLa lettre doit :\n1. Citer le Code des obligations tunisien (art. 269)\n2. Fixer un délai impératif de 15 jours\n3. Menacer d'une action en justice en cas de non-paiement\n4. Indiquer que des pénalités de retard s'appliquent\n5. Demander un accusé de réception\nFormat : Lettre recommandée avec AR.`

    case 'acknowledgment':
      return `Rédige un accusé de bonne réception de paiement.\n${base}\n\nLa lettre doit :\n1. Confirmer la réception du paiement\n2. Indiquer le montant reçu et la référence de facture\n3. Remercier chaleureusement\n4. Clore la relation commerciale pour cette transaction`

    case 'thank_you':
      return `Rédige une lettre de remerciement client après prestation.\n${base}\n\nLa lettre doit :\n1. Remercier pour la confiance accordée\n2. Résumer brièvement la prestation réalisée\n3. Inviter à renouveler la collaboration\n4. Proposer de recommander la société à l'entourage`

    case 'confirmation':
      return `Rédige une lettre de confirmation de prestation / bon de commande.\n${base}\n\nLa lettre doit :\n1. Confirmer la prestation commandée et le montant\n2. Préciser les délais et modalités\n3. Rappeler les conditions de paiement\n4. Indiquer le contact pour toute question`

    case 'credit_request':
      return `Rédige une demande d'avoir ou de correction de facture.\n${base}\n\nLa lettre doit :\n1. Référencer la facture originale à corriger\n2. Expliquer la raison de la correction\n3. Indiquer le montant de l'avoir demandé\n4. Préciser le délai souhaité pour l'émission de l'avoir`
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await applyRateLimit(rateLimiters.letters, getClientIp(request))
    if (limited) return limited

    const { company, supabase } = await getAuthenticatedCompany(request)
    const co = company as any

    const plan = await getCompanyPlan(supabase as any, co.id)
    if (!canUseFeature(plan, 'letters')) return upgradeRequiredResponse('letters')

    const body = await request.json()
    const { type, invoiceId, tone = 'professional', language = 'fr' } = body as {
      type: LetterType
      invoiceId: string
      tone?: Tone
      language?: Lang
    }

    if (!type || !invoiceId) return err('type et invoiceId requis', 400)

    const { data: invoice } = await (supabase as any)
      .from('invoices')
      .select('*, clients(*)')
      .eq('id', invoiceId)
      .eq('company_id', co.id)
      .single()

    if (!invoice) return err('Facture introuvable', 404)

    const client = (invoice.clients as any) ?? {}
    const today = new Date()
    const daysLate = invoice.due_date
      ? Math.max(0, differenceInDays(today, new Date(invoice.due_date)))
      : 0

    const ctx = [
      'Données de la facture :',
      `- Numéro          : ${invoice.number ?? 'N/A'}`,
      `- Montant TTC     : ${Number(invoice.ttc_amount ?? 0).toFixed(3)} TND`,
      `- Date echéance   : ${invoice.due_date ?? 'N/A'}`,
      `- Jours de retard : ${daysLate}`,
      `- Client          : ${client.name ?? 'N/A'}`,
      `- Adresse client  : ${client.address ?? 'N/A'}`,
      `- Société émettrice    : ${co.name ?? 'N/A'}`,
      `- Matricule fiscal     : ${co.matricule_fiscal ?? 'À compléter'}`,
      `- Coordonnées bancaires: ${co.bank_rib ?? 'À compléter'}`,
    ].join('\n')

    const toneLabel = TONE_LABELS[tone] ?? TONE_LABELS.professional
    const langLabel = LANG_LABELS[language] ?? LANG_LABELS.fr

    const prompt = buildPrompt(type, ctx, toneLabel, langLabel, daysLate)

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
    })

    const result = await model.generateContent(prompt)
    const letter = result.response.text()

    return Response.json({ letter, type, language, tone })

  } catch (error: any) {
    if (error?.status === 401 || error?.status === 404) {
      return err(error.message, error.status)
    }
    captureError(error, { action: 'generate_letter' })
    return err('Impossible de générer le courrier. Réessayez.', 500)
  }
}
