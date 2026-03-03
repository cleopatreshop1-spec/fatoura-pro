import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { type NextRequest } from 'next/server'

export const maxDuration = 30

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedCompany(request)

    const { keyword } = await request.json()
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
      return err('Mot-clé trop court', 400)
    }

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
    })

    const prompt = `Tu es un assistant de facturation tunisien expert.
L'utilisateur a tapé ce mot-clé pour une ligne de facture : "${keyword.trim()}"

Génère une description professionnelle courte (max 80 caractères) et suggère un prix unitaire HT raisonnable en TND pour le marché tunisien, ainsi que le taux TVA approprié.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication :
{"description":"...","unit_price":0.000,"tva_rate":19}

Règles TVA Tunisie : 19% (services standard), 7% (biens de première nécessité), 0% (exonéré).
Prix réalistes pour la Tunisie en TND. Ne jamais laisser unit_price à 0.`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?|```\n?/g, '').trim()

    let parsed: { description: string; unit_price: number; tva_rate: number }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return err('Réponse IA invalide', 500)
    }

    if (!parsed.description || !parsed.unit_price) {
      return err('Données IA incomplètes', 500)
    }

    return Response.json({
      description: parsed.description,
      unit_price:  Math.round(Number(parsed.unit_price) * 1000) / 1000,
      tva_rate:    [0, 7, 13, 19].includes(Number(parsed.tva_rate)) ? Number(parsed.tva_rate) : 19,
    })

  } catch (e: any) {
    console.error('[suggest-line]', e)
    return err(e.message ?? 'Erreur IA', 500)
  }
}
