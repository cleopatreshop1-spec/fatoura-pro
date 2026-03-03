import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { applyRateLimit, rateLimiters, getClientIp } from '@/lib/rate-limiter'
import { captureError } from '@/lib/monitoring/sentry'
import { buildUserContext, buildSystemPrompt } from '@/lib/ai/context-builder'
import { parseAction, stripAction } from '@/lib/ai/action-parser'
import { type NextRequest } from 'next/server'

export const maxDuration = 30

type GeminiPart    = { text: string }
type GeminiMessage = { role: 'user' | 'model'; parts: GeminiPart[] }

function getGeminiClient(): GoogleGenerativeAI {
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

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit — 20 messages AI par heure par IP
    const ip      = getClientIp(request)
    const limited = await applyRateLimit(rateLimiters.ai, ip)
    if (limited) return limited

    // 2. Auth
    const { company, supabase } = await getAuthenticatedCompany(request)

    // 3. Parse body
    const body = await request.json()
    const message: string          = (body.message ?? '').trim()
    const history: GeminiMessage[] = Array.isArray(body.history) ? body.history : []

    if (!message) return err('Message vide', 400)

    // 4. Build context from live company data
    const context           = await buildUserContext(supabase as any, (company as any).id)
    const systemInstruction = buildSystemPrompt(company, context)

    // 5. Gemini call
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      systemInstruction,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    })

    const chat = model.startChat({ history })
    const result = await callWithRetry(() => chat.sendMessage(message))
    const rawText: string = result.response.text()

    // 6. Parse optional CREATE_INVOICE action
    const action      = parseAction(rawText)
    const displayText = action ? stripAction(rawText) : rawText

    // 7. Mark proactive suggestions as read
    await (supabase as any).from('ai_suggestions')
      .update({ is_read: true })
      .eq('company_id', (company as any).id)
      .eq('is_read', false)

    return Response.json({ message: displayText, action, role: 'model' })

  } catch (error: any) {
    captureError(error, { action: 'fatoura_ai_chat' })

    const isQuota = error?.message?.includes('429') || error?.message?.includes('quota')
    if (isQuota) {
      return Response.json({
        message: '⏳ Fatoura AI est très sollicitée en ce moment. Réessayez dans 1 minute. Vos factures TTN fonctionnent normalement.',
        error: 'quota_exceeded',
        role: 'model',
      }, { status: 429 })
    }

    const isKeyMissing = error?.message?.includes('GEMINI_API_KEY')
    if (isKeyMissing) {
      return Response.json({
        message: 'Fatoura AI n\'est pas encore configurée. Contactez le support.',
        error: 'config_error',
        role: 'model',
      }, { status: 503 })
    }

    return Response.json({
      message: 'Une erreur est survenue. Réessayez dans un moment.',
      error: 'internal_error',
      role: 'model',
    }, { status: 500 })
  }
}
