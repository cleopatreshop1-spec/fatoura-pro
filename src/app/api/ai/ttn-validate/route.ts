import { type NextRequest } from 'next/server'
import { getAuthenticatedCompany, err } from '@/lib/api-helpers'
import { validateBeforeTTN, type InvoiceValidationData } from '@/lib/ai/ttn-validator'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedCompany(request)

    const body = await request.json()
    const invoice = body as InvoiceValidationData

    if (!invoice || !Array.isArray(invoice.lines)) {
      return err('Données de facture invalides', 400)
    }

    const result = validateBeforeTTN(invoice)
    return Response.json(result)

  } catch (error: any) {
    return err(error.message ?? 'Erreur interne', error.status ?? 500)
  }
}
