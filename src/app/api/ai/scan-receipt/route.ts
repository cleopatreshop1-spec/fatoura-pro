import { GoogleGenerativeAI } from '@google/generative-ai'
import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { captureError } from '@/lib/monitoring/sentry'
import { getCompanyPlan, canUseFeature, upgradeRequiredResponse } from '@/lib/ai/plan-gate'

export const maxDuration = 30

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

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
    const co = company as any

    const plan = await getCompanyPlan(supabase as any, co.id)
    if (!canUseFeature(plan, 'scan_receipt')) return upgradeRequiredResponse('scan_receipt')

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return err('Fichier manquant', 400)
    if (file.size > MAX_SIZE) return err('Fichier trop volumineux (max 10 Mo)', 400)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return err('Format non supporté. Utilisez JPG, PNG ou PDF.', 400)
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' })

    const prompt = `Analyse ce reçu ou ticket de caisse tunisien.
Extrais exactement ces données en JSON :
{
  "date": "YYYY-MM-DD ou null si illisible",
  "merchant": "nom du commerce ou null",
  "amount": montant total TND (nombre),
  "category": une de ces catégories exactement : "Fournitures de bureau" | "Transport et carburant" | "Restauration client" | "Télécommunications" | "Loyer et charges" | "Équipement informatique" | "Formation et documentation" | "Publicité et marketing" | "Services professionnels" | "Autre",
  "tva_rate": taux TVA si visible sur le reçu (19, 7, ou 0) ou null,
  "tva_amount": montant TVA si visible ou null
}
Retourne uniquement le JSON. Pas d'explication. Pas de markdown.`

    const result = await model.generateContent([
      { inlineData: { mimeType: file.type as any, data: base64 } },
      prompt,
    ])

    const text = result.response.text().trim()
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(cleaned)

    const receipt = {
      date:       typeof data.date === 'string' ? data.date : null,
      merchant:   typeof data.merchant === 'string' ? data.merchant.slice(0, 200) : null,
      amount:     Math.max(0, Number(data.amount) || 0),
      category:   typeof data.category === 'string' ? data.category : 'Autre',
      tva_rate:   [19, 7, 0].includes(Number(data.tva_rate)) ? Number(data.tva_rate) : null,
      tva_amount: data.tva_amount != null ? Math.max(0, Number(data.tva_amount)) : null,
    }

    return Response.json({ receipt })

  } catch (error: any) {
    if (error?.status === 401 || error?.status === 404) {
      return err(error.message, error.status)
    }
    if (error instanceof SyntaxError) {
      return err('Impossible d\'analyser le reçu. Vérifiez la qualité de l\'image.', 422)
    }
    captureError(error, { action: 'scan_receipt' })
    return err('Impossible d\'analyser le reçu. Réessayez.', 422)
  }
}
