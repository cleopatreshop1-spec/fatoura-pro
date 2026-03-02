import { GoogleGenerativeAI } from '@google/generative-ai'
import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { captureError } from '@/lib/monitoring/sentry'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'

export const maxDuration = 30

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[Gemini] GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

export async function POST(request: NextRequest) {
  try {
    const limited = await applyRateLimit(rateLimiters.ocr, getClientIp(request))
    if (limited) return limited

    const { company, supabase } = await getAuthenticatedCompany(request)
    const plan = await getCompanyPlan(supabase as any, (company as any).id)
    if (!canUseFeature(plan, 'ocr')) return upgradeRequiredResponse('ocr')

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file)                         return err('Fichier manquant', 400)
    if (file.size > MAX_SIZE)          return err('Fichier trop volumineux (max 10 Mo)', 400)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return err('Format non supporté. Utilisez PDF, JPG ou PNG.', 400)
    }

    const bytes  = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' })

    const prompt = `Tu es un extracteur de données pour un logiciel de facturation tunisien.
Analyse ce document et extrais UNIQUEMENT les lignes facturables.

Pour chaque ligne, retourne un objet JSON avec exactement ces champs :
{"description":"...","quantity":1,"unit_price":500.000,"tva_rate":19}

Règles TVA Tunisie :
- Prestations de services standard : 19%
- Si le document mentionne explicitement un taux → l'utiliser
- Si exonéré ou taux 0% mentionné → 0
- En cas de doute → 19%
- Taux valides uniquement : 19, 13, 7, 0

Retourne UNIQUEMENT un tableau JSON valide, rien d'autre.
Pas de markdown, pas d'explication, juste le JSON brut.
Exemple : [{"description":"Conseil informatique","quantity":1,"unit_price":500.000,"tva_rate":19}]

Si tu ne trouves aucune ligne facturable : retourne []`

    const result = await model.generateContent([
      { inlineData: { mimeType: file.type as any, data: base64 } },
      prompt,
    ])

    const text = result.response.text().trim()

    // Strip possible markdown code fences
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const lines = JSON.parse(cleaned)

    if (!Array.isArray(lines)) throw new Error('Format invalide')

    const validated = lines.map((l: any) => ({
      description: String(l.description ?? '').slice(0, 200),
      quantity:    Math.max(0.001, Number(l.quantity) || 1),
      unit_price:  Math.max(0, Number(l.unit_price) || 0),
      tva_rate:    [19, 13, 7, 0].includes(Number(l.tva_rate)) ? Number(l.tva_rate) : 19,
    }))

    return Response.json({ lines: validated, count: validated.length })

  } catch (error: any) {
    if (error?.status === 401 || error?.status === 404) {
      return err(error.message, error.status)
    }
    if (error instanceof SyntaxError) {
      return err('Impossible d\'extraire les données. Vérifiez que le document contient des prix.', 422)
    }
    captureError(error, { action: 'ocr_document' })
    return err('Impossible d\'extraire les données. Vérifiez que le document contient des prix.', 422)
  }
}
