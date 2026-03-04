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

    const { invoiceData, targetLanguage } = await request.json()
    if (!invoiceData || !targetLanguage) return err('Données manquantes', 400)

    const LANG_LABELS: Record<string, string> = {
      ar: 'arabe (العربية)',
      fr: 'français',
      en: 'anglais',
    }
    const langLabel = LANG_LABELS[targetLanguage] ?? targetLanguage

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    })

    const prompt = `Tu es un traducteur professionnel spécialisé dans les factures commerciales tunisiennes.
Traduis le contenu de cette facture en ${langLabel}.
Conserve EXACTEMENT la même structure JSON. Traduis UNIQUEMENT les champs texte (descriptions, notes, adresses).
Ne modifie PAS les montants, les dates, les numéros, les MF, les codes.
Si la langue cible est l'arabe, utilise l'arabe standard moderne (MSA).

Données de la facture à traduire :
${JSON.stringify(invoiceData, null, 2)}

Réponds UNIQUEMENT avec le JSON traduit valide, sans markdown, sans explication.`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?|```\n?/g, '').trim()

    let translated: Record<string, unknown>
    try {
      translated = JSON.parse(raw)
    } catch {
      return err('Réponse IA invalide', 500)
    }

    return Response.json({ success: true, data: translated, language: targetLanguage })

  } catch (e: any) {
    return err(e.message ?? 'Erreur IA', 500)
  }
}
