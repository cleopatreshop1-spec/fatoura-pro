import { GoogleGenerativeAI } from '@google/generative-ai'
import { type NextRequest } from 'next/server'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { getAuthenticatedCompany } from '@/lib/api-helpers'
import { captureError } from '@/lib/monitoring/sentry'

export const maxDuration = 30

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[Gemini] GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const message = (error as any)?.message ?? ''
    const status  = (error as any)?.status ?? 0
    const is429   = message.includes('429') ||
                    message.includes('quota') ||
                    message.includes('TooManyRequests') ||
                    status === 429
    if (is429 && retries > 0) {
      await new Promise(r => setTimeout(r, delayMs))
      return callWithRetry(fn, retries - 1, delayMs * 2)
    }
    throw error
  }
}

function detectLanguage(text: string): 'ar' | 'fr' | 'mixed' {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length
  const totalChars = text.replace(/\s/g, '').length
  const arabicRatio = arabicChars / (totalChars || 1)
  if (arabicRatio > 0.6) return 'ar'
  if (arabicRatio < 0.1) return 'fr'
  return 'mixed'
}

export async function POST(request: NextRequest) {
  try {
    const limited = await applyRateLimit(
      rateLimiters.ai,
      `transcribe:${getClientIp(request)}`
    )
    if (limited) return limited

    await getAuthenticatedCompany(request)

    const formData = await request.formData()
    const audioBlob = formData.get('audio') as File | null

    if (!audioBlob) {
      return Response.json({ error: 'Audio manquant' }, { status: 400 })
    }

    if (audioBlob.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: 'Enregistrement trop long (max ~2 minutes)' },
        { status: 400 }
      )
    }

    const bytes = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(bytes).toString('base64')
    const mimeType = audioBlob.type || 'audio/webm'

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 512,
      },
    })

    const prompt = `Tu es un assistant de transcription spécialisé en tunisien (Darija).

L'audio provient d'un entrepreneur tunisien qui parle à son logiciel de facturation électronique (Fatoura Pro). Il peut parler en :
- Arabe tunisien (Darija)
- Français
- Mélange des deux (code-switching tunisien)
- Termes techniques francophones : "facture", "TVA", "client", "montant", "dinar", "TND", "soumettre", "TTN", "matricule"

TRANSCRIS EXACTEMENT ce que la personne dit.
- Garde les mots français tels quels (facture, client, TVA, etc.)
- Translittère l'arabe dialectal en arabe script si clairement prononcé, sinon écris phonétiquement en français
- Si tu entends un montant : écris le chiffre (ex: "150" pas "cent cinquante")
- Si l'audio est inaudible ou vide : retourne exactement ""
- Ne traduis pas, ne corrige pas, ne paraphrase pas

Retourne UNIQUEMENT le texte transcrit, rien d'autre.
Pas d'explication, pas de ponctuation ajoutée, pas de guillemets.`

    const result = await callWithRetry(() =>
      model.generateContent([
        { inlineData: { mimeType: mimeType as any, data: base64Audio } },
        prompt,
      ])
    )

    const transcript = result.response.text().trim()

    if (
      !transcript ||
      transcript.toLowerCase().includes('unable to') ||
      transcript.toLowerCase().includes('cannot transcribe')
    ) {
      return Response.json({ transcript: '', detected_language: 'unknown' })
    }

    return Response.json({
      transcript,
      detected_language: detectLanguage(transcript),
    })

  } catch (error: any) {
    captureError(error, { action: 'voice_transcribe' })

    if (error?.status === 401 || error?.status === 404) {
      return Response.json({ error: error.message }, { status: error.status })
    }

    const isQuota = String(error?.message ?? '').includes('429')
    if (isQuota) {
      return Response.json(
        { error: 'Service surchargé. Réessayez dans 30 secondes.' },
        { status: 429 }
      )
    }

    return Response.json({ error: 'Transcription échouée. Réessayez.' }, { status: 500 })
  }
}
