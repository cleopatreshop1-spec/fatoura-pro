import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { sanitizeString } from '@/lib/utils/sanitize'
import { type NextRequest } from 'next/server'

export const maxDuration = 45

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY manquante')
  return new GoogleGenerativeAI(key)
}

export async function POST(request: NextRequest) {
  try {
    const { company, supabase } = await getAuthenticatedCompany(request)

    const { description: rawDesc } = await request.json()
    const description = sanitizeString(rawDesc ?? '', 1000)
    if (description.length < 5) return err('Description trop courte', 400)

    // Load company clients for smart matching
    const { data: clients } = await (supabase as any)
      .from('clients')
      .select('id, name, matricule_fiscal, type')
      .eq('company_id', company.id)
      .order('name')
      .limit(50)

    const clientList = (clients ?? []).map((c: any) =>
      `{"id":"${c.id}","name":"${c.name}","type":"${c.type ?? 'B2B'}"}`
    ).join(',')

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    })

    const prompt = `Tu es un assistant de facturation tunisien expert. L'utilisateur décrit une facture en langue naturelle.

Description de l'utilisateur : "${description}"

Clients existants (JSON array) : [${clientList}]

Génère un objet JSON représentant la facture à créer. 

Règles :
- Si un client correspond à la description, utilise son id. Sinon client_id = null.
- tva_rate : 19 (services standard), 7 (biens essentiels), 0 (exonéré)  
- unit_price en TND, réaliste pour la Tunisie
- due_date = aujourd'hui + 30 jours si non précisé (format YYYY-MM-DD, aujourd'hui = ${new Date().toISOString().slice(0,10)})
- notes : courte note professionnelle si pertinent, sinon ""

Réponds UNIQUEMENT avec ce JSON valide, sans markdown :
{
  "client_id": "uuid-ou-null",
  "client_name_hint": "nom si pas trouvé dans la liste",
  "due_date": "YYYY-MM-DD",
  "notes": "",
  "lines": [
    {
      "description": "description ligne",
      "quantity": 1,
      "unit_price": 0.000,
      "tva_rate": 19
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?|```\n?/g, '').trim()

    let parsed: {
      client_id: string | null
      client_name_hint?: string
      due_date: string
      notes: string
      lines: { description: string; quantity: number; unit_price: number; tva_rate: number }[]
    }

    try {
      parsed = JSON.parse(raw)
    } catch {
      return err('Réponse IA invalide', 500)
    }

    if (!parsed.lines?.length) return err('Aucune ligne générée', 500)

    return Response.json({
      client_id:        parsed.client_id ?? null,
      client_name_hint: parsed.client_name_hint ?? null,
      due_date:         parsed.due_date ?? null,
      notes:            parsed.notes ?? '',
      lines: parsed.lines.map(l => ({
        description: String(l.description ?? '').slice(0, 300),
        quantity:    Math.max(0.001, Number(l.quantity ?? 1)),
        unit_price:  Math.round(Number(l.unit_price ?? 0) * 1000) / 1000,
        tva_rate:    [0, 7, 13, 19].includes(Number(l.tva_rate)) ? Number(l.tva_rate) : 19,
      })),
    })
  } catch (e: any) {
    return err(e.message ?? 'Erreur IA', 500)
  }
}
