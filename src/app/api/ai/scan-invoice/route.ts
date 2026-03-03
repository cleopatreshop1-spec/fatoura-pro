import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are an expert OCR system specialized in Tunisian business invoices.

The image may contain:
- Handwritten text (even very bad handwriting)
- Printed text
- Arabic text (Modern Standard Arabic or Tunisian dialect)
- French text
- Code-switching between Arabic and French on the same line
- Faded, blurry, or low-contrast ink

TUNISIAN CONTEXT — CRITICAL:
- MF (Matricule Fiscal) format: 7 digits + letter + 3 digits + 3 digits → example: 1234567A000123
- TVA rates used in Tunisia: ONLY 0%, 7%, 13%, or 19% — round any other value to nearest valid rate
- Droit de timbre: always exactly 0.600 TND — use this if you see a fixed 0.6 charge
- Amounts use 3 decimal places in TND
- Dates are written DD/MM/YYYY in Tunisia — convert to YYYY-MM-DD in output
- "HT" = Hors Taxe (pre-tax), "TTC" = Toutes Taxes Comprises (total), "TVA" = tax
- Common Arabic abbreviations:
  م.ق or م.ف = Matricule Fiscal
  ص.ب = Boîte Postale (PO Box)
  ش.م.م = SARL (LLC)
  م.ف.م = Matricule Fiscal Montant
  ح.ج = Compte Courant
  ع = unité (unit)
- "فاتورة" = facture (invoice)
- "زبون" or "عميل" = client
- "المجموع" = total
- "الكمية" = quantité (quantity)
- "سعر الوحدة" = prix unitaire (unit price)

EXTRACTION RULES:
1. For every field: make your BEST GUESS even if unclear — never leave critical fields empty
2. If a number is ambiguous (e.g. 1 vs 7), choose the one that makes the math consistent
3. Verify: total_ht = sum of all line total_ht values (recalculate if needed)
4. Verify: total_ttc = total_ht + total_tva + timbre
5. If you see a TVA rate not in [0, 7, 13, 19], round to nearest valid rate
6. confidence = your overall certainty (0.0 = guessing, 1.0 = perfectly clear)
7. Add warnings for anything that seemed unclear or was inferred

Return ONLY a valid JSON object — no markdown, no explanation, no backticks.`

const JSON_SCHEMA = `{
  "confidence": 0.0,
  "vendor": { "name": "", "address": "", "phone": "", "mf": "", "rne": "" },
  "client": { "name": "", "address": "", "mf": "" },
  "invoice": { "number": "", "date": "YYYY-MM-DD", "due_date": null },
  "lines": [{ "description": "", "quantity": 1, "unit_price": 0.000, "tva_rate": 19, "total_ht": 0.000 }],
  "totals": { "total_ht": 0.000, "total_tva": 0.000, "timbre": 0.600, "total_ttc": 0.000 },
  "payment": { "method": "unknown", "notes": "" },
  "language_detected": "mixed",
  "warnings": []
}`

type GeminiContent = Parameters<ReturnType<typeof genAI.getGenerativeModel>['generateContent']>[0]

async function callGeminiWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  parts: GeminiContent,
  retries = 3
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await model.generateContent(parts)
      return result.response.text()
    } catch (err: unknown) {
      const e = err as { status?: number }
      if (e?.status === 429 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    })

    // ── PASS 1: Extract raw text ──────────────────────────────
    const pass1Result = await callGeminiWithRetry(model, [
      { inlineData: { mimeType: mimeType as 'image/jpeg', data: imageBase64 } },
      `${SYSTEM_PROMPT}

PASS 1 — RAW EXTRACTION:
Read every single character visible in this invoice image.
Transcribe ALL text exactly as you see it, preserving Arabic, French, numbers, and symbols.
Include everything: headers, line items, totals, stamps, handwriting, printed text.
Output the raw transcription only.`,
    ])

    const rawText = pass1Result

    // ── PASS 2: Structure into JSON ───────────────────────────
    const pass2Result = await callGeminiWithRetry(model, [
      `${SYSTEM_PROMPT}

PASS 2 — STRUCTURING:
Below is the raw text extracted from a Tunisian invoice.
Convert it into the exact JSON structure below.
Apply all Tunisian rules (TVA rates, timbre, MF format, date format, math verification).

RAW EXTRACTED TEXT:
${rawText}

OUTPUT JSON STRUCTURE (fill every field):
${JSON_SCHEMA}

Return ONLY the JSON. No markdown. No explanation.`,
    ])

    const cleaned = pass2Result
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const repairResult = await callGeminiWithRetry(model, [
        `The following text is almost valid JSON but has syntax errors.
Fix ONLY the syntax errors and return valid JSON. Do not change any values.

${cleaned}`,
      ])
      parsed = JSON.parse(
        repairResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      )
    }

    // Server-side math verification
    const lines = parsed.lines as Array<{ quantity: number; unit_price: number; tva_rate: number; total_ht: number }> | undefined
    if (lines && lines.length > 0) {
      const recalcHT = lines.reduce((sum, line) => {
        const lineHT = Number(line.quantity) * Number(line.unit_price)
        line.total_ht = Math.round(lineHT * 1000) / 1000
        return sum + line.total_ht
      }, 0)

      const totals = parsed.totals as Record<string, number>
      totals.total_ht = Math.round(recalcHT * 1000) / 1000

      const recalcTVA = lines.reduce((sum, line) => {
        return sum + line.total_ht * (line.tva_rate / 100)
      }, 0)

      totals.total_tva = Math.round(recalcTVA * 1000) / 1000
      totals.timbre    = 0.600
      totals.total_ttc = Math.round(
        (totals.total_ht + totals.total_tva + 0.600) * 1000
      ) / 1000
    }

    return NextResponse.json({ success: true, data: parsed, rawText })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Scan échoué'
    console.error('Invoice scan error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
